"""
Persistent store for pending actions — SQLite backend.

Drop-in replacement for the previous in-memory dict. The public API
(save, get, update, all_pending, all_actions, all_by_status) is identical
so no other file needs to change.

Storage:
    File: ./data/agent_lock.db   (auto-created on first run)
    Engine: SQLite via the stdlib `sqlite3` module — no extra deps needed.

Design decisions:
    - `args`, `subject_token`, `auth_token` are stored as JSON text.
    - Datetimes are stored as ISO-8601 strings (UTC).
    - An in-memory write-through cache (dict) avoids redundant DB reads
      for hot paths like polling /status.
    - All DB operations are synchronous; FastAPI routes that call store
      functions are already sync-compatible (or wrapped via run_in_executor
      if needed in the future).
"""

from __future__ import annotations

import json
import logging
import os
import sqlite3
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Optional

from models import ActionStatus, PendingAction, RiskLevel

logger = logging.getLogger("agent-lock.store")

# ── DB path ───────────────────────────────────────────────────────────────────
_DB_DIR = Path(__file__).parent / "data"
_DB_PATH = _DB_DIR / "agent_lock.db"

# ── In-memory write-through cache ─────────────────────────────────────────────
_cache: dict[str, PendingAction] = {}


# ── Schema ────────────────────────────────────────────────────────────────────

_CREATE_TABLE = """
CREATE TABLE IF NOT EXISTS actions (
    action_id       TEXT PRIMARY KEY,
    tool_name       TEXT NOT NULL,
    args            TEXT NOT NULL,
    user_intent     TEXT NOT NULL DEFAULT '',
    agent_id        TEXT,
    session_key     TEXT,
    raw_command     TEXT,
    risk_level      TEXT NOT NULL,
    intent_score    REAL NOT NULL,
    analysis        TEXT NOT NULL DEFAULT '',
    status          TEXT NOT NULL,
    created_at      TEXT NOT NULL,
    decided_at      TEXT,
    auth_token      TEXT,
    subject_token   TEXT,
    login_url       TEXT
);
"""

_CREATE_INDEX = """
CREATE INDEX IF NOT EXISTS idx_actions_status ON actions (status);
"""


# ── Connection factory ────────────────────────────────────────────────────────

def _get_conn() -> sqlite3.Connection:
    """Return a SQLite connection with row_factory set."""
    _DB_DIR.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(str(_DB_PATH))
    conn.row_factory = sqlite3.Row
    return conn


def _init_db() -> None:
    """Create table and index if they don't exist."""
    with _get_conn() as conn:
        conn.execute(_CREATE_TABLE)
        conn.execute(_CREATE_INDEX)
        conn.commit()
    logger.info(f"SQLite store initialised at {_DB_PATH}")


# Run migration on import
_init_db()


# ── Serialisation helpers ─────────────────────────────────────────────────────

def _to_row(action: PendingAction) -> dict[str, Any]:
    return {
        "action_id":    action.action_id,
        "tool_name":    action.tool_name,
        "args":         json.dumps(action.args, ensure_ascii=False),
        "user_intent":  action.user_intent or "",
        "agent_id":     action.agent_id,
        "session_key":  action.session_key,
        "raw_command":  action.raw_command,
        "risk_level":   action.risk_level.value,
        "intent_score": action.intent_score,
        "analysis":     action.analysis or "",
        "status":       action.status.value,
        "created_at":   action.created_at.isoformat(),
        "decided_at":   action.decided_at.isoformat() if action.decided_at else None,
        "auth_token":   action.auth_token,
        "subject_token":action.subject_token,
        "login_url":    action.login_url,
    }


