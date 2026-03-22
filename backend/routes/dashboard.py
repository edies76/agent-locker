"""
Dashboard API Routes

Endpoints consumed exclusively by the Agent-Lock web dashboard.

GET  /dashboard/stats      — Aggregate counters (total, approved, blocked, etc.)
GET  /dashboard/activity   — Combined stream: in-memory store + audit log, newest first
GET  /dashboard/pending    — Currently PENDING actions (live, from store)
POST /dashboard/mcp/heartbeat — MCP gateway announces itself (keeps "last seen" fresh)
GET  /dashboard/mcp/status    — Last MCP heartbeat info
"""

from __future__ import annotations

import json
import logging
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import store
from audit.audit_logger import read_logs
from fastapi import APIRouter, Query
from models import ActionStatus, RiskLevel
from pydantic import BaseModel

router = APIRouter(prefix="/dashboard", tags=["Dashboard"])
logger = logging.getLogger("agent-lock.dashboard")

# ── In-memory MCP heartbeat tracker ──────────────────────────────────────────
_mcp_last_seen: datetime | None = None
_mcp_info: dict[str, Any] = {}
_mcp_config_path = Path.home() / ".agent-lock" / "mcp_config.json"
_mcp_executions: dict[str, dict[str, Any]] = {}


# ── Helper ────────────────────────────────────────────────────────────────────


def _action_to_dict(a) -> dict[str, Any]:
    """Convert a PendingAction to a plain dict for the dashboard."""
    return {
        "action_id": a.action_id,
        "timestamp": a.created_at.isoformat(),
        "tool_name": a.tool_name,
        "args": a.args,
        "raw_command": a.raw_command,
        "user_intent": a.user_intent,
        "agent_id": a.agent_id,
        "risk_level": a.risk_level.value,
        "intent_score": a.intent_score,
        "analysis": a.analysis,
        "decision": a.status.value,
        "decided_at": a.decided_at.isoformat() if a.decided_at else None,
        "_signature_valid": True,  # in-store records are always trusted
        "_source": "store",
    }


def _attach_execution_details(item: dict[str, Any]) -> dict[str, Any]:
    action_id = item.get("action_id")
    exec_meta = _mcp_executions.get(action_id, {}) if action_id else {}
    enriched = dict(item)
    enriched["execution"] = exec_meta
    return enriched


# ── Stats ─────────────────────────────────────────────────────────────────────


@router.get("/stats")
async def get_stats() -> dict[str, Any]:
    """
    Return aggregate counters built from the audit log + live store.

    Risk breakdown and timeline histogram are included so the dashboard
    can render charts without a second request.
    """
    logs = read_logs(limit=500)
    pending_actions = store.all_pending()

    total = len(logs) + len(pending_actions)
    auto_approved = sum(1 for l in logs if l.get("decision") == "AUTO_APPROVED")
    human_approved = sum(1 for l in logs if l.get("decision") == "APPROVED")
    blocked = sum(1 for l in logs if l.get("decision") == "BLOCKED")
    pending_count = len(pending_actions)

    # Risk-level breakdown (from logs only — pending are all unresolved)
    risk_counts = {r.value: 0 for r in RiskLevel}
    for l in logs:
        rl = l.get("risk_level", "LOW")
        if rl in risk_counts:
            risk_counts[rl] += 1

    # Add pending to risk counts
    for a in pending_actions:
        risk_counts[a.risk_level.value] += 1

    return {
        "total": total,
        "auto_approved": auto_approved,
        "human_approved": human_approved,
        "blocked": blocked,
        "pending": pending_count,
        "risk_breakdown": risk_counts,
        "signature_failures": sum(
            1 for l in logs if l.get("_signature_valid") is False
        ),
    }


# ── Activity feed ─────────────────────────────────────────────────────────────


@router.get("/activity")
async def get_activity(
    limit: int = Query(default=50, ge=1, le=200),
) -> list[dict[str, Any]]:
    """
    Unified activity feed: PENDING actions (from live store) + resolved actions
    (from signed audit log), merged and sorted newest-first.
    """
    # 1. In-memory store — all actions regardless of status
    store_items = [_action_to_dict(a) for a in store.all_actions()]

    # 2. Audit log — already-resolved actions
    log_items = []
    logged_ids = {item["action_id"] for item in store_items}
    for entry in read_logs(limit=limit):
        if entry.get("action_id") not in logged_ids:
            entry.setdefault("_source", "log")
            log_items.append(entry)

    combined = store_items + log_items
    combined.sort(key=lambda x: x.get("timestamp", ""), reverse=True)
    return [_attach_execution_details(item) for item in combined[:limit]]


