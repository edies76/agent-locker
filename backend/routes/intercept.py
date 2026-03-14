"""
POST /intercept

Main entry point: the OpenClaw plugin calls this endpoint 
when it intercepts a tool call. The backend:
1. Validates intent with Gemini Flash (if real user_intent is available)
2. Classifies risk (rules + content + Gemini + policies)
3. If LOW → automatically approves with Auth0 token
4. If HIGH/CRITICAL → sends Telegram notification and sets to PENDING
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
    intent_preview = payload.user_intent[:80] if payload.user_intent else "(empty)"
    logger.info(f"⚡ Intercept | tool={payload.tool_name} | intent='{intent_preview}'")

    # ── 1. Validate intent with Gemini ────────────────────────────────────────
    intent_result = await validate_intent(
        user_intent=payload.user_intent,
        tool_name=payload.tool_name,
        args=payload.args,
        raw_command=payload.raw_command,
    )

    gemini_tag = "🧠 Gemini" if intent_result.gemini_used else "📋 Rules"

    # ── 2. Classify risk ──────────────────────────────────────────────────────
    risk_level = classify_risk(
        tool_name=payload.tool_name,
        args=payload.args,
        raw_command=payload.raw_command,
        intent_result=intent_result,
    )

    logger.info(
        f"🎯 Risk={risk_level.value} | Score={intent_result.score:.2f} | "
        f"Engine={gemini_tag} | Contradictions={len(intent_result.contradictions)}"
    )

    # ── 3. Create pending action ──────────────────────────────────────────────
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

    # ── 4. LOW → Auto-approve ─────────────────────────────────────────────────
    if risk_level == RiskLevel.LOW:
        auth_token = await request_token(payload.tool_name, payload.args, risk_level)
        action.status = ActionStatus.AUTO_APPROVED
        action.decided_at = datetime.now(timezone.utc)
        action.auth_token = auth_token
        store.save(action)
        write_log(action)
        logger.info(f"✅ Auto-approved (LOW) | action_id={action.action_id} | tool={payload.tool_name}")
        return InterceptResponse(
            action_id=action.action_id,
            status=ActionStatus.AUTO_APPROVED,
            risk_level=risk_level,
            intent_score=intent_result.score,
            analysis=intent_result.analysis,
            auth_token=auth_token,
        )

    # ── 5. HIGH/CRITICAL → Notify and set to PENDING ─────────────────────────
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
        f"⏳ Waiting for approval | action_id={action.action_id} | "
        f"risk={risk_level.value} | tool={payload.tool_name}"
    )
    return InterceptResponse(
        action_id=action.action_id,
        status=ActionStatus.PENDING,
        risk_level=risk_level,
        intent_score=intent_result.score,
        analysis=intent_result.analysis,
    )
