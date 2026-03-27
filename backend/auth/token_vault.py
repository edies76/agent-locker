"""
Auth0 Token Vault integration for Agent-Lock.

This module implements two distinct token strategies:
1) M2M scoped token (client_credentials) for internal Agent-Lock API scope mapping.
2) Real Auth0 Token Vault exchange for connected accounts using:
   urn:auth0:params:oauth:grant-type:token-exchange:federated-connection-access-token

Use Token Vault exchange whenever an action must run on behalf of a user
(Gmail, Calendar, GitHub, Slack, etc.). In that mode, Agent-Lock should call
the external API itself and return results, not raw tokens, whenever possible.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass

import httpx

from config import get_settings
from models import RiskLevel

logger = logging.getLogger("agent-lock.token-vault")
settings = get_settings()

# ── Constants ──────────────────────────────────────────────────────────────────

AUTH0_VAULT_GRANT = (
    "urn:auth0:params:oauth:grant-type:token-exchange:federated-connection-access-token"
)
AUTH0_VAULT_REQUESTED_TOKEN_TYPE = (
    "http://auth0.com/oauth/token-type/federated-connection-access-token"
)
IETF_ACCESS_TOKEN_TYPE = "urn:ietf:params:oauth:token-type:access_token"


# ── Tool-to-scope mapping for generic M2M fallback ────────────────────────────

TOOL_SCOPE_MAP: dict[str, str] = {
    # Read
    "read_file": "read:files",
    "list_files": "read:files",
    "search_files": "read:files",
    "web_search": "read:web",
    # Write
    "write_file": "write:files",
    # DB
    "database.query": "read:db",
    "database.read": "read:db",
    "database.write": "write:db",
    # Integrations
    "send_email": "send:email",
    "http_request": "http:request",
    # Admin
    "execute_code": "admin:execute",
    "run_command": "admin:execute",
    "bash": "admin:execute",
    "delete_file": "admin:delete",
}


USER_AUTH_REQUIRED_KEYWORDS = (
    "email",
    "gmail",
    "mail",
    "calendar",
    "drive",
    "slack",
    "github",
    "notion",
    "office365",
    "outlook",
)

EMAIL_CONNECTOR_PATTERNS = (
    "smtp",
    "gmail",
    "sendmail",
    "send-email",
    "send_email",
    "mailgun",
    "resend",
    "gog send",
    "gog",
)

CALENDAR_CONNECTOR_PATTERNS = (
    "calendar",
    "gcal",
    "google-calendar",
)

GITHUB_CONNECTOR_PATTERNS = (
    "github",
    "gh ",
    "octokit",
)

SLACK_CONNECTOR_PATTERNS = (
    "slack",
)

EXEC_LIKE_TOOLS = {
    "exec",
    "bash",
    "terminal",
    "run_command",
    "execute_code",
}


@dataclass(frozen=True)
class ExternalToken:
    access_token: str
    token_type: str
    expires_in: int | None
    scope: str | None
    issued_token_type: str | None
    connection: str


def _flatten_args_for_matching(args: dict) -> str:
    parts: list[str] = []
    for v in args.values():
        if isinstance(v, str):
            parts.append(v)
        elif isinstance(v, dict):
            parts.append(_flatten_args_for_matching(v))
        elif isinstance(v, (list, tuple)):
            parts.extend(str(item) for item in v)
        else:
            parts.append(str(v))
    return " ".join(parts).lower()


def _is_pattern_match(tool_name: str, args: dict, patterns: tuple[str, ...]) -> bool:
    t = (tool_name or "").strip().lower()
    text = _flatten_args_for_matching(args)
    if any(p in t for p in patterns):
        return True
    if t in EXEC_LIKE_TOOLS and any(p in text for p in patterns):
        return True
    return False


def _is_email_connector_call(tool_name: str, args: dict) -> bool:
    t = (tool_name or "").strip().lower()
    if "send_email" in t or "send-email" in t:
        return True
    return _is_pattern_match(tool_name, args, EMAIL_CONNECTOR_PATTERNS)


def _is_calendar_connector_call(tool_name: str, args: dict) -> bool:
    return _is_pattern_match(tool_name, args, CALENDAR_CONNECTOR_PATTERNS)


def _is_github_connector_call(tool_name: str, args: dict) -> bool:
    return _is_pattern_match(tool_name, args, GITHUB_CONNECTOR_PATTERNS)


def _is_slack_connector_call(tool_name: str, args: dict) -> bool:
    return _is_pattern_match(tool_name, args, SLACK_CONNECTOR_PATTERNS)


def provider_connection_for_tool(tool_name: str, args: dict) -> str | None:
    """
    Resolve the connected-account connection name required by Auth0 Token Vault.
    """
    if _is_email_connector_call(tool_name, args) or _is_calendar_connector_call(tool_name, args):
        return settings.auth0_google_connection_name or "google-oauth2"
    if _is_github_connector_call(tool_name, args):
        return settings.auth0_github_connection_name or "github"
    if _is_slack_connector_call(tool_name, args):
        return settings.auth0_slack_connection_name or "slack"
    return None


def requires_user_auth(tool_name: str, args: dict) -> bool:
    """
    Returns True when a tool should require an authenticated end-user context.
    """
    if provider_connection_for_tool(tool_name, args):
        return True

    t = (tool_name or "").strip().lower()
    if any(k in t for k in USER_AUTH_REQUIRED_KEYWORDS):
        return True
    return False


def get_scope_for_tool(tool_name: str, args: dict, risk_level: RiskLevel) -> str:
    if _is_email_connector_call(tool_name, args):
        return "send:email"
    if _is_calendar_connector_call(tool_name, args):
        return "calendar:write"
    if _is_github_connector_call(tool_name, args):
        return "repo:write"
    if _is_slack_connector_call(tool_name, args):
        return "chat:write"

    base_scope = TOOL_SCOPE_MAP.get(tool_name, "read:generic")

    if tool_name == "database.query":
        query_text = " ".join(str(v) for v in args.values()).upper()
        if any(kw in query_text for kw in ["INSERT", "UPDATE", "MERGE", "REPLACE"]):
            base_scope = "write:db"
        elif any(kw in query_text for kw in ["DELETE", "DROP", "TRUNCATE"]):
            base_scope = "admin:db"

    return base_scope


def get_audience_for_tool(tool_name: str, args: dict) -> str:
    if _is_email_connector_call(tool_name, args) or _is_calendar_connector_call(tool_name, args):
        return settings.auth0_google_audience
    return settings.auth0_audience


def _is_auth0_configured() -> bool:
    return bool(settings.auth0_domain and settings.auth0_client_id and settings.auth0_client_secret)


async def exchange_for_provider_token(
    *,
    subject_token: str,
    connection: str,
) -> ExternalToken | None:
    """
    Exchange a user Auth0 access token for an external provider token from Token Vault.
    """
    if not _is_auth0_configured():
        logger.warning("Auth0 not configured for Token Vault exchange.")
        return None

    token_url = f"https://{settings.auth0_domain}/oauth/token"
    payload = {
        "grant_type": AUTH0_VAULT_GRANT,
        "client_id": settings.auth0_client_id,
        "client_secret": settings.auth0_client_secret,
        "subject_token": subject_token,
        "subject_token_type": IETF_ACCESS_TOKEN_TYPE,
        "requested_token_type": AUTH0_VAULT_REQUESTED_TOKEN_TYPE,
        "connection": connection,
    }

    try:
        async with httpx.AsyncClient(timeout=12.0) as client:
            response = await client.post(token_url, json=payload)
            response.raise_for_status()
            data = response.json()
    except httpx.HTTPStatusError as e:
        logger.error(
            "Auth0 Token Vault exchange failed HTTP %s: %s",
            e.response.status_code,
            e.response.text,
        )
        return None
    except httpx.RequestError as e:
        logger.error("Auth0 Token Vault exchange connection error: %s", e)
        return None

    access_token = data.get("access_token")
    if not access_token:
        logger.error("Auth0 Token Vault exchange returned no access_token.")
        return None

    token = ExternalToken(
        access_token=access_token,
        token_type=data.get("token_type", "Bearer"),
        expires_in=data.get("expires_in"),
        scope=data.get("scope"),
        issued_token_type=data.get("issued_token_type"),
        connection=connection,
    )
    logger.info(
        "Token Vault exchange success | connection=%s | expires_in=%s",
        connection,
        token.expires_in,
    )
    return token


async def request_token(
    tool_name: str,
    args: dict,
    risk_level: RiskLevel,
    subject_token: str | None = None,
) -> str | None:
    """
    Request a token for a tool execution.

    Behavior:
    - For user-connected providers, use Auth0 Token Vault exchange.
    - Otherwise fallback to scoped M2M token for internal Agent-Lock APIs.
    """
    if not _is_auth0_configured():
        logger.warning(
            "Auth0 not configured. Action will continue without Agent-Lock token support."
        )
        return None

    connection = provider_connection_for_tool(tool_name, args)
    if connection:
        if not settings.auth0_token_vault_enabled:
            logger.warning("Token Vault is disabled via AUTH0_TOKEN_VAULT_ENABLED.")
            return None
        if not subject_token:
            logger.warning(
                "Token Vault requires subject_token but none provided | tool=%s",
                tool_name,
            )
            return None
        provider_token = await exchange_for_provider_token(
            subject_token=subject_token,
            connection=connection,
        )
        return provider_token.access_token if provider_token else None

    # Fallback: M2M scoped token for generic backend-protected APIs
    scope = get_scope_for_tool(tool_name, args, risk_level)
    audience = get_audience_for_tool(tool_name, args)
    token_url = f"https://{settings.auth0_domain}/oauth/token"
    payload = {
        "grant_type": "client_credentials",
        "client_id": settings.auth0_client_id,
        "client_secret": settings.auth0_client_secret,
        "audience": audience,
        "scope": scope,
    }

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.post(token_url, json=payload)
            response.raise_for_status()
            data = response.json()
            access_token = data.get("access_token")
            logger.info(
                "M2M token issued | tool=%s | audience=%s | scope=%s | expires_in=%ss",
                tool_name,
                audience,
                scope,
                data.get("expires_in"),
            )
            return access_token
    except httpx.HTTPStatusError as e:
        logger.error("Auth0 M2M HTTP %s: %s", e.response.status_code, e.response.text)
        return None
    except httpx.RequestError as e:
        logger.error("Auth0 M2M connection error: %s", e)
        return None

