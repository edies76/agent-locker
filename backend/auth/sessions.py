from __future__ import annotations

import secrets
from dataclasses import dataclass
from typing import Optional


@dataclass
class SessionData:
    session_id: str
    access_token: str
    id_token: str | None = None
    refresh_token: str | None = None


_sessions: dict[str, SessionData] = {}


def new_session(access_token: str, id_token: str | None = None, refresh_token: str | None = None) -> SessionData:
    session_id = secrets.token_urlsafe(32)
    s = SessionData(session_id=session_id, access_token=access_token, id_token=id_token, refresh_token=refresh_token)
    _sessions[session_id] = s
    return s


def get_session(session_id: str) -> Optional[SessionData]:
    return _sessions.get(session_id)


def delete_session(session_id: str) -> None:
    _sessions.pop(session_id, None)

