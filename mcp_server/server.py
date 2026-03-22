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
from typing import Any

import httpx
import mcp.types as types
from mcp.server import Server
from mcp.server.stdio import stdio_server

from .config import AgentLockMCPConfig, load_config
from .proxy import ToolProxy
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


def _update_intent(text: str) -> None:
    """Store a new user intent, trimmed and truncated to 500 chars."""
    global _last_user_intent
    text = text.strip()[:500]
    if text and text != _last_user_intent:
        _last_user_intent = text
        logger.info(f"📝 User intent updated: '{text[:80]}'")


def _extract_intent_from_args(args: dict[str, Any]) -> dict[str, Any]:
    """
    Strip the hidden '__user_intent' key from args if Claude injected it,
    update the global intent store, and return the cleaned args dict.
    """
    intent = args.pop("__user_intent", None)
    if intent and isinstance(intent, str):
        _update_intent(intent)
    return args


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
            "version": "1.0.0",
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
    # When Claude Desktop calls server/createMessage (sampling), the request
    # contains the full conversation messages. We read the latest human turn
    # and store it so the next tool call validation has the real user intent.
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
        args: dict[str, Any] = arguments or {}
        logger.info(f"call_tool: {name}  args_keys={list(args.keys())}")

        # ── Strategy 2: extract hidden __user_intent from args ────────────────
        args = _extract_intent_from_args(args)

        # ── Management tools ──────────────────────────────────────────────────
        if name.startswith(MGMT_PREFIX):
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

        # ── 1. Validate via backend (risk + optional Telegram approval) ───────
        logger.info(
            f"Validating {server_name}.{tool_name} ... "
            f"| intent='{_last_user_intent[:60]}'"
        )
        validation = await validate_and_wait(
            server_name=server_name,
            tool_name=tool_name,
            arguments=args,
            config=config,
            user_intent=_last_user_intent,  # ← pass captured intent to backend
        )

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
        result = await proxy.execute_tool(server_name, tool_name, args)

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

    logger.info(f"🦞 Agent-Lock MCP Gateway ready  | backend={config.backend_url}")

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

    logger.info(
        f"Config: {len(config.target_servers)} target servers | "
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

        if user_intent:
            _update_intent(user_intent)

        validation = await _vaw(
            server_name, tool_name, arguments, config,
            user_intent=_last_user_intent,
        )
        if validation["decision"] != "approved":
            return {
                "blocked": True,
                "decision": validation["decision"],
                "risk_level": validation.get("risk_level"),
                "reason": validation.get("reason"),
            }
        result = await proxy.execute_tool(server_name, tool_name, arguments)
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