# ── Pending actions ───────────────────────────────────────────────────────────


@router.get("/pending")
async def get_pending() -> list[dict[str, Any]]:
    """
    Return only the actions currently awaiting human approval.
    Polled every ~1 s by the dashboard approval panel.
    """
    return [_action_to_dict(a) for a in store.all_pending()]


@router.get("/activity/{action_id}")
async def get_activity_item(action_id: str) -> dict[str, Any]:
    """Return full details for a single action id from store/log plus execution info."""
    for a in store.all_actions():
        if a.action_id == action_id:
            return _attach_execution_details(_action_to_dict(a))

    for entry in read_logs(limit=2000):
        if entry.get("action_id") == action_id:
            entry.setdefault("_source", "log")
            return _attach_execution_details(entry)

    return {
        "action_id": action_id,
        "error": "Action not found",
        "execution": _mcp_executions.get(action_id, {}),
    }


# ── MCP heartbeat / status ────────────────────────────────────────────────────


class MCPHeartbeatPayload(BaseModel):
    connected_servers: list[str] = []
    tool_count: int = 0
    backend_url: str = "http://localhost:8000"
    version: str = "1.0.0"


class MCPExecutionPayload(BaseModel):
    action_id: str
    server_name: str
    tool_name: str
    success: bool
    request_args: dict[str, Any] = {}
    response_summary: str = ""
    error: str = ""


@router.post("/mcp/heartbeat")
async def mcp_heartbeat(payload: MCPHeartbeatPayload) -> dict[str, str]:
    """
    Called by the Agent-Lock MCP gateway every ~30 s so the dashboard
    can show whether Claude Desktop is connected.
    """
    global _mcp_last_seen, _mcp_info
    _mcp_last_seen = datetime.now(timezone.utc)
    _mcp_info = payload.model_dump()
    logger.debug(f"MCP heartbeat received | servers={payload.connected_servers}")
    return {"status": "ok"}


@router.post("/mcp/executions")
async def mcp_execution(payload: MCPExecutionPayload) -> dict[str, str]:
    """Store compact execution details to power dashboard drill-down views."""
    _mcp_executions[payload.action_id] = {
        "server_name": payload.server_name,
        "tool_name": payload.tool_name,
        "success": payload.success,
        "request_args": payload.request_args,
        "response_summary": payload.response_summary,
        "error": payload.error,
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }
    return {"status": "ok"}


@router.get("/mcp/status")
async def get_mcp_status() -> dict[str, Any]:
    """
    Return the latest MCP gateway heartbeat and a staleness flag.
    The dashboard uses this to show the green/red connection dot.
    """
    if _mcp_last_seen is None:
        return {
            "connected": False,
            "last_seen": None,
            "seconds_ago": None,
            "info": {},
        }

    now = datetime.now(timezone.utc)
    seconds_ago = (now - _mcp_last_seen).total_seconds()

    return {
        "connected": seconds_ago < 60,  # consider stale after 60 s
        "last_seen": _mcp_last_seen.isoformat(),
        "seconds_ago": round(seconds_ago),
        "info": _mcp_info,
    }


@router.get("/mcp/targets")
async def get_mcp_targets() -> dict[str, Any]:
    """Return configured MCP target servers with current connected status."""
    configured_servers: list[dict[str, Any]] = []
    connected_names = set(_mcp_info.get("connected_servers", []))

    try:
        if _mcp_config_path.exists():
            with open(_mcp_config_path, "r", encoding="utf-8") as f:
                raw = json.load(f)
            for server in raw.get("target_servers", []):
                name = (server.get("name") or "").strip()
                if not name:
                    continue
                configured_servers.append(
                    {
                        "name": name,
                        "enabled": bool(server.get("enabled", True)),
                        "connected": name in connected_names,
                        "command": server.get("command", ""),
                    }
                )
    except Exception as exc:
        logger.warning(f"Could not load MCP config for dashboard: {exc}")

    # Include heartbeat-only server names in case config changed while running.
    known = {s["name"] for s in configured_servers}
    for name in sorted(connected_names):
        if name not in known:
            configured_servers.append(
                {
                    "name": name,
                    "enabled": True,
                    "connected": True,
                    "command": "",
                }
            )

    return {
        "config_path": str(_mcp_config_path),
        "servers": configured_servers,
        "configured_count": len(configured_servers),
        "connected_count": sum(1 for s in configured_servers if s["connected"]),
    }
