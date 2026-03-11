"""
GET /logs   — Últimos N registros del audit log
GET /health — Healthcheck
"""
import logging
from fastapi import APIRouter, Query
from audit.audit_logger import read_logs

router = APIRouter()
logger = logging.getLogger("agent-lock.logs")


@router.get("/logs")
async def get_logs(limit: int = Query(default=50, ge=1, le=500)) -> list[dict]:
    """Retorna los últimos N registros del audit log."""
    return read_logs(limit=limit)


@router.get("/health")
async def health() -> dict:
    return {"status": "ok", "service": "agent-lock"}
