"""
POST /intercept

Punto de entrada principal: el plugin de OpenClaw llama este endpoint
cuando intercepta un tool call. El backend:
1. Valida la intención con Gemini Flash (si hay user_intent real)
2. Clasifica el riesgo (reglas + contenido + Gemini + políticas)
3. Si LOW → aprueba automáticamente con token Auth0
4. Si HIGH/CRITICAL → manda notificación Telegram y pone en PENDING
"""
import logging
from datetime import datetime, timezone

from fastapi import APIRouter

from models import (
    ToolCallRequest, InterceptResponse,
    ActionStatus, PendingAction,
)
from engine.intent_validator import validate_intent
from engine.risk_classifier import classify_risk
from auth.token_vault import request_token
from notifications.telegram_bot import send_approval_request
from audit.audit_logger import write_log
from models import RiskLevel
import store

router = APIRouter()
logger = logging.getLogger("agent-lock.intercept")


@router.post("/intercept", response_model=InterceptResponse)
async def intercept_tool_call(payload: ToolCallRequest) -> InterceptResponse:
    intent_preview = payload.user_intent[:80] if payload.user_intent else "(vacío)"
    logger.info(f"⚡ Intercept | tool={payload.tool_name} | intent='{intent_preview}'")

    # ── 1. Validar intención con Gemini ───────────────────────────────────────
    intent_result = await validate_intent(
        user_intent=payload.user_intent,
        tool_name=payload.tool_name,
        args=payload.args,
        raw_command=payload.raw_command,
    )

    gemini_tag = "🧠 Gemini" if intent_result.gemini_used else "📋 Reglas"

    # ── 2. Clasificar riesgo ──────────────────────────────────────────────────
    risk_level = classify_risk(
        tool_name=payload.tool_name,
        args=payload.args,
        raw_command=payload.raw_command,
        intent_result=intent_result,
    )

    logger.info(
        f"🎯 Riesgo={risk_level.value} | Score={intent_result.score:.2f} | "
        f"Motor={gemini_tag} | Contradicciones={len(intent_result.contradictions)}"
    )

    # ── 3. Crear la acción pendiente ──────────────────────────────────────────
    action = PendingAction(
        tool_name=payload.tool_name,
        args=payload.args,
        user_intent=payload.user_intent,
        agent_id=payload.agent_id,
        session_key=payload.session_key,
        raw_command=payload.raw_command,
        risk_level=risk_level,
        intent_score=intent_result.score,
        analysis=intent_result.analysis,
    )

    # ── 4. LOW → auto-aprobar ─────────────────────────────────────────────────
    if risk_level == RiskLevel.LOW:
        auth_token = await request_token(payload.tool_name, payload.args, risk_level)
        action.status = ActionStatus.AUTO_APPROVED
        action.decided_at = datetime.now(timezone.utc)
        action.auth_token = auth_token
        store.save(action)
        write_log(action)
        logger.info(f"✅ Auto-aprobado (LOW) | action_id={action.action_id} | tool={payload.tool_name}")
        return InterceptResponse(
            action_id=action.action_id,
            status=ActionStatus.AUTO_APPROVED,
            risk_level=risk_level,
            intent_score=intent_result.score,
            analysis=intent_result.analysis,
            auth_token=auth_token,
        )

    # ── 5. HIGH/CRITICAL → notificar y dejar en PENDING ──────────────────────
    store.save(action)

    await send_approval_request(
        action_id=action.action_id,
        tool_name=payload.tool_name,
        args=payload.args,
        user_intent=payload.user_intent,
        risk_level=risk_level,
        intent_score=intent_result.score,
        analysis=intent_result.analysis,
    )

    logger.info(
        f"⏳ Esperando aprobación | action_id={action.action_id} | "
        f"riesgo={risk_level.value} | tool={payload.tool_name}"
    )
    return InterceptResponse(
        action_id=action.action_id,
        status=ActionStatus.PENDING,
        risk_level=risk_level,
        intent_score=intent_result.score,
        analysis=intent_result.analysis,
    )
