"""
GET /status/{action_id}

The OpenClaw plugin polls this endpoint every 2 seconds
while waiting for the user's decision on Telegram.
"""
import logging
from fastapi import APIRouter, HTTPException
from models import StatusResponse
import store

router = APIRouter()
logger = logging.getLogger("agent-lock.status")


@router.get("/status/{action_id}", response_model=StatusResponse)
async def get_status(action_id: str) -> StatusResponse:
    action = store.get(action_id)
    if not action:
        raise HTTPException(status_code=404, detail=f"Action '{action_id}' not found.")

    return StatusResponse(
        action_id=action.action_id,
        status=action.status,
        auth_token=action.auth_token,
        login_url=action.login_url,
        decided_at=action.decided_at,
    )
