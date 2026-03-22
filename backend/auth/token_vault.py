"""
Auth0 Token Vault Client

Flujo:
1. Solicitar access token a Auth0 usando Client Credentials
2. Con ese access token, solicitar un token de mínimos permisos para la acción específica
3. Retornar el token al plugin para que lo use en la ejecución
4. El token expira automáticamente (TTL configurado en Auth0)

La idea fundamental: el agente NUNCA ve las credenciales reales.
Solo recibe un token efímero con los permisos mínimos para UNA operación específica.
"""
from __future__ import annotations
import httpx
import logging
from config import get_settings
from models import RiskLevel

logger = logging.getLogger("agent-lock.token-vault")

settings = get_settings()


# ── Mapa de herramienta → scope mínimo en Auth0 ───────────────────────────────
TOOL_SCOPE_MAP: dict[str, str] = {
    # Lectura
    "read_file":      "read:files",
    "list_files":     "read:files",
    "search_files":   "read:files",
    "web_search":     "read:web",

    # Escritura de archivos
    "write_file":     "write:files",

    # Base de datos
    "database.query": "read:db",   # Se eleva a write:db si es INSERT/UPDATE
    "database.read":  "read:db",
    "database.write": "write:db",

    # Email
    "send_email":     "send:email",

    # HTTP
    "http_request":   "http:request",

    # Admin (solo para APPROVED explícito)
    "execute_code":   "admin:execute",
    "run_command":    "admin:execute",
    "bash":           "admin:execute",
    "delete_file":    "admin:delete",
}


# Tools that should only run with an authenticated end-user context.
# Local filesystem/shell actions are intentionally excluded.
USER_AUTH_REQUIRED_TOOLS = {
    "send_email",
    "http_request",
}


USER_AUTH_REQUIRED_KEYWORDS = (
    "email",
    "gmail",
    "mail",
    "calendar",
    "drive",
    "slack",
    "notion",
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


EXEC_LIKE_TOOLS = {
    "exec",
    "bash",
    "terminal",
    "run_command",
    "execute_code",
}


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


def _is_email_connector_call(tool_name: str, args: dict) -> bool:
    t = (tool_name or "").strip().lower()
    text = _flatten_args_for_matching(args)

    if "send_email" in t or "send-email" in t:
        return True

    if any(p in t for p in EMAIL_CONNECTOR_PATTERNS):
        return True

    if t in EXEC_LIKE_TOOLS and any(p in text for p in EMAIL_CONNECTOR_PATTERNS):
        return True

    return False


def requires_user_auth(tool_name: str, args: dict) -> bool:
    """Returns True when a tool should require an authenticated end-user token."""
    t = (tool_name or "").strip().lower()

    if t in USER_AUTH_REQUIRED_TOOLS:
        return True

    if _is_email_connector_call(t, args):
        return True

    # Heuristic for integrations that are not mapped explicitly yet.
    if any(k in t for k in USER_AUTH_REQUIRED_KEYWORDS):
        return True

    return False


def get_scope_for_tool(tool_name: str, args: dict, risk_level: RiskLevel) -> str:
    """Determina el scope mínimo necesario para una herramienta."""
    if _is_email_connector_call(tool_name, args):
        return "send:email"

    base_scope = TOOL_SCOPE_MAP.get(tool_name, "read:generic")

    # Para database.query, detectar si es escritura
    if tool_name == "database.query":
        query_text = " ".join(str(v) for v in args.values()).upper()
        if any(kw in query_text for kw in ["INSERT", "UPDATE", "MERGE", "REPLACE"]):
            base_scope = "write:db"
        elif any(kw in query_text for kw in ["DELETE", "DROP", "TRUNCATE"]):
            base_scope = "admin:db"

    return base_scope


def get_audience_for_tool(tool_name: str, args: dict) -> str:
    """Resolve the target audience for token exchange per tool category."""
    if _is_email_connector_call(tool_name, args):
        return settings.auth0_google_audience
    return settings.auth0_audience


async def request_token(
    tool_name: str,
    args: dict,
    risk_level: RiskLevel,
    subject_token: str | None = None,
) -> str | None:
    """
    Solicita un token de mínimos permisos a Auth0 Token Vault.
    
    Retorna el access token si tiene éxito, o None si no está configurado Auth0.
    """
    if not settings.auth0_domain or not settings.auth0_client_id:
        logger.warning(
            "Auth0 no configurado. El agente ejecutará sin token de vault. "
            "Configura AUTH0_DOMAIN, AUTH0_CLIENT_ID y AUTH0_CLIENT_SECRET en .env"
        )
        return None

    scope = get_scope_for_tool(tool_name, args, risk_level)
    audience = get_audience_for_tool(tool_name, args)

    # For email connectors, prefer Google API scopes configured in env.
    if _is_email_connector_call(tool_name, args):
        scope = settings.auth0_google_scopes or scope

    token_url = f"https://{settings.auth0_domain}/oauth/token"

    if subject_token:
        payload = {
            "grant_type": "urn:ietf:params:oauth:grant-type:token-exchange",
            "client_id": settings.auth0_client_id,
            "client_secret": settings.auth0_client_secret,
            "audience": audience,
            "scope": scope,
            "subject_token": subject_token,
            "subject_token_type": "urn:ietf:params:oauth:token-type:access_token",
            "requested_token_type": "urn:ietf:params:oauth:token-type:access_token",
        }
    else:
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
                f"Token obtenido de Auth0 | tool={tool_name} | audience={audience} | scope={scope} | "
                f"expires_in={data.get('expires_in')}s"
            )
            return access_token
    except httpx.HTTPStatusError as e:
        logger.error(f"Auth0 error HTTP {e.response.status_code}: {e.response.text}")
        return None
    except httpx.RequestError as e:
        logger.error(f"Auth0 error de conexión: {e}")
        return None
