"""
Tool Call Validator for Agent-Lock MCP Gateway.

Calls the Agent-Lock backend (/intercept) to validate every tool call,
then polls /status/{action_id} until the human decides or the timeout expires.

Flow:
    1. POST /intercept
           → risk classification (Gemini + rules + policies)
           → if LOW  → AUTO_APPROVED immediately
           → if HIGH/CRITICAL → PENDING (Telegram notification sent by backend)
    2. Poll GET /status/{action_id}  (exponential backoff, max 10 s between polls)
           → APPROVED  → execute tool
           → BLOCKED   → return blocked decision
           → timeout   → return timeout decision  (fail-closed)
"""

from __future__ import annotations

import asyncio
import logging
import time
from datetime import datetime, timedelta
from typing import Any

import httpx

from .config import AgentLockMCPConfig

logger = logging.getLogger("agent-lock.mcp.validator")

# ── Polling configuration ─────────────────────────────────────────────────────
_POLL_INITIAL: float = 2.0   # first poll interval (seconds)
_POLL_MAX: float = 10.0      # maximum poll interval after backoff
_POLL_BACKOFF: float = 1.5   # multiplier applied after each poll
_DEFAULT_TIMEOUT: float = 300.0  # 5 minutes


# ── Local Cache for LOW risk tools ───────────────────────────────────────────
# format: { "full_tool_name": (risk_level, analysis, expiry) }
_local_policy_cache: dict[str, tuple[str, str, datetime]] = {}


# ── Public interface ──────────────────────────────────────────────────────────


async def validate_and_wait(
    server_name: str,
    tool_name: str,
    arguments: dict[str, Any],
    config: AgentLockMCPConfig,
    user_intent: str = "",
    timeout: float = _DEFAULT_TIMEOUT,
) -> dict[str, Any]:
    """
    Validate a tool call via the Agent-Lock backend and wait for a decision.

    Parameters
    ----------
    server_name : str
        Name of the target MCP server (e.g. "filesystem", "github").
    tool_name : str
        Name of the tool being called (e.g. "read_file").
    arguments : dict
        Tool arguments.
    config : AgentLockMCPConfig
        Gateway configuration (backend URL, policy flags, etc.)
    user_intent : str
        The original user message captured by the gateway. If empty, the
        backend will run Gemini in Intrinsic mode (evaluate the command
        on its own merits without a reference instruction).
    timeout : float
        Maximum seconds to wait for a human approval before giving up.

    Returns
    -------
    dict with keys:
        decision    : "approved" | "blocked" | "timeout"
        risk_level  : "LOW" | "HIGH" | "CRITICAL" | "UNKNOWN"
        reason      : human-readable explanation
        action_id   : str | None
        auth_token  : str | None   (set when approved via Auth0 Token Vault)
    """
    # The backend identifies the tool as  "{server_name}__{tool_name}"
    full_tool_name = f"{server_name}__{tool_name}"

    # ── Step 0: Check Local Cache (Fast Path) ────────────────────────────────
    if config.local_cache_ttl > 0:
        cached = _local_policy_cache.get(full_tool_name)
        if cached:
            risk, analysis, expiry = cached
            if datetime.now() < expiry:
                logger.info(f"⚡ Local cache hit (LOW risk fast-path) | tool={full_tool_name}")
                # We still want to record this in the backend, but we don't block on it.
                # Since we don't have an action_id yet, we trigger the intercept in background
                # to get one and then report success/failure from the server.py
                # BUT wait: server.py needs an action_id to report.
                # So we actually DO need to call intercept, but maybe we can make it
                # return faster or assume it will be approved.
                # Actually, the user wants REDUCED latency. A local cache that skips the backend
                # for the critical path is the best.
                # To keep the dashboard working, we can fire-and-forget the intercept call.
                asyncio.create_task(_call_intercept(full_tool_name, arguments, config, user_intent))
                
                return _approved(
                    risk_level=risk,
                    reason=f"[Local Cache] {analysis}",
                    action_id=f"cached-{int(time.time())}", # Temporary ID
                    auth_token=None, # Tokens usually require backend interaction
                )

    intent_preview = user_intent[:60] if user_intent else "(not captured — Gemini Intrinsic mode)"
    logger.info(
        f"validate_and_wait: tool={full_tool_name} | intent='{intent_preview}'"
    )

    # ── Step 1: POST /intercept ───────────────────────────────────────────────
    intercept_result = await _call_intercept(
        full_tool_name, arguments, config, user_intent
    )
    if intercept_result.get("_error"):
        return _blocked(
            risk_level="UNKNOWN",
            reason=intercept_result["_error"],
        )

    status = intercept_result.get("status", "")
    risk_level: str = intercept_result.get("risk_level", "UNKNOWN")
    analysis: str = intercept_result.get("analysis", "")
    action_id: str | None = intercept_result.get("action_id")

    logger.info(
        f"intercept: tool={full_tool_name} | status={status} | "
        f"risk={risk_level} | action_id={action_id}"
    )

    # ── Step 2: AUTO_APPROVED (LOW risk fast path) ────────────────────────────
    if status == "AUTO_APPROVED":
        # Cache this for next time if it's truly LOW risk
        if risk_level == "LOW" and config.local_cache_ttl > 0:
            _local_policy_cache[full_tool_name] = (
                risk_level,
                analysis,
                datetime.now() + timedelta(seconds=config.local_cache_ttl)
            )

        logger.info(f"✅ Auto-approved (LOW risk) | action_id={action_id}")
        return _approved(
            risk_level=risk_level,
            reason=analysis,
            action_id=action_id,
            auth_token=intercept_result.get("auth_token"),
        )

    # ── Step 3: PENDING → poll until decided ─────────────────────────────────
    if status == "PENDING":
        if action_id is None:
            return _blocked(
                risk_level=risk_level,
                reason="Backend returned PENDING but no action_id — cannot poll.",
            )

        logger.info(
            f"⏳ Waiting for Telegram approval | action_id={action_id} | "
            f"risk={risk_level} | timeout={timeout}s"
        )
        return await _poll_until_decided(
            action_id=action_id,
            risk_level=risk_level,
            config=config,
            timeout=timeout,
        )

    # ── Step 4: Any other status (BLOCKED, etc.) ──────────────────────────────
    logger.info(f"🚫 Blocked by backend policy | status={status} | risk={risk_level}")
    return _blocked(
        risk_level=risk_level,
        reason=analysis or f"Blocked by backend (status={status})",
        action_id=action_id,
    )


