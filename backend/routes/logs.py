"""
GET /logs   — Last N records from the audit log
GET /health — Healthcheck
"""
import logging
from fastapi import APIRouter, Query
from audit.audit_logger import read_logs
from models import AuditLog

router = APIRouter()
logger = logging.getLogger("agent-lock.logs")


@router.get("/logs", response_model=list[AuditLog])
async def get_logs(limit: int = Query(default=50, ge=1, le=500)):
    """Returns the last N records from the cryptographically signed audit log."""
    return read_logs(limit=limit)


@router.get("/health")
async def health() -> dict:
    return {"status": "ok", "service": "agent-lock"}
