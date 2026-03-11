"""
Shared in-memory store for pending actions.
In production, this would be Redis or a small DB.
"""
from models import PendingAction

# action_id → PendingAction
_store: dict[str, PendingAction] = {}


def save(action: PendingAction) -> None:
    _store[action.action_id] = action


def get(action_id: str) -> PendingAction | None:
    return _store.get(action_id)


def update(action: PendingAction) -> None:
    _store[action.action_id] = action


def all_pending() -> list[PendingAction]:
    from models import ActionStatus
    return [a for a in _store.values() if a.status == ActionStatus.PENDING]