# ── Internal helpers ──────────────────────────────────────────────────────────


async def _call_intercept(
    full_tool_name: str,
    arguments: dict[str, Any],
    config: AgentLockMCPConfig,
    user_intent: str = "",
) -> dict[str, Any]:
    """
    POST /intercept to the Agent-Lock backend.

    Passes the captured user_intent so the backend can run Gemini in
    MODE A (intent comparison) instead of always falling back to
    MODE B (intrinsic safety).

    Returns the raw response JSON on success, or a dict with "_error" key
    on failure so callers can distinguish network errors from backend errors.
    """
    payload = {
        "tool_name": full_tool_name,
        "args": arguments,
        "user_intent": user_intent,  # now populated from the gateway's capture strategies
        "agent_id": "mcp-gateway",
    }
    subject_token = getattr(config, "subject_token", None)
    if subject_token:
        payload["subject_token"] = subject_token

    if user_intent:
        logger.info(
            f"📤 Sending to backend | tool={full_tool_name} | "
            f"intent='{user_intent[:60]}' | mode=compare (Gemini MODE A)"
        )
    else:
        logger.info(
            f"📤 Sending to backend | tool={full_tool_name} | "
            f"no intent captured → Gemini MODE B (intrinsic safety)"
        )

    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.post(
                f"{config.backend_url}/intercept",
                json=payload,
            )
            resp.raise_for_status()
            return resp.json()

    except httpx.ConnectError:
        msg = (
            f"Cannot connect to Agent-Lock backend at {config.backend_url}. "
            "Make sure the backend is running (`python agent-lock.py start`). "
            "Action blocked (fail-closed)."
        )
        logger.error(msg)
        return {"_error": msg}

    except httpx.TimeoutException:
        msg = f"Timeout calling {config.backend_url}/intercept. Action blocked (fail-closed)."
        logger.error(msg)
        return {"_error": msg}

    except httpx.HTTPStatusError as exc:
        msg = (
            f"Backend /intercept returned HTTP {exc.response.status_code}: "
            f"{exc.response.text[:200]}. Action blocked."
        )
        logger.error(msg)
        return {"_error": msg}

    except Exception as exc:
        msg = (
            f"Unexpected error calling /intercept: {exc}. Action blocked (fail-closed)."
        )
        logger.error(msg)
        return {"_error": msg}


