"""
POST /approve/{action_id}

Llamado desde el bot de Telegram cuando el usuario presiona YES o NO.
Actualiza el estado de la acción y registra la decisión en el audit log.
"""
import logging
from datetime import datetime, timezone

from fastapi import APIRouter, HTTPException

from models import ApprovalRequest, ApprovalDecision, ActionStatus, StatusResponse
from auth.token_vault import request_token
from notifications.telegram_bot import send_decision_notification
from audit.audit_logger import write_log
import store

router = APIRouter()
logger = logging.getLogger("agent-lock.approve")


@router.post("/approve/{action_id}", response_model=StatusResponse)
async def approve_action(action_id: str, body: ApprovalRequest) -> StatusResponse:
    action = store.get(action_id)
    if not action:
        raise HTTPException(status_code=404, detail=f"Acción '{action_id}' no encontrada.")

    if action.status != ActionStatus.PENDING:
        raise HTTPException(
            status_code=409,
            detail=f"La acción ya fue procesada con estado: {action.status.value}",
        )

    action.decided_at = datetime.now(timezone.utc)

    if body.decision == ApprovalDecision.YES:
        # Solicitar token Auth0 de mínimos permisos
        auth_token = await request_token(action.tool_name, action.args, action.risk_level)
        action.status = ActionStatus.APPROVED
        action.auth_token = auth_token
        logger.info(f"✅ APROBADO por usuario | action_id={action_id} | tool={action.tool_name}")
    else:
        action.status = ActionStatus.BLOCKED
        logger.info(f"🚫 BLOQUEADO por usuario | action_id={action_id} | tool={action.tool_name}")

    store.update(action)
    write_log(action)

    # Notificar confirmación en Telegram
    await send_decision_notification(action_id, body.decision.value, action.tool_name)

    return StatusResponse(
        action_id=action.action_id,
        status=action.status,
        auth_token=action.auth_token,
        decided_at=action.decided_at,
    )
