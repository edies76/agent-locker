from datetime import datetime, timedelta, timezone

from fastapi.testclient import TestClient
from fastapi import FastAPI

from routes.logs import router as logs_router


app = FastAPI()
app.include_router(logs_router)
client = TestClient(app)


def _mk(ts: datetime, risk: str, decision: str, valid: bool, tool: str = "exec"):
    return {
        "action_id": f"id-{risk}-{decision}-{tool}-{int(ts.timestamp())}",
        "timestamp": ts.isoformat(),
        "tool_name": tool,
        "args": {"cmd": "echo"},
        "raw_command": "echo",
        "user_intent": "test",
        "agent_id": "agent-1",
        "risk_level": risk,
        "intent_score": 0.9,
        "analysis": "ok",
        "decision": decision,
        "decided_at": ts.isoformat(),
        "_signature_valid": valid,
    }


def test_logs_filters(monkeypatch):
    now = datetime.now(timezone.utc)
    sample = [
        _mk(now - timedelta(hours=1), "LOW", "APPROVED", True, "read_file"),
        _mk(now - timedelta(hours=2), "CRITICAL", "BLOCKED", False, "exec"),
    ]

    def _fake_read_logs(limit=2000):
        return sample

    monkeypatch.setattr("routes.logs.read_logs", _fake_read_logs)

    res = client.get("/logs?risk=CRITICAL&signature=invalid")
    assert res.status_code == 200
    body = res.json()
    assert len(body) == 1
    assert body[0]["risk_level"] == "CRITICAL"
    assert body[0]["_signature_valid"] is False


def test_logs_search(monkeypatch):
    now = datetime.now(timezone.utc)
    sample = [
        _mk(now, "LOW", "APPROVED", True, "filesystem__read_file"),
        _mk(now, "HIGH", "PENDING", True, "exec"),
    ]

    def _fake_read_logs(limit=2000):
        return sample

    monkeypatch.setattr("routes.logs.read_logs", _fake_read_logs)

    res = client.get("/logs?search=filesystem")
    assert res.status_code == 200
    body = res.json()
    assert len(body) == 1
    assert "filesystem" in body[0]["tool_name"]