def _from_row(row: sqlite3.Row) -> PendingAction:
    def _dt(val: Optional[str]) -> Optional[datetime]:
        if not val:
            return None
        dt = datetime.fromisoformat(val)
        # Ensure tz-aware UTC
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        return dt

    return PendingAction(
        action_id=row["action_id"],
        tool_name=row["tool_name"],
        args=json.loads(row["args"]),
        user_intent=row["user_intent"] or "",
        agent_id=row["agent_id"],
        session_key=row["session_key"],
        raw_command=row["raw_command"],
        risk_level=RiskLevel(row["risk_level"]),
        intent_score=row["intent_score"],
        analysis=row["analysis"] or "",
        status=ActionStatus(row["status"]),
        created_at=_dt(row["created_at"]) or datetime.now(timezone.utc),
        decided_at=_dt(row["decided_at"]),
        auth_token=row["auth_token"],
        subject_token=row["subject_token"],
        login_url=row["login_url"],
    )


# ── Public API ────────────────────────────────────────────────────────────────

def save(action: PendingAction) -> None:
    """Insert a new action. Raises if action_id already exists."""
    row = _to_row(action)
    with _get_conn() as conn:
        conn.execute(
            """
            INSERT INTO actions
                (action_id, tool_name, args, user_intent, agent_id, session_key,
                 raw_command, risk_level, intent_score, analysis, status,
                 created_at, decided_at, auth_token, subject_token, login_url)
            VALUES
                (:action_id, :tool_name, :args, :user_intent, :agent_id, :session_key,
                 :raw_command, :risk_level, :intent_score, :analysis, :status,
                 :created_at, :decided_at, :auth_token, :subject_token, :login_url)
            """,
            row,
        )
        conn.commit()
    _cache[action.action_id] = action
    logger.debug(f"store.save: {action.action_id} | {action.tool_name} | {action.status.value}")


def get(action_id: str) -> PendingAction | None:
    """Return an action by ID, checking cache first."""
    if action_id in _cache:
        return _cache[action_id]

    with _get_conn() as conn:
        row = conn.execute(
            "SELECT * FROM actions WHERE action_id = ?", (action_id,)
        ).fetchone()

    if row is None:
        return None

    action = _from_row(row)
    _cache[action_id] = action
    return action


def update(action: PendingAction) -> None:
    """Upsert an existing action (update all fields by action_id)."""
    row = _to_row(action)
    with _get_conn() as conn:
        conn.execute(
            """
            UPDATE actions SET
                tool_name    = :tool_name,
                args         = :args,
                user_intent  = :user_intent,
                agent_id     = :agent_id,
                session_key  = :session_key,
                raw_command  = :raw_command,
                risk_level   = :risk_level,
                intent_score = :intent_score,
                analysis     = :analysis,
                status       = :status,
                created_at   = :created_at,
                decided_at   = :decided_at,
                auth_token   = :auth_token,
                subject_token= :subject_token,
                login_url    = :login_url
            WHERE action_id = :action_id
            """,
            row,
        )
        conn.commit()
    _cache[action.action_id] = action
    logger.debug(f"store.update: {action.action_id} → {action.status.value}")


def all_pending() -> list[PendingAction]:
    """Return all actions currently in PENDING status, newest first."""
    with _get_conn() as conn:
        rows = conn.execute(
            "SELECT * FROM actions WHERE status = ? ORDER BY created_at DESC",
            (ActionStatus.PENDING.value,),
        ).fetchall()
    return [_from_row(r) for r in rows]


def all_actions() -> list[PendingAction]:
    """Return every action in the store, newest first."""
    with _get_conn() as conn:
        rows = conn.execute(
            "SELECT * FROM actions ORDER BY created_at DESC"
        ).fetchall()
    return [_from_row(r) for r in rows]


def all_by_status(status: ActionStatus) -> list[PendingAction]:
    """Return all actions matching a specific status, newest first."""
    with _get_conn() as conn:
        rows = conn.execute(
            "SELECT * FROM actions WHERE status = ? ORDER BY created_at DESC",
            (status.value,),
        ).fetchall()
    return [_from_row(r) for r in rows]
