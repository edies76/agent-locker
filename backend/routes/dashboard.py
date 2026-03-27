"""
Dashboard API Routes

Endpoints consumed exclusively by the Agent-Lock web dashboard.

GET  /dashboard/stats      — Aggregate counters (total, approved, blocked, etc.)
GET  /dashboard/trends     — Time-series data for charts (24h window)
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


def _read_mcp_config() -> dict[str, Any]:
    if not _mcp_config_path.exists():
        return {"target_servers": []}
    with open(_mcp_config_path, "r", encoding="utf-8") as f:
        return json.load(f)


def _write_mcp_config(config: dict[str, Any]) -> None:
    _mcp_config_path.parent.mkdir(parents=True, exist_ok=True)
    with open(_mcp_config_path, "w", encoding="utf-8") as f:
        json.dump(config, f, indent=2)


# ── Stats ─────────────────────────────────────────────────────────────────────


@router.get("/stats")
async def get_stats() -> dict[str, Any]:
    """
    Return aggregate counters built from the audit log + live store.

    Risk breakdown and timeline histogram are included so the dashboard
    can render charts without a second request.
    """
    try:
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
    except Exception as exc:
        logger.error(f"Error fetching stats: {exc}", exc_info=True)
        # Return safe defaults instead of crashing
        return {
            "total": 0,
            "auto_approved": 0,
            "human_approved": 0,
            "blocked": 0,
            "pending": 0,
            "risk_breakdown": {r.value: 0 for r in RiskLevel},
            "signature_failures": 0,
            "error": str(exc),
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
    try:
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
    except Exception as exc:
        logger.error(f"Error fetching activity: {exc}", exc_info=True)
        return []


# ── Trends (24h time-series) ──────────────────────────────────────────────────


@router.get("/trends")
async def get_trends(hours: int = Query(default=24, ge=1, le=168)) -> dict[str, Any]:
    """
    Return time-series data for charts (actions per hour, approval rate, avg response time).
    
    Args:
        hours: Number of hours to look back (default 24, max 168 = 7 days)
    
    Returns:
        {
            "actions_per_hour": [{"timestamp": <ms>, "value": <count>}, ...],
            "approval_rate": [{"timestamp": <ms>, "value": <0-1>}, ...],
            "avg_response_time": [{"timestamp": <ms>, "value": <seconds>}, ...],
            "critical_actions": [{"timestamp": <ms>, "value": <count>}, ...]
        }
    """
    try:
        from collections import defaultdict
        from datetime import timedelta
        
        now = datetime.now(timezone.utc)
        cutoff = now - timedelta(hours=hours)
        
        # Read all logs within time window
        logs = read_logs(limit=1000)
        pending = store.all_pending()
        
        # Filter by timestamp
        filtered_logs = []
        for l in logs:
            try:
                ts_str = l.get("timestamp", "")
                ts = datetime.fromisoformat(ts_str.replace("Z", "+00:00"))
                if ts >= cutoff:
                    filtered_logs.append(l)
            except (ValueError, AttributeError):
                continue
        
        # Group by hour buckets
        hour_buckets = defaultdict(lambda: {
            "count": 0,
            "approved": 0,
            "response_times": [],
            "critical": 0
        })
        
        for l in filtered_logs:
            try:
                ts_str = l.get("timestamp", "")
                ts = datetime.fromisoformat(ts_str.replace("Z", "+00:00"))
                # Round to hour bucket
                bucket_ts = ts.replace(minute=0, second=0, microsecond=0)
                bucket_ms = int(bucket_ts.timestamp() * 1000)
                
                hour_buckets[bucket_ms]["count"] += 1
                
                decision = l.get("decision", "")
                if decision in ["APPROVED", "AUTO_APPROVED"]:
                    hour_buckets[bucket_ms]["approved"] += 1
                
                if l.get("risk_level") == "CRITICAL":
                    hour_buckets[bucket_ms]["critical"] += 1
                
                # Calculate response time if available
                created_str = l.get("timestamp", "")
                decided_str = l.get("decided_at", "")
                if created_str and decided_str:
                    try:
                        created = datetime.fromisoformat(created_str.replace("Z", "+00:00"))
                        decided = datetime.fromisoformat(decided_str.replace("Z", "+00:00"))
                        response_time = (decided - created).total_seconds()
                        if 0 <= response_time <= 3600:  # Sanity check (max 1 hour)
                            hour_buckets[bucket_ms]["response_times"].append(response_time)
                    except (ValueError, AttributeError):
                        pass
            except Exception:
                continue
        
        # Convert to lists
        actions_per_hour = []
        approval_rate = []
        avg_response_time = []
        critical_actions = []
        
        # Fill in all hour buckets (even empty ones)
        for i in range(hours + 1):
            bucket_time = now - timedelta(hours=hours - i)
            bucket_time = bucket_time.replace(minute=0, second=0, microsecond=0)
            bucket_ms = int(bucket_time.timestamp() * 1000)
            
            data = hour_buckets.get(bucket_ms, {
                "count": 0,
                "approved": 0,
                "response_times": [],
                "critical": 0
            })
            
            actions_per_hour.append({"timestamp": bucket_ms, "value": data["count"]})
            
            # Approval rate (0-1)
            rate = data["approved"] / data["count"] if data["count"] > 0 else 0
            approval_rate.append({"timestamp": bucket_ms, "value": rate})
            
            # Average response time
            avg_time = (
                sum(data["response_times"]) / len(data["response_times"])
                if data["response_times"]
                else 0
            )
            avg_response_time.append({"timestamp": bucket_ms, "value": avg_time})
            
            critical_actions.append({"timestamp": bucket_ms, "value": data["critical"]})
        
        return {
            "actions_per_hour": actions_per_hour,
            "approval_rate": approval_rate,
            "avg_response_time": avg_response_time,
            "critical_actions": critical_actions,
        }
    
    except Exception as exc:
        logger.error(f"Error calculating trends: {exc}", exc_info=True)
        # Return empty data
        return {
            "actions_per_hour": [],
            "approval_rate": [],
            "avg_response_time": [],
            "critical_actions": [],
            "error": str(exc),
        }


# ── Pending actions ───────────────────────────────────────────────────────────


@router.get("/pending")
async def get_pending() -> list[dict[str, Any]]:
    """
    Return only the actions currently awaiting human approval.
    Polled every ~1 s by the dashboard approval panel.
    """
    try:
        return [_action_to_dict(a) for a in store.all_pending()]
    except Exception as exc:
        logger.error(f"Error fetching pending actions: {exc}", exc_info=True)
        return []


@router.get("/activity/{action_id}")
async def get_activity_item(action_id: str) -> dict[str, Any]:
    """Return full details for a single action id from store/log plus execution info."""
    try:
        # Validate action_id format
        if not action_id or len(action_id) > 100:
            return {
                "action_id": action_id,
                "error": "Invalid action_id format",
                "execution": {},
            }
        
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
    except Exception as exc:
        logger.error(f"Error fetching activity item {action_id}: {exc}", exc_info=True)
        return {
            "action_id": action_id,
            "error": f"Internal error: {str(exc)}",
            "execution": {},
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
    timings_ms: dict[str, float] = {}
    benchmark: dict[str, Any] = {}


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
        "timings_ms": payload.timings_ms,
        "benchmark": payload.benchmark,
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }
    return {"status": "ok"}


@router.get("/mcp/status")
async def get_mcp_status() -> dict[str, Any]:
    """
    Return the latest MCP gateway heartbeat and a staleness flag.
    The dashboard uses this to show the green/red connection dot.
    """
    try:
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
    except Exception as exc:
        logger.error(f"Error fetching MCP status: {exc}", exc_info=True)
        return {
            "connected": False,
            "last_seen": None,
            "seconds_ago": None,
            "info": {},
            "error": str(exc),
        }


@router.get("/mcp/timings")
async def get_mcp_timings(limit: int = Query(default=100, ge=1, le=1000)) -> dict[str, Any]:
    """Return aggregate timing metrics to estimate Agent-Lock latency overhead."""
    items = list(_mcp_executions.values())
    items.sort(key=lambda x: x.get("updated_at", ""), reverse=True)
    sample = items[:limit]

    def _collect(key: str) -> list[float]:
        values: list[float] = []
        for item in sample:
            v = item.get("timings_ms", {}).get(key)
            if isinstance(v, (int, float)):
                values.append(float(v))
        return values

    def _avg(values: list[float]) -> float | None:
        if not values:
            return None
        return round(sum(values) / len(values), 2)

    totals = _collect("total_gateway_ms")
    validations = _collect("validation_wait_ms")
    targets = _collect("target_exec_ms")
    baselines = _collect("baseline_direct_ms")
    overheads = _collect("agent_lock_overhead_ms")

    return {
        "sample_size": len(sample),
        "with_total": len(totals),
        "with_baseline": len(baselines),
        "average_ms": {
            "total_gateway_ms": _avg(totals),
            "validation_wait_ms": _avg(validations),
            "target_exec_ms": _avg(targets),
            "baseline_direct_ms": _avg(baselines),
            "agent_lock_overhead_ms": _avg(overheads),
        },
        "latest": sample[:20],
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
    except FileNotFoundError:
        logger.warning(f"MCP config file not found: {_mcp_config_path}")
    except json.JSONDecodeError as exc:
        logger.error(f"Invalid JSON in MCP config: {exc}")
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


class MCPTargetTogglePayload(BaseModel):
    enabled: bool


@router.post("/mcp/targets/{server_name}/toggle")
async def toggle_mcp_target(server_name: str, payload: MCPTargetTogglePayload) -> dict[str, Any]:
    """Enable or disable a configured MCP target server."""
    try:
        target_name = server_name.strip()
        if not target_name:
            return {"ok": False, "error": "Invalid server name"}

        config = _read_mcp_config()
        target_servers = config.get("target_servers", [])

        updated = False
        for server in target_servers:
            if (server.get("name") or "").strip() == target_name:
                server["enabled"] = payload.enabled
                updated = True
                break

        if not updated:
            return {"ok": False, "error": "Server not found in config"}

        config["target_servers"] = target_servers
        _write_mcp_config(config)
        return {"ok": True, "server": target_name, "enabled": payload.enabled}
    except json.JSONDecodeError as exc:
        logger.error(f"Invalid MCP config JSON: {exc}", exc_info=True)
        return {"ok": False, "error": "Invalid MCP config JSON"}
    except Exception as exc:
        logger.error(f"Error toggling MCP target {server_name}: {exc}", exc_info=True)
        return {"ok": False, "error": str(exc)}


@router.get("/mcp/diagnostics")
async def get_mcp_diagnostics() -> dict[str, Any]:
    """Return diagnostics and recommendations for MCP connectivity/performance."""
    try:
        status = await get_mcp_status()
        timings = await get_mcp_timings(limit=300)
        targets = await get_mcp_targets()

        warnings: list[str] = []
        recommendations: list[str] = []

        connected = bool(status.get("connected"))
        seconds_ago = status.get("seconds_ago")
        if not connected:
            warnings.append("MCP gateway appears offline.")
            recommendations.append("Verify the MCP server process and heartbeat path.")
        elif isinstance(seconds_ago, (int, float)) and seconds_ago > 30:
            warnings.append("Heartbeat is stale (>30s).")
            recommendations.append("Check network latency or heartbeat scheduling.")

        avg = timings.get("average_ms", {})
        total_ms = avg.get("total_gateway_ms")
        overhead_ms = avg.get("agent_lock_overhead_ms")
        if isinstance(total_ms, (int, float)) and total_ms > 1500:
            warnings.append("High gateway latency detected.")
            recommendations.append("Reduce expensive tools or inspect backend load.")
        if isinstance(overhead_ms, (int, float)) and overhead_ms > 600:
            warnings.append("Agent-Lock overhead is higher than expected.")
            recommendations.append("Profile validation and policy evaluation paths.")

        servers = targets.get("servers", [])
        disconnected_enabled = [
            s.get("name")
            for s in servers
            if bool(s.get("enabled")) and not bool(s.get("connected"))
        ]
        if disconnected_enabled:
            warnings.append("Some enabled MCP targets are disconnected.")
            recommendations.append("Verify command paths and server startup scripts.")

        return {
            "connected": connected,
            "seconds_ago": seconds_ago,
            "config_path": targets.get("config_path"),
            "configured_count": targets.get("configured_count", 0),
            "connected_count": targets.get("connected_count", 0),
            "timings": avg,
            "disconnected_enabled": disconnected_enabled,
            "warnings": warnings,
            "recommendations": recommendations,
            "healthy": len(warnings) == 0,
        }
    except Exception as exc:
        logger.error(f"Error collecting MCP diagnostics: {exc}", exc_info=True)
        return {
            "healthy": False,
            "warnings": ["Diagnostics unavailable due to internal error."],
            "recommendations": ["Check backend logs for diagnostics failure."],
            "error": str(exc),
        }
