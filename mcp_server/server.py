"""
Agent-Lock MCP Gateway — Complete Implementation

Acts as an MCP proxy between Claude Desktop / ChatGPT and any target MCP server,
adding a full governance layer before every tool call.

Architecture:
    Claude Desktop ──► Agent-Lock MCP Gateway ──► Target MCP Servers
                               │
                               ▼
                    POST /intercept  (backend)
                        ↓ Gemini + Risk Classifier
                        ↓ Telegram notification  (HIGH / CRITICAL)
                    GET  /status polling
                        ↓ APPROVED → execute on target server
                        ↓ BLOCKED  → return error to Claude

Tool naming convention:
    {server_name}__{tool_name}
    e.g.  filesystem__read_file   github__create_issue

Management tools (always available):
    agent_lock__status        — gateway health + config summary
    agent_lock__list_servers  — connected target servers

Usage:
    # stdio transport  (Claude Desktop)
    python -m mcp_server

    # HTTP transport  (testing / ChatGPT)
    python -m mcp_server --transport http --port 8001
"""

from __future__ import annotations

import asyncio
import json
import logging
import os
import sys
import time
from typing import Any

import httpx
import mcp.types as types
from mcp.server import Server
from mcp.server.stdio import stdio_server

from .config import AgentLockMCPConfig, load_config
from .proxy import ToolProxy

# Version tracking
try:
    from . import __version__
except ImportError:
    __version__ = "unknown"
from .validator import validate_and_wait

# ── Logging (stderr so it doesn't pollute the stdio MCP stream) ───────────────
logging.basicConfig(
    stream=sys.stderr,
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s — %(message)s",
    datefmt="%H:%M:%S",
)
logger = logging.getLogger("agent-lock.mcp.server")

# ── User intent capture ───────────────────────────────────────────────────────
# The MCP protocol (stdio transport) doesn't expose the raw user message to
# tool handlers directly. We use two complementary strategies:
#
#  Strategy 1 — Sampling hook (best, requires MCP sampling capability):
#    The gateway registers a sampling handler. When Claude calls
#    server/createMessage (sampling), we read the last human turn and store it.
#    This fires BEFORE the tool call, so user_intent is always fresh.
#
#  Strategy 2 — Hidden __user_intent arg (fallback):
#    If the system prompt instructs Claude to inject its current task as a
#    hidden arg "__user_intent" on every tool call, we strip it before
#    forwarding to the target server and store it locally.
#
#  Both strategies write to _last_user_intent. The validator reads it per call.
_last_user_intent: str = ""
_last_user_intent_updated_monotonic: float = 0.0
_INTENT_MAX_AGE_SECONDS = 180.0


def _update_intent(text: str) -> None:
    """Store a new user intent, trimmed and truncated to 500 chars."""
    global _last_user_intent, _last_user_intent_updated_monotonic
    text = text.strip()[:500]
    if not text:
        return

    _last_user_intent = text
    _last_user_intent_updated_monotonic = time.monotonic()
    logger.info(f"📝 User intent updated: '{text[:80]}'")


def _extract_intent_from_args(args: dict[str, Any]) -> tuple[dict[str, Any], str]:
    """
    Strip the hidden '__user_intent' key from args if Claude injected it,
    and return (cleaned_args, extracted_intent).
    """
    intent = args.pop("__user_intent", None)
    if intent and isinstance(intent, str):
        intent = intent.strip()[:500]
        if intent:
            return args, intent
    return args, ""


def _get_recent_intent(max_age_seconds: float = _INTENT_MAX_AGE_SECONDS) -> str:
    """Return cached intent only if it is recent enough for this tool call."""
    if not _last_user_intent:
        return ""
    age = time.monotonic() - _last_user_intent_updated_monotonic
    if age <= max_age_seconds:
        return _last_user_intent
    return ""


def _resolve_effective_intent(explicit_intent: str) -> str:
    """
    Resolve intent for one validation call.

    Priority:
    1) explicit per-call intent (hidden arg or HTTP parameter)
    2) recent cached intent (sampling or previous explicit call)
    3) empty string (validator will synthesize from tool args)
    """
    intent = (explicit_intent or "").strip()[:500]
    if intent:
        _update_intent(intent)
        return intent
    return _get_recent_intent()


