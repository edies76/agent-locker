"""
Settings API Routes

Exposes current Agent-Lock configuration to the dashboard (read-only
for sensitive fields) and allows limited live updates.

GET  /settings              — Masked summary of all config values
GET  /settings/policies     — Current policies.json content
PUT  /settings/policies     — Save updated policies.json
POST /settings/telegram/test — Send a test message to the configured chat
"""

from __future__ import annotations

import json
import logging
import os
from typing import Any

import httpx
from config import get_settings
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

router = APIRouter(prefix="/settings", tags=["Settings"])
logger = logging.getLogger("agent-lock.settings")

_POLICIES_PATH = os.path.join(os.path.dirname(__file__), "..", "policies.json")


# ── Helpers ───────────────────────────────────────────────────────────────────


def _mask(value: str | None, visible: int = 8) -> str | None:
    """Return the first `visible` chars of a secret followed by '...'."""
    if not value:
        return None
    if len(value) <= visible:
        return "*" * len(value)
    return value[:visible] + "..."


# ── GET /settings ─────────────────────────────────────────────────────────────


@router.get("")
async def get_settings_view() -> dict[str, Any]:
    """
    Return a masked summary of the current runtime configuration.

    Sensitive values (tokens, secrets) are truncated so the dashboard
    can show whether they are configured without leaking them.
    """
    s = get_settings()

    return {
        "telegram": {
            "configured": bool(s.telegram_bot_token and s.telegram_chat_id),
            "bot_token_preview": _mask(s.telegram_bot_token),
            "chat_id": s.telegram_chat_id or None,
        },
        "gemini": {
            "configured": bool(s.gemini_api_key),
            "key_preview": _mask(s.gemini_api_key),
        },
        "auth0": {
            "configured": bool(s.auth0_domain and s.auth0_client_id),
            "domain": s.auth0_domain or None,
            "audience": s.auth0_audience,
            "client_id_preview": _mask(s.auth0_client_id),
            "callback_url": s.auth0_callback_url,
            "scope": s.auth0_scope,
        },
        "server": {
            "backend_url": s.backend_url,
            "port": s.backend_port,
            "audit_log_path": s.audit_log_path,
        },
        "security": {
            "secret_key_is_default": s.secret_key
            == "dev-secret-key-change-in-production",
        },
    }


# ── GET /settings/policies ────────────────────────────────────────────────────


@router.get("/policies")
async def get_policies() -> dict[str, Any]:
    """Return the current contents of policies.json."""
    if not os.path.exists(_POLICIES_PATH):
        return {"policies": [], "global_config": {}}
    try:
        with open(_POLICIES_PATH, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception as exc:
        raise HTTPException(
            status_code=500, detail=f"Could not read policies.json: {exc}"
        )


# ── PUT /settings/policies ────────────────────────────────────────────────────


class PoliciesPayload(BaseModel):
    policies: list[dict[str, Any]]
    global_config: dict[str, Any] = {}


@router.put("/policies")
async def update_policies(body: PoliciesPayload) -> dict[str, Any]:
    """
    Overwrite policies.json with the supplied content.

    Basic validation: each policy must have at minimum 'id',
    'tool_pattern', 'condition', and 'action' fields.
    """
    required_fields = {"id", "tool_pattern", "condition", "action"}
    for i, policy in enumerate(body.policies):
        missing = required_fields - policy.keys()
        if missing:
            raise HTTPException(
                status_code=422,
                detail=f"Policy at index {i} is missing required fields: {missing}",
            )

    data = {
        "policies": body.policies,
        "global_config": body.global_config,
    }

    try:
        with open(_POLICIES_PATH, "w", encoding="utf-8") as f:
            json.dump(data, f, indent=2, ensure_ascii=False)
        logger.info(f"policies.json updated — {len(body.policies)} policies saved.")
        return {"ok": True, "count": len(body.policies)}
    except Exception as exc:
        raise HTTPException(
            status_code=500, detail=f"Could not write policies.json: {exc}"
        )


# ── POST /settings/telegram/test ─────────────────────────────────────────────


@router.post("/telegram/test")
async def test_telegram() -> dict[str, Any]:
    """
    Send a test message to the configured Telegram chat.

    Uses the bot token and chat ID currently loaded in Settings.
    Returns success/failure so the dashboard can show immediate feedback.
    """
    s = get_settings()

    if not s.telegram_bot_token:
        raise HTTPException(
            status_code=400, detail="TELEGRAM_BOT_TOKEN is not configured."
        )
    if not s.telegram_chat_id:
        raise HTTPException(
            status_code=400, detail="TELEGRAM_CHAT_ID is not configured."
        )

    url = f"https://api.telegram.org/bot{s.telegram_bot_token}/sendMessage"
    payload = {
        "chat_id": s.telegram_chat_id,
        "text": (
            "🦞 <b>Agent-Lock</b> — Test message\n\n"
            "✅ Your Telegram notifications are working correctly!\n"
            "You will receive approval requests here when the agent "
            "attempts a HIGH or CRITICAL risk action."
        ),
        "parse_mode": "HTML",
    }

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.post(url, json=payload)
            data = resp.json()

        if data.get("ok"):
            logger.info("Telegram test message sent successfully.")
            return {"ok": True, "message": "Test message sent to Telegram ✅"}
        else:
            description = data.get("description", "Unknown Telegram error")
            logger.warning(f"Telegram test failed: {description}")
            raise HTTPException(
                status_code=502, detail=f"Telegram API error: {description}"
            )

    except HTTPException:
        raise
    except Exception as exc:
        logger.error(f"Telegram test request failed: {exc}")
        raise HTTPException(status_code=502, detail=f"Could not reach Telegram: {exc}")
