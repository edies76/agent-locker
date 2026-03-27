from fastapi import FastAPI
from fastapi.testclient import TestClient

from routes.token_vault_api import router as vault_router


app = FastAPI()
app.include_router(vault_router)
client = TestClient(app)


def test_vault_status_endpoint():
    res = client.get("/vault/status")
    assert res.status_code == 200
    body = res.json()
    assert "enabled" in body
    assert "connections" in body
    assert "google" in body["connections"]


def test_gmail_send_requires_auth():
    payload = {
        "to": "demo@example.com",
        "subject": "test",
        "body_text": "hello",
    }
    res = client.post("/vault/google/gmail/send", json=payload)
    assert res.status_code == 401
    body = res.json()
    assert "detail" in body