# Separator between server name and tool name in the MCP tool namespace
TOOL_SEP = "__"
# Reserved prefix for Agent-Lock's own management tools
MGMT_PREFIX = "agent_lock__"

# Argument keys that commonly carry file-system paths in VS Code MCP tools.
_PATH_ARG_KEYS = {
    "path",
    "filePath",
    "file_path",
    "directoryPath",
    "directory_path",
    "targetPath",
    "target_path",
    "includePattern",
}


def _is_probably_read_only_tool(tool_name: str) -> bool:
    """
    Heuristic read-only detector for safe latency baseline probes.

    We only run direct baseline re-execution for tools that are very likely
    non-mutating to avoid accidental side effects.
    """
    lowered = (tool_name or "").lower()
    readonly_prefixes = (
        "read",
        "get",
        "list",
        "fetch",
        "search",
        "query",
        "status",
        "show",
        "describe",
    )
    readonly_keywords = (
        "read_file",
        "list_dir",
        "grep",
        "status",
    )
    return lowered.startswith(readonly_prefixes) or any(k in lowered for k in readonly_keywords)


def _normalize_vscode_args(args: dict[str, Any]) -> dict[str, Any]:
    """
    Normalize VS Code MCP path-like arguments.

    Why:
    - Some VS Code MCP tool handlers are strict about separators and/or expect
      workspace-relative paths.
    - Windows absolute paths with backslashes can trigger parsing errors like
      "Separator is not found" depending on the target tool internals.

    Strategy:
    1. Convert backslashes to forward slashes.
    2. If the path is absolute and under current cwd (Agent-Lock repo root),
       convert to workspace-relative POSIX path.
    """

    cwd = os.path.abspath(os.getcwd())

    def _norm_value(key: str, value: Any) -> Any:
        if isinstance(value, dict):
            return {k: _norm_value(k, v) for k, v in value.items()}

        if isinstance(value, list):
            return [_norm_value(key, v) for v in value]

        if not isinstance(value, str):
            return value

        if key not in _PATH_ARG_KEYS:
            return value

        candidate = value.strip().replace("\\", "/")

        # Try absolute->relative normalization when the path belongs to cwd.
        try:
            abs_candidate = os.path.abspath(value)
            common = os.path.commonpath([cwd, abs_candidate])
            if common == cwd:
                rel = os.path.relpath(abs_candidate, cwd)
                return rel.replace("\\", "/")
        except Exception:
            # Fall back to separator normalization only.
            pass

        return candidate

    return {k: _norm_value(k, v) for k, v in args.items()}


# ── Management tool definitions ───────────────────────────────────────────────


def _management_tools() -> list[types.Tool]:
    return [
        types.Tool(
            name="agent_lock__status",
            description=(
                "Get Agent-Lock MCP Gateway status: version, connected target servers, "
                "backend URL, and current policy settings."
            ),
            inputSchema={"type": "object", "properties": {}},
        ),
        types.Tool(
            name="agent_lock__list_servers",
            description=(
                "List all configured target MCP servers, showing name, enabled flag, "
                "connection status, and the command used to launch each one."
            ),
            inputSchema={"type": "object", "properties": {}},
        ),
        types.Tool(
            name="agent_lock__vault_gmail_send",
            description=(
                "Send an email via Agent-Lock brokered Gmail flow using Auth0 Token Vault. "
                "Requires configured subject_token and connected Google account."
            ),
            inputSchema={
                "type": "object",
                "properties": {
                    "to": {"type": "string"},
                    "subject": {"type": "string"},
                    "body_text": {"type": "string"},
                    "body_html": {"type": "string"},
                },
                "required": ["to", "subject", "body_text"],
            },
        ),
        types.Tool(
            name="agent_lock__vault_github_create_issue",
            description=(
                "Create a GitHub issue via Agent-Lock brokered Token Vault flow. "
                "Requires configured subject_token and connected GitHub account."
            ),
            inputSchema={
                "type": "object",
                "properties": {
                    "owner": {"type": "string"},
                    "repo": {"type": "string"},
                    "title": {"type": "string"},
                    "body": {"type": "string"},
                    "labels": {"type": "array", "items": {"type": "string"}},
                    "assignees": {"type": "array", "items": {"type": "string"}},
                },
                "required": ["owner", "repo", "title"],
            },
        ),
        types.Tool(
            name="agent_lock__vault_slack_send",
            description=(
                "Send a Slack message via Agent-Lock brokered Token Vault flow. "
                "Requires configured subject_token and connected Slack account."
            ),
            inputSchema={
                "type": "object",
                "properties": {
                    "channel": {"type": "string"},
                    "text": {"type": "string"},
                    "thread_ts": {"type": "string"},
                },
                "required": ["channel", "text"],
            },
        ),
        types.Tool(
            name="agent_lock__vault_calendar_create_event",
            description=(
                "Create a Google Calendar event via Agent-Lock brokered Token Vault flow. "
                "Requires configured subject_token and connected Google account."
            ),
            inputSchema={
                "type": "object",
                "properties": {
                    "summary": {"type": "string"},
                    "start_time": {"type": "string"},
                    "end_time": {"type": "string"},
                    "description": {"type": "string"},
                    "location": {"type": "string"},
                    "attendees": {"type": "array", "items": {"type": "string"}},
                },
                "required": ["summary", "start_time", "end_time"],
            },
        ),
    ]


