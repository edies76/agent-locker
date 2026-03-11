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

    # Telegram
    telegram_bot_token: str = ""
    telegram_chat_id: str = ""

    # Servidor
    backend_port: int = 8000
    backend_url: str = "http://localhost:8000"

    # Seguridad
    secret_key: str = "dev-secret-key-change-in-production"

    # Logs
    audit_log_path: str = "./logs/audit.jsonl"


@lru_cache()
def get_settings() -> Settings:
    return Settings()
