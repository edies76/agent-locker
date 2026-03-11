"""
Audit Logger — Logs inmutables en formato JSONL (JSON Lines).

Cada línea es un registro JSON completo e independiente.
Append-only: nunca se sobreescriben registros anteriores.
"""
import json
import logging
import os
from datetime import datetime, timezone
from pathlib import Path

from config import get_settings
from models import PendingAction, ActionStatus

logger = logging.getLogger("agent-lock.audit")
settings = get_settings()


def _get_log_path() -> Path:
    path = Path(settings.audit_log_path)
    path.parent.mkdir(parents=True, exist_ok=True)
    return path


def write_log(action: PendingAction) -> None:
    """Escribe un registro de audit inmutable al archivo JSONL."""
    record = {
        "action_id": action.action_id,
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "tool_name": action.tool_name,
        "args": action.args,
        "raw_command": action.raw_command,
        "user_intent": action.user_intent,
        "agent_id": action.agent_id,
        "risk_level": action.risk_level.value,
        "intent_score": action.intent_score,
        "analysis": action.analysis,
        "decision": action.status.value,
        "decided_at": action.decided_at.isoformat() if action.decided_at else None,
    }
    try:
        with open(_get_log_path(), "a", encoding="utf-8") as f:
            f.write(json.dumps(record, ensure_ascii=False) + "\n")
        logger.info(f"Audit log escrito | action_id={action.action_id} | decision={action.status.value}")
    except Exception as e:
        logger.error(f"Error escribiendo audit log: {e}")


def read_logs(limit: int = 100) -> list[dict]:
    """Lee los últimos N registros del audit log."""
    path = _get_log_path()
    if not path.exists():
        return []
    try:
        with open(path, "r", encoding="utf-8") as f:
            lines = f.readlines()
        records = []
        for line in reversed(lines[-limit:]):
            line = line.strip()
            if line:
                try:
                    records.append(json.loads(line))
                except json.JSONDecodeError:
                    pass
        return records
    except Exception as e:
        logger.error(f"Error leyendo audit log: {e}")
        return []