async def _handle_management(
    name: str,
    config: AgentLockMCPConfig,
    proxy: ToolProxy,
) -> list[types.TextContent]:
    """Dispatch Agent-Lock management tool calls."""

    if name == "agent_lock__status":
        connected = proxy.get_server_names()
        payload = {
            "name": "Agent-Lock MCP Gateway",
            "version": __version__,
            "backend_url": config.backend_url,
            "target_servers": {
                "configured": len(config.target_servers),
                "connected": len(connected),
                "names": connected,
            },
            "policies": {
                "auto_approve_low_risk": config.auto_approve_low_risk,
                "require_approval_for_high": config.require_approval_for_high,
                "require_approval_for_critical": config.require_approval_for_critical,
                "approval_timeout_seconds": config.approval_timeout_seconds,
            },
        }
        return [
            types.TextContent(
                type="text",
                text=json.dumps(payload, indent=2, ensure_ascii=False),
            )
        ]

    if name == "agent_lock__list_servers":
        connected = proxy.get_server_names()
        servers = []
        for s in config.target_servers:
            servers.append(
                {
                    "name": s.name,
                    "enabled": s.enabled,
                    "connected": s.name in connected,
                    "command": f"{s.command} {' '.join(s.args)}".strip(),
                }
            )
        return [
            types.TextContent(
                type="text",
                text=json.dumps({"servers": servers}, indent=2, ensure_ascii=False),
            )
        ]

    return [
        types.TextContent(
            type="text",
            text=f"❌ Unknown management tool: {name}",
        )
    ]


async def _call_vault_broker(
    *,
    config: AgentLockMCPConfig,
    endpoint: str,
    payload: dict[str, Any],
) -> list[types.TextContent]:
    if not config.subject_token:
        return [
            types.TextContent(
                type="text",
                text=(
                    "❌ Missing subject_token in MCP config. "
                    "Set `subject_token` in ~/.agent-lock/mcp_config.json or "
                    "AGENT_LOCK_SUBJECT_TOKEN env."
                ),
            )
        ]

    try:
        async with httpx.AsyncClient(timeout=25.0) as client:
            resp = await client.post(
                f"{config.backend_url}{endpoint}",
                json=payload,
                headers={"Authorization": f"Bearer {config.subject_token}"},
            )

            if resp.status_code >= 400:
                preview = resp.text[:500]
                login_url = ""
                try:
                    parsed = resp.json()
                    detail = parsed.get("detail", parsed)
                    if isinstance(detail, dict):
                        login_url = str(detail.get("login_url") or "")
                        if detail.get("error") == "auth_required" and login_url:
                            return [
                                types.TextContent(
                                    type="text",
                                    text=(
                                        "🔐 Authentication required for Token Vault brokered call.\n"
                                        f"Login URL: {login_url}"
                                    ),
                                )
                            ]
                except Exception:
                    pass

                return [
                    types.TextContent(
                        type="text",
                        text=f"❌ Vault broker failed ({resp.status_code}): {preview}",
                    )
                ]

            data = resp.json()
            return [
                types.TextContent(
                    type="text",
                    text=json.dumps(data, indent=2, ensure_ascii=False),
                )
            ]
    except Exception as exc:
        return [
            types.TextContent(
                type="text",
                text=f"❌ Vault broker request error: {exc}",
            )
        ]


