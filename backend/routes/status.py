"""
GET /status/{action_id}

El plugin de OpenClaw hace polling a este endpoint cada 2 segundos
mientras espera la decisión del usuario en Telegram.
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
        raise HTTPException(status_code=404, detail=f"Acción '{action_id}' no encontrada.")

    return StatusResponse(
        action_id=action.action_id,
        status=action.status,
        auth_token=action.auth_token,
        decided_at=action.decided_at,
    )
