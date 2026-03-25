"""
Server-Sent Events (SSE) endpoint for real-time updates

Streams live updates to the dashboard:
- New pending approvals
- Action status changes
- MCP server connections
- System events
"""

import asyncio
import json
import logging
from datetime import datetime, timezone
from typing import AsyncGenerator

from fastapi import APIRouter
from fastapi.responses import StreamingResponse
from sse_starlette.sse import EventSourceResponse

import store
from models import ActionStatus

router = APIRouter(prefix="/events", tags=["SSE"])
logger = logging.getLogger("agent-lock.events")

# Active SSE connections
active_connections: list[asyncio.Queue] = []


async def event_generator() -> AsyncGenerator[dict, None]:
    """Generate SSE events for dashboard updates."""
    queue: asyncio.Queue = asyncio.Queue()
    active_connections.append(queue)
    
    try:
        # Send initial connection event
        yield {
            "event": "connected",
            "data": json.dumps({
                "timestamp": datetime.now(timezone.utc).isoformat(),
                "message": "Connected to Agent-Lock event stream",
            }),
        }
        
        while True:
            # Wait for events with timeout
            try:
                event = await asyncio.wait_for(queue.get(), timeout=30.0)
                yield event
            except asyncio.TimeoutError:
                # Send keepalive ping every 30s
                yield {
                    "event": "ping",
                    "data": json.dumps({"timestamp": datetime.now(timezone.utc).isoformat()}),
                }
    except asyncio.CancelledError:
        logger.info("SSE connection closed by client")
    finally:
        active_connections.remove(queue)


@router.get("/stream")
async def stream_events():
    """
    SSE endpoint for real-time dashboard updates.
    
    Events:
    - connected: Initial connection confirmation
    - ping: Keepalive (every 30s)
    - approval_pending: New approval request
    - approval_decided: Approval/rejection confirmed
    - mcp_connected: MCP server connected
    - mcp_disconnected: MCP server disconnected
    """
    return EventSourceResponse(event_generator())


# Broadcasting functions (called from other routes)

async def broadcast_event(event_type: str, data: dict):
    """Broadcast an event to all connected SSE clients."""
    if not active_connections:
        return
    
    event = {
        "event": event_type,
        "data": json.dumps({
            **data,
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }),
    }
    
    # Send to all connections
    for queue in active_connections:
        try:
            await queue.put(event)
        except Exception as exc:
            logger.warning(f"Failed to send event to connection: {exc}")


async def broadcast_approval_pending(action_id: str, tool_name: str, risk_level: str):
    """Notify dashboard of new pending approval."""
    await broadcast_event("approval_pending", {
        "action_id": action_id,
        "tool_name": tool_name,
        "risk_level": risk_level,
    })


async def broadcast_approval_decided(action_id: str, decision: str):
    """Notify dashboard of approval decision."""
    await broadcast_event("approval_decided", {
        "action_id": action_id,
        "decision": decision,
    })


async def broadcast_mcp_status(connected: bool, server_name: str):
    """Notify dashboard of MCP server status change."""
    event_type = "mcp_connected" if connected else "mcp_disconnected"
    await broadcast_event(event_type, {
        "server_name": server_name,
    })


async def broadcast_stats_update():
    """Notify dashboard that stats should be refreshed."""
    await broadcast_event("stats_updated", {})