# ── Core server builder ───────────────────────────────────────────────────────


def _build_server(config: AgentLockMCPConfig, proxy: ToolProxy) -> Server:
    """
    Wire up the low-level MCP Server with list_tools and call_tool handlers.

    Using the low-level mcp.server.Server (not FastMCP) gives us full control
    over dynamic tool discovery: we forward the real schemas of every target
    tool so Claude sees the correct argument types at all times.
    """
    server = Server("agent-lock")

    # ── sampling handler — Strategy 1 for user intent capture ────────────────
    # Some MCP SDK versions do not expose create_message(); guard it so the
    # gateway still boots and falls back to __user_intent extraction.
    if hasattr(server, "create_message"):
        # When Claude calls server/createMessage (sampling), the request
        # contains the full conversation. Capture the latest user turn.
        @server.create_message()
        async def handle_sampling(
            messages: list[types.SamplingMessage],
            **kwargs: Any,
        ) -> types.CreateMessageResult:
            # Extract the last human message from the sampling request
            for msg in reversed(messages):
                if msg.role == "user":
                    content = msg.content
                    if isinstance(content, types.TextContent):
                        _update_intent(content.text)
                    elif isinstance(content, list):
                        for block in content:
                            if isinstance(block, types.TextContent) and block.text:
                                _update_intent(block.text)
                                break
                    break
            # We don't actually handle sampling ourselves — return empty so Claude
            # knows we registered but didn't consume it.
            return types.CreateMessageResult(
                role="assistant",
                content=types.TextContent(type="text", text=""),
                model="passthrough",
                stopReason="end_turn",
            )
    else:
        logger.warning(
            "MCP SDK does not support create_message(); sampling intent capture disabled."
        )

    # ── list_tools ────────────────────────────────────────────────────────────
    @server.list_tools()
    async def handle_list_tools() -> list[types.Tool]:
        tools: list[types.Tool] = []

        # Proxied tools — one entry per tool in each connected target server
        all_tools = await proxy.list_all_tools()
        for server_name, server_tools in all_tools.items():
            for tool in server_tools:
                raw_name: str = tool.get("name", "")
                if not raw_name:
                    continue
                proxied_name = f"{server_name}{TOOL_SEP}{raw_name}"
                # Inject __user_intent as an optional hidden parameter so Claude
                # can pass its current task explicitly when needed.
                input_schema = tool.get(
                    "inputSchema",
                    {"type": "object", "properties": {}},
                )
                if isinstance(input_schema, dict) and "properties" in input_schema:
                    input_schema = dict(input_schema)
                    input_schema["properties"] = dict(input_schema["properties"])
                    input_schema["properties"]["__user_intent"] = {
                        "type": "string",
                        "description": (
                            "Optional: the current user instruction / task being executed. "
                            "Agent-Lock uses this to validate that the tool call matches "
                            "what the user actually asked for."
                        ),
                    }
                tools.append(
                    types.Tool(
                        name=proxied_name,
                        description=(
                            f"[{server_name}] "
                            f"{tool.get('description', 'No description available.')}"
                        ),
                        inputSchema=input_schema,
                    )
                )

        # Agent-Lock management tools (always present)
        tools.extend(_management_tools())

        logger.info(
            f"list_tools → {len(tools)} tools "
            f"({len(tools) - len(_management_tools())} proxied, "
            f"{len(_management_tools())} management)"
        )
        return tools

    # ── call_tool ─────────────────────────────────────────────────────────────
    @server.call_tool()
    async def handle_call_tool(
        name: str,
        arguments: dict[str, Any] | None,
    ) -> list[types.TextContent]:
        total_start = time.perf_counter()
        args: dict[str, Any] = arguments or {}
        logger.info(f"call_tool: {name}  args_keys={list(args.keys())}")

        # ── Strategy 2: extract hidden __user_intent from args ────────────────
        args, intent_from_args = _extract_intent_from_args(args)

        # ── Management tools ──────────────────────────────────────────────────
        if name.startswith(MGMT_PREFIX):
            if name == "agent_lock__vault_gmail_send":
                to = str(args.get("to", "")).strip()
                subject = str(args.get("subject", "")).strip()
                body_text = str(args.get("body_text", "")).strip()
                body_html = args.get("body_html")
                if not to or not subject or not body_text:
                    return [
                        types.TextContent(
                            type="text",
                            text="❌ Missing required args: to, subject, body_text",
                        )
                    ]
                return await _call_vault_broker(
                    config=config,
                    endpoint="/vault/google/gmail/send",
                    payload={
                        "to": to,
                        "subject": subject,
                        "body_text": body_text,
                        "body_html": body_html,
                    },
                )

            if name == "agent_lock__vault_github_create_issue":
                owner = str(args.get("owner", "")).strip()
                repo = str(args.get("repo", "")).strip()
                title = str(args.get("title", "")).strip()
                body = str(args.get("body", "")).strip()
                labels_raw = args.get("labels", [])
                assignees_raw = args.get("assignees", [])
                labels = [str(v) for v in labels_raw] if isinstance(labels_raw, list) else []
                assignees = [str(v) for v in assignees_raw] if isinstance(assignees_raw, list) else []
                if not owner or not repo or not title:
                    return [
                        types.TextContent(
                            type="text",
                            text="❌ Missing required args: owner, repo, title",
                        )
                    ]
                return await _call_vault_broker(
                    config=config,
                    endpoint="/vault/github/issues/create",
                    payload={
                        "owner": owner,
                        "repo": repo,
                        "title": title,
                        "body": body or None,
                        "labels": labels or None,
                        "assignees": assignees or None,
                    },
                )

            if name == "agent_lock__vault_slack_send":
                channel = str(args.get("channel", "")).strip()
                text = str(args.get("text", "")).strip()
                thread_ts = str(args.get("thread_ts", "")).strip()
                if not channel or not text:
                    return [
                        types.TextContent(
                            type="text",
                            text="❌ Missing required args: channel, text",
                        )
                    ]
                return await _call_vault_broker(
                    config=config,
                    endpoint="/vault/slack/messages/send",
                    payload={
                        "channel": channel,
                        "text": text,
                        "thread_ts": thread_ts or None,
                    },
                )

            if name == "agent_lock__vault_calendar_create_event":
                summary = str(args.get("summary", "")).strip()
                start_time = str(args.get("start_time", "")).strip()
                end_time = str(args.get("end_time", "")).strip()
                description = str(args.get("description", "")).strip()
                location = str(args.get("location", "")).strip()
                attendees_raw = args.get("attendees", [])
                attendees = [str(v) for v in attendees_raw] if isinstance(attendees_raw, list) else []
                if not summary or not start_time or not end_time:
                    return [
                        types.TextContent(
                            type="text",
                            text="❌ Missing required args: summary, start_time, end_time",
                        )
                    ]
                return await _call_vault_broker(
                    config=config,
                    endpoint="/vault/google/calendar/events",
                    payload={
                        "summary": summary,
                        "start_time": start_time,
                        "end_time": end_time,
                        "description": description or None,
                        "location": location or None,
                        "attendees": attendees or None,
                    },
                )
            return await _handle_management(name, config, proxy)

        # ── Proxied tools ─────────────────────────────────────────────────────
        if TOOL_SEP not in name:
            return [
                types.TextContent(
                    type="text",
                    text=(
                        f"❌ Unknown tool: '{name}'.\n"
                        "Call `agent_lock__list_servers` to see available servers, "
                        "or `agent_lock__status` for gateway info."
                    ),
                )
            ]

        server_name, tool_name = name.split(TOOL_SEP, 1)

        # VS Code MCP tools are sensitive to Windows path separators/absolute paths.
        if server_name.lower() == "vscode":
            args = _normalize_vscode_args(args)

        effective_user_intent = _resolve_effective_intent(intent_from_args)

        # ── 1. Validate via backend (risk + optional Telegram approval) ───────
        logger.info(
            f"Validating {server_name}.{tool_name} ... "
            f"| intent='{effective_user_intent[:60] or '(derived by validator)'}'"
        )
        validate_start = time.perf_counter()
        validation = await validate_and_wait(
            server_name=server_name,
            tool_name=tool_name,
            arguments=args,
            config=config,
            user_intent=effective_user_intent,
        )
        validation_ms = round((time.perf_counter() - validate_start) * 1000.0, 2)

        decision = validation.get("decision", "blocked")
        risk_level = validation.get("risk_level", "UNKNOWN")
        reason = validation.get("reason", "")
        action_id = validation.get("action_id")

        logger.info(
            f"Decision={decision} | risk={risk_level} | "
            f"action_id={action_id} | reason={reason[:80]}"
        )

        # ── Blocked ───────────────────────────────────────────────────────────
        if decision == "blocked":
            return [
                types.TextContent(
                    type="text",
                    text=(
                        "🦞 **Agent-Lock blocked this action**\n\n"
                        f"- **Tool:** `{server_name}.{tool_name}`\n"
                        f"- **Risk level:** `{risk_level}`\n"
                        f"- **Reason:** {reason}\n"
                        f"- **Action ID:** `{action_id or 'N/A'}`"
                    ),
                )
            ]

        # ── Approval timeout ──────────────────────────────────────────────────
        if decision == "timeout":
            return [
                types.TextContent(
                    type="text",
                    text=(
                        "⏱️ **Approval timeout — action cancelled**\n\n"
                        f"- **Tool:** `{server_name}.{tool_name}`\n"
                        f"- **Action ID:** `{action_id or 'N/A'}`\n\n"
                        "No response was received within the allowed window. "
                        "You can still approve via Telegram and retry the request."
                    ),
                )
            ]

        # ── Unexpected state guard ────────────────────────────────────────────
        if decision != "approved":
            return [
                types.TextContent(
                    type="text",
                    text=(
                        f"❌ Unexpected validation state: `{decision}`. "
                        "Action not executed."
                    ),
                )
            ]

        # ── 2. Execute on target server ───────────────────────────────────────
        logger.info(f"Executing {server_name}.{tool_name} ...")
        exec_start = time.perf_counter()
        result = await proxy.execute_tool(server_name, tool_name, args)
        target_exec_ms = round((time.perf_counter() - exec_start) * 1000.0, 2)

        timings_ms: dict[str, float] = {
            "validation_wait_ms": validation_ms,
            "target_exec_ms": target_exec_ms,
            "total_gateway_ms": round((time.perf_counter() - total_start) * 1000.0, 2),
        }

        baseline_result: dict[str, Any] = {
            "enabled": False,
            "mode": "none",
            "note": "Baseline benchmark not attempted",
        }

        # Optional direct-baseline probe for read-only tools.
        # This quantifies gateway overhead vs direct target execution time.
        benchmark_enabled = os.environ.get("AGENT_LOCK_BENCHMARK_READONLY", "1") == "1"
        if benchmark_enabled and _is_probably_read_only_tool(tool_name):
            baseline_result["enabled"] = True
            baseline_result["mode"] = "readonly_direct_replay"
            try:
                baseline_start = time.perf_counter()
                baseline_raw = await proxy.execute_tool(server_name, tool_name, args)
                baseline_ms = round((time.perf_counter() - baseline_start) * 1000.0, 2)
                timings_ms["baseline_direct_ms"] = baseline_ms
                timings_ms["agent_lock_overhead_ms"] = round(
                    timings_ms["total_gateway_ms"] - baseline_ms,
                    2,
                )
                baseline_result["success"] = bool(baseline_raw.get("success"))
                baseline_result["note"] = "Baseline direct replay completed"
            except Exception as exc:
                baseline_result["success"] = False
                baseline_result["note"] = f"Baseline replay failed: {exc}"
        elif not benchmark_enabled:
            baseline_result["note"] = "Disabled by AGENT_LOCK_BENCHMARK_READONLY=0"
        else:
            baseline_result["note"] = "Skipped: tool is not read-only"

        if not result.get("success"):
            await _report_execution(
                config=config,
                action_id=action_id,
                server_name=server_name,
                tool_name=tool_name,
                success=False,
                request_args=args,
                response_summary="",
                error=result.get("error", "Unknown error"),
                timings_ms=timings_ms,
                benchmark=baseline_result,
            )
            return [
                types.TextContent(
                    type="text",
                    text=(
                        f"❌ Execution error on `{server_name}.{tool_name}`:\n"
                        f"{result.get('error', 'Unknown error')}"
                    ),
                )
            ]

        # ── 3. Normalise target server result to MCP TextContent ──────────────
        raw = result.get("result", {})
        await _report_execution(
            config=config,
            action_id=action_id,
            server_name=server_name,
            tool_name=tool_name,
            success=True,
            request_args=args,
            response_summary=_summarise_result(raw),
            error="",
            timings_ms=timings_ms,
            benchmark=baseline_result,
        )
        return _normalise_result(raw)

    return server


