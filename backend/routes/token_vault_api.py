from __future__ import annotations

import base64
import logging
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from typing import Any

import httpx
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, Field

from auth.sessions import get_session
from auth.token_vault import exchange_for_provider_token
from config import get_settings

router = APIRouter(prefix="/vault", tags=["Token Vault"])
logger = logging.getLogger("agent-lock.token-vault-api")
settings = get_settings()


def _resolve_subject_token(request: Request) -> str | None:
    """
    Resolve user subject token in priority order:
    1) Authorization Bearer token (middleware sets request.state.subject_token)
    2) Server-side session cookie stored by /auth/callback
    """
    bearer = getattr(request.state, "subject_token", None)
    if bearer:
        return bearer

    sid = request.cookies.get(settings.session_cookie_name)
    if not sid:
        return None
    sess = get_session(sid)
    if not sess:
        return None
    return sess.access_token


@router.get("/status")
async def token_vault_status(request: Request) -> dict[str, Any]:
    subject_token = _resolve_subject_token(request)
    return {
        "enabled": settings.auth0_token_vault_enabled,
        "auth0_configured": bool(
            settings.auth0_domain and settings.auth0_client_id and settings.auth0_client_secret
        ),
        "authenticated": bool(subject_token),
        "login_url": f"{settings.backend_url}/auth/login?connection={settings.auth0_google_connection_name}",
        "connections": {
            "google": settings.auth0_google_connection_name,
            "github": settings.auth0_github_connection_name,
            "slack": settings.auth0_slack_connection_name,
        },
    }


class GmailSendRequest(BaseModel):
    to: str = Field(..., description="Destination email")
    subject: str = Field(..., min_length=1, max_length=300)
    body_text: str = Field(..., min_length=1, max_length=20000)
    body_html: str | None = Field(default=None, max_length=40000)


def _build_gmail_raw_message(payload: GmailSendRequest) -> str:
    msg = MIMEMultipart("alternative")
    msg["To"] = payload.to
    msg["Subject"] = payload.subject
    msg.attach(MIMEText(payload.body_text, "plain", "utf-8"))
    if payload.body_html:
        msg.attach(MIMEText(payload.body_html, "html", "utf-8"))
    raw_bytes = msg.as_bytes()
    return base64.urlsafe_b64encode(raw_bytes).decode("utf-8").rstrip("=")


@router.post("/google/gmail/send")
async def gmail_send(request: Request, body: GmailSendRequest) -> dict[str, Any]:
    """
    Brokered Gmail send endpoint:
    - Agent-Lock exchanges Auth0 subject token for Google token from Token Vault
    - Agent-Lock calls Gmail API directly
    - No external token is returned to callers
    """
    if not settings.auth0_token_vault_enabled:
        raise HTTPException(status_code=503, detail="Token Vault is disabled.")

    subject_token = _resolve_subject_token(request)
    if not subject_token:
        raise HTTPException(
            status_code=401,
            detail={
                "error": "auth_required",
                "message": "User authentication is required for Gmail brokered calls.",
                "login_url": f"{settings.backend_url}/auth/login?connection={settings.auth0_google_connection_name}",
            },
        )

    external = await exchange_for_provider_token(
        subject_token=subject_token,
        connection=settings.auth0_google_connection_name,
    )
    if not external:
        raise HTTPException(
            status_code=502,
            detail=(
                "Token Vault exchange failed for Google. Ensure Connected Account exists and "
                "Auth0 Token Vault access-token exchange is configured."
            ),
        )

    raw_message = _build_gmail_raw_message(body)
    gmail_url = "https://gmail.googleapis.com/gmail/v1/users/me/messages/send"

    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            response = await client.post(
                gmail_url,
                headers={
                    "Authorization": f"Bearer {external.access_token}",
                    "Content-Type": "application/json",
                },
                json={"raw": raw_message},
            )
            response.raise_for_status()
            data = response.json()
    except httpx.HTTPStatusError as e:
        logger.error("Gmail API HTTP %s: %s", e.response.status_code, e.response.text)
        raise HTTPException(
            status_code=502,
            detail=f"Gmail API failed: HTTP {e.response.status_code}",
        )
    except httpx.RequestError as e:
        logger.error("Gmail API connection error: %s", e)
        raise HTTPException(status_code=502, detail=f"Gmail API connection failed: {e}")

    return {
        "ok": True,
        "provider": "google",
        "operation": "gmail.send",
        "message_id": data.get("id"),
        "thread_id": data.get("threadId"),
        "token_vault": {
            "connection": external.connection,
            "issued_token_type": external.issued_token_type,
            "expires_in": external.expires_in,
        },
    }

