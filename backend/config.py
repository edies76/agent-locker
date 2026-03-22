from pydantic_settings import BaseSettings, SettingsConfigDict
from functools import lru_cache


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8")

    # Gemini
    gemini_api_key: str = ""

    # Auth0
    auth0_domain: str = ""
    auth0_client_id: str = ""
    auth0_client_secret: str = ""
    auth0_audience: str = "https://agent-lock-api"
    auth0_callback_url: str = "http://localhost:8000/auth/callback"
    auth0_scope: str = "openid profile email offline_access"
    # Third-party provider targets for Token Vault style delegation
    auth0_google_audience: str = "https://www.googleapis.com/"
    auth0_google_scopes: str = "https://www.googleapis.com/auth/gmail.send"
    auth0_google_connection_name: str = "google-oauth2"

    # Telegram
    telegram_bot_token: str = ""
    telegram_chat_id: str = ""

    # Server
    backend_port: int = 8000
    backend_url: str = "http://localhost:8000"

    # Security
    secret_key: str = "dev-secret-key-change-in-production"
    session_cookie_name: str = "agent_lock_session"

    # Logs
    audit_log_path: str = "./logs/audit.jsonl"


@lru_cache()
def get_settings() -> Settings:
    return Settings()