def _summarise_result(raw: Any) -> str:
    """Build a compact response summary for dashboard drill-down views."""
    try:
        if isinstance(raw, dict):
            content = raw.get("content")
            if isinstance(content, list):
                return f"content_items={len(content)}"
            keys = ", ".join(sorted(raw.keys())[:8])
            return f"dict_keys={keys}" if keys else "dict"
        if isinstance(raw, list):
            return f"list_items={len(raw)}"
        if isinstance(raw, str):
            return raw[:200]
        return str(raw)[:200]
    except Exception:
        return "(summary unavailable)"


async def _report_execution(
    *,
    config: AgentLockMCPConfig,
    action_id: str | None,
    server_name: str,
    tool_name: str,
    success: bool,
    request_args: dict[str, Any],
    response_summary: str,
    error: str,
    timings_ms: dict[str, float],
    benchmark: dict[str, Any],
) -> None:
    """Send execution metadata to backend for activity-detail dashboards."""
    if not action_id:
        return

    payload = {
        "action_id": action_id,
        "server_name": server_name,
        "tool_name": tool_name,
        "success": success,
        "request_args": request_args,
        "response_summary": response_summary,
        "error": error,
        "timings_ms": timings_ms,
        "benchmark": benchmark,
    }

    try:
        async with httpx.AsyncClient(timeout=2.0) as client:
            await client.post(
                f"{config.backend_url}/dashboard/mcp/executions",
                json=payload,
            )
    except Exception as exc:
        logger.debug(f"execution report failed for {action_id}: {exc}")


