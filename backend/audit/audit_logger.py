"""
Audit Logger — Immutable JSONL (JSON Lines) logs.

Each line is a complete, independent JSON record.
Append-only: previous records are never overwritten.
Now features Cryptographic Signing (HMAC-SHA256) for non-repudiation.
"""
import json
import logging
import hmac
import hashlib
from datetime import datetime, timezone
from pathlib import Path

from config import get_settings
from models import PendingAction

logger = logging.getLogger("agent-lock.audit")
settings = get_settings()


def _get_log_path() -> Path:
    path = Path(settings.audit_log_path)
    path.parent.mkdir(parents=True, exist_ok=True)
    return path


def _sign_payload(payload_str: str) -> str:
    """Generates an HMAC-SHA256 signature using the app's SECRET_KEY."""
    secret = settings.secret_key.encode("utf-8")
    return hmac.new(secret, payload_str.encode("utf-8"), hashlib.sha256).hexdigest()


def write_log(action: PendingAction) -> None:
    """Writes an immutable, cryptographically signed audit record to the JSONL file."""
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
    
    # Create deterministic JSON string (keys sorted, no spaces) to ensure consistent hashing
    payload_str = json.dumps(record, ensure_ascii=False, sort_keys=True, separators=(',', ':'))
    
    # Generate signature and append to final log entry
    signature = _sign_payload(payload_str)
    
    final_log = {
        "payload": record,
        "signature": signature
    }
    
    try:
        with open(_get_log_path(), "a", encoding="utf-8") as f:
            f.write(json.dumps(final_log, ensure_ascii=False) + "\n")
        logger.info(f"Signed audit log written | action_id={action.action_id} | decision={action.status.value}")
    except Exception as e:
        logger.error(f"Error writing audit log: {e}")


def read_logs(limit: int = 100) -> list[dict]:
    """Reads the last N records from the audit log, verifying signatures."""
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
                    entry = json.loads(line)
                    # Support legacy logs that didn't have signatures yet
                    if "payload" in entry and "signature" in entry:
                        payload_str = json.dumps(
                            entry["payload"], 
                            ensure_ascii=False, 
                            sort_keys=True, 
                            separators=(',', ':')
                        )
                        expected_sig = _sign_payload(payload_str)
                        is_valid = hmac.compare_digest(expected_sig, entry["signature"])
                        
                        entry["payload"]["_signature_valid"] = is_valid
                        records.append(entry["payload"])
                    else:
                        # Legacy unsigned log
                        entry["_signature_valid"] = False
                        records.append(entry)
                except json.JSONDecodeError:
                    pass
        return records
    except Exception as e:
        logger.error(f"Error reading audit logs: {e}")
        return []
