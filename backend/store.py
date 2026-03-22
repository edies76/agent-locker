"""
Shared in-memory store for pending actions.
In production, this would be Redis or a small DB.
"""

from models import ActionStatus, PendingAction

# action_id → PendingAction
_store: dict[str, PendingAction] = {}


def save(action: PendingAction) -> None:
    _store[action.action_id] = action


def get(action_id: str) -> PendingAction | None:
    return _store.get(action_id)


def update(action: PendingAction) -> None:
    _store[action.action_id] = action


def all_pending() -> list[PendingAction]:
    return [a for a in _store.values() if a.status == ActionStatus.PENDING]


def all_actions() -> list[PendingAction]:
    """Return every action in the store, newest first."""
    return sorted(_store.values(), key=lambda a: a.created_at, reverse=True)


def all_by_status(status: ActionStatus) -> list[PendingAction]:
    """Return all actions matching a specific status, newest first."""
    return sorted(
        (a for a in _store.values() if a.status == status),
        key=lambda a: a.created_at,
        reverse=True,
    )