def _normalise_result(raw: Any) -> list[types.TextContent]:
    """
    Convert whatever the target MCP server returned into a list of TextContent.

    Target servers can return:
      - {"content": [{"type": "text", "text": "..."}]}  ← standard MCP
      - {"content": [{"type": "resource", ...}]}
      - A plain string
      - A plain dict / list
    """
    if isinstance(raw, str):
        return [types.TextContent(type="text", text=raw)]

    if isinstance(raw, dict):
        content = raw.get("content")
        if isinstance(content, list):
            parts: list[str] = []
            for item in content:
                if isinstance(item, dict):
                    if item.get("type") == "text":
                        parts.append(item.get("text", ""))
                    else:
                        parts.append(json.dumps(item, ensure_ascii=False))
                else:
                    parts.append(str(item))
            return [types.TextContent(type="text", text="\n".join(parts))]
        # Plain dict with no content key
        return [
            types.TextContent(
                type="text",
                text=json.dumps(raw, indent=2, ensure_ascii=False),
            )
        ]

    if isinstance(raw, list):
        return [
            types.TextContent(
                type="text",
                text=json.dumps(raw, indent=2, ensure_ascii=False),
            )
        ]

    return [types.TextContent(type="text", text=str(raw))]


# ── Server lifecycle ──────────────────────────────────────────────────────────


