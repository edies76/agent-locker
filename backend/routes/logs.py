"""
GET /logs   — Filtered records from signed audit log
GET /health — Healthcheck
"""
from __future__ import annotations

import logging
from datetime import datetime
from typing import Any

from fastapi import APIRouter, Query

from audit.audit_logger import read_logs

router = APIRouter()
logger = logging.getLogger("agent-lock.logs")


def _to_dt(value: str | None) -> datetime | None:
    if not value:
        return None
    try:
        return datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError:
        return None


@router.get("/logs")
async def get_logs(
    limit: int = Query(default=50, ge=1, le=2000),
    risk: str | None = Query(default=None),
    decision: str | None = Query(default=None),
    tool: str | None = Query(default=None),
    agent: str | None = Query(default=None),
    signature: str = Query(default="all"),
    search: str | None = Query(default=None),
    from_ts: str | None = Query(default=None),
    to_ts: str | None = Query(default=None),
) -> list[dict[str, Any]]:
    """Returns filtered signed audit logs."""
    logs = read_logs(limit=2000)
    from_dt = _to_dt(from_ts)
    to_dt = _to_dt(to_ts)
    signature_filter = signature.lower().strip()

    filtered: list[dict[str, Any]] = []
    for item in logs:
        item_risk = str(item.get("risk_level", "")).upper()
        item_decision = str(item.get("decision", "")).upper()
        item_tool = str(item.get("tool_name", ""))
        item_agent = str(item.get("agent_id", ""))
        item_sig = item.get("_signature_valid")
        ts = _to_dt(item.get("timestamp"))

        if risk and item_risk != risk.upper():
            continue
        if decision and item_decision != decision.upper():
            continue
        if tool and tool.lower() not in item_tool.lower():
            continue
        if agent and agent.lower() not in item_agent.lower():
            continue
        if from_dt and (ts is None or ts < from_dt):
            continue
        if to_dt and (ts is None or ts > to_dt):
            continue

        if signature_filter == "valid" and item_sig is not True:
            continue
        if signature_filter == "invalid" and item_sig is not False:
            continue

        if search:
            haystack = " ".join(
                [
                    item_tool,
                    str(item.get("analysis", "")),
                    str(item.get("user_intent", "")),
                    str(item.get("raw_command", "")),
                    str(item.get("args", {})),
                ]
            ).lower()
            if search.lower() not in haystack:
                continue

        filtered.append(item)
        if len(filtered) >= limit:
            break

    return filtered


@router.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok", "service": "agent-lock"}