async def _poll_until_decided(
    action_id: str,
    risk_level: str,
    config: AgentLockMCPConfig,
    timeout: float,
) -> dict[str, Any]:
    """
    Poll GET /status/{action_id} with exponential backoff until the human
    approves or blocks the action, or the timeout is reached.

    Backoff schedule:
        poll 1 → wait 2 s
        poll 2 → wait 3 s
        poll 3 → wait 4.5 s
        ...
        poll N → wait 10 s  (capped at _POLL_MAX)
    """
    loop = asyncio.get_event_loop()
    deadline = loop.time() + timeout
    interval = _POLL_INITIAL

    poll_count = 0
    while loop.time() < deadline:
        await asyncio.sleep(interval)
        poll_count += 1

        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                resp = await client.get(f"{config.backend_url}/status/{action_id}")
                resp.raise_for_status()
                data = resp.json()
        except Exception as exc:
            logger.warning(f"Status poll #{poll_count} failed (will retry): {exc}")
            interval = min(interval, _POLL_INITIAL)
            continue

        current_status: str = data.get("status", "PENDING")

        if current_status == "APPROVED":
            auth_token: str | None = data.get("auth_token")
            logger.info(
                f"✅ Approved by user via Telegram | action_id={action_id} | "
                f"poll_count={poll_count}"
            )
            return _approved(
                risk_level=risk_level,
                reason="Approved by user via Telegram",
                action_id=action_id,
                auth_token=auth_token,
            )

        if current_status == "BLOCKED":
            logger.info(
                f"🚫 Blocked by user via Telegram | action_id={action_id} | "
                f"poll_count={poll_count}"
            )
            return _blocked(
                risk_level=risk_level,
                reason="Blocked by user via Telegram",
                action_id=action_id,
            )

        # Still PENDING — grow the interval (exponential backoff, capped)
        interval = min(interval * _POLL_BACKOFF, _POLL_MAX)
        remaining = max(0.0, deadline - loop.time())
        logger.debug(
            f"  poll #{poll_count} → still PENDING | "
            f"next_in={interval:.1f}s | remaining={remaining:.0f}s"
        )

    # ── Timeout ───────────────────────────────────────────────────────────────
    logger.warning(
        f"⏱️ Approval timeout after {timeout}s | action_id={action_id} | "
        f"poll_count={poll_count}"
    )
    return {
        "decision": "timeout",
        "risk_level": risk_level,
        "reason": (
            f"No Telegram response received within {int(timeout)} seconds. "
            "Action cancelled (fail-closed). "
            "You can still approve via Telegram and retry the request."
        ),
        "action_id": action_id,
        "auth_token": None,
    }


# ── Result constructors ───────────────────────────────────────────────────────


def _approved(
    *,
    risk_level: str,
    reason: str,
    action_id: str | None = None,
    auth_token: str | None = None,
) -> dict[str, Any]:
    return {
        "decision": "approved",
        "risk_level": risk_level,
        "reason": reason,
        "action_id": action_id,
        "auth_token": auth_token,
    }


def _blocked(
    *,
    risk_level: str,
    reason: str,
    action_id: str | None = None,
) -> dict[str, Any]:
    return {
        "decision": "blocked",
        "risk_level": risk_level,
        "reason": reason,
        "action_id": action_id,
        "auth_token": None,
    }