async def run_server(config: AgentLockMCPConfig) -> None:
    """
    Initialise target-server connections, build the MCP server,
    and run the stdio transport loop.
    """
    logger.info("🦞 Agent-Lock MCP Gateway starting ...")

    # Connect to all enabled target servers in parallel
    proxy = ToolProxy(config.target_servers)
    await proxy.initialize()

    connected = proxy.get_server_names()
    logger.info(
        f"Target servers: {len(connected)}/{len(config.target_servers)} connected "
        f"→ {connected}"
    )

    server = _build_server(config, proxy)

    logger.info(f"🦞 Agent-Lock MCP Gateway v{__version__} ready")
    logger.info(f"   Backend: {config.backend_url}")
    logger.info(f"   Servers: {len(connected)} connected")
    logger.info(f"   Transport: stdio (Claude Desktop mode)")


    try:
        # stdio transport — standard for Claude Desktop
        async with stdio_server() as (read_stream, write_stream):
            await server.run(
                read_stream,
                write_stream,
                server.create_initialization_options(),
            )
    finally:
        logger.info("Shutting down proxy connections ...")
        await proxy.shutdown()
        logger.info("Agent-Lock MCP Gateway stopped.")


# ── CLI entry point ───────────────────────────────────────────────────────────


def main() -> None:
    """
    Entry point for `python -m mcp_server` and the `__main__.py` shim.

    Supports two transports:
      --transport stdio   (default) — for Claude Desktop
      --transport http    — for testing / ChatGPT plugins
    """
    import argparse

    parser = argparse.ArgumentParser(
        description="Agent-Lock MCP Gateway — governance layer for Claude Desktop & ChatGPT",
    )
    parser.add_argument(
        "--transport",
        choices=["stdio", "http"],
        default="stdio",
        help="Transport to use (default: stdio for Claude Desktop)",
    )
    parser.add_argument(
        "--port",
        type=int,
        default=8001,
        help="Port for HTTP transport (default: 8001)",
    )
    parser.add_argument(
        "--config",
        type=str,
        default=None,
        help="Path to mcp_config.json (default: ~/.agent-lock/mcp_config.json)",
    )
    args = parser.parse_args()

    config = load_config(args.config)

    # Show version at startup
    logger.info(f"🦞 Agent-Lock MCP Gateway v{__version__}")
    logger.info(
        f"   Config: {len(config.target_servers)} target servers | "
        f"backend={config.backend_url}"
    )

    if args.transport == "stdio":
        try:
            asyncio.run(run_server(config))
        except KeyboardInterrupt:
            logger.info("Interrupted by user.")
    else:
        _run_http(config, args.port)


def _run_http(config: AgentLockMCPConfig, port: int) -> None:
    """
    Run Agent-Lock as an HTTP MCP server for testing or ChatGPT integration.
    """
    from mcp.server.fastmcp import FastMCP  # noqa: F401

    logger.info(f"Starting HTTP transport on port {port} ...")

    proxy_holder: dict[str, ToolProxy] = {}

    async def _init() -> None:
        p = ToolProxy(config.target_servers)
        await p.initialize()
        proxy_holder["proxy"] = p

    asyncio.run(_init())
    proxy = proxy_holder["proxy"]

    fmcp = FastMCP("agent-lock", json_response=True)

    @fmcp.tool()
    async def execute_tool(
        server_name: str,
        tool_name: str,
        arguments: dict[str, Any],
        user_intent: str = "",
    ) -> dict[str, Any]:
        """Execute a tool on a target MCP server after Agent-Lock validation."""
        from .validator import validate_and_wait as _vaw

        clean_args, intent_from_args = _extract_intent_from_args(arguments or {})
        effective_user_intent = _resolve_effective_intent(user_intent or intent_from_args)

        validation = await _vaw(
            server_name, tool_name, clean_args, config,
            user_intent=effective_user_intent,
        )
        if validation["decision"] != "approved":
            return {
                "blocked": True,
                "decision": validation["decision"],
                "risk_level": validation.get("risk_level"),
                "reason": validation.get("reason"),
            }
        result = await proxy.execute_tool(server_name, tool_name, clean_args)
        return result

    @fmcp.tool()
    async def list_available_tools() -> dict[str, Any]:
        """List all tools from all connected target MCP servers."""
        return {"servers": await proxy.list_all_tools()}

    @fmcp.tool()
    async def gateway_status() -> dict[str, Any]:
        """Agent-Lock gateway status."""
        return {
            "backend_url": config.backend_url,
            "connected_servers": proxy.get_server_names(),
        }

    import os as _os
    _os.environ.setdefault("FASTMCP_PORT", str(port))
    fmcp.run(transport="sse")


if __name__ == "__main__":
    main()
