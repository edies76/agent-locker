"""
Agent-Lock — FastAPI Application Entrypoint

Starts the backend with:
- Telegram Bot in background (polling)
- All routers
- CORS enabled for the OpenClaw plugin
"""

import asyncio
import logging
from contextlib import asynccontextmanager

import notifications.telegram_bot as tg_bot
import store
from auth.middleware import AuthContextMiddleware
from config import get_settings
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from routes.approve import router as approve_router
from routes.auth import router as auth_router
from routes.dashboard import router as dashboard_router
from routes.intercept import router as intercept_router
from routes.logs import router as logs_router
from routes.settings_api import router as settings_router
from routes.status import router as status_router

# ── Logging Setup ─────────────────────────────────────────────────────────────
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s — %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
logger = logging.getLogger("agent-lock")
settings = get_settings()


# ── Lifespan: Start/Stop Telegram Bot ─────────────────────────────────────────
@asynccontextmanager
async def lifespan(app: FastAPI):
    # Register the approval callback in the bot
    async def _handle_approval(action_id: str, decision: str) -> None:
        from models import ApprovalDecision, ApprovalRequest
        from routes.approve import approve_action

        req = ApprovalRequest(decision=ApprovalDecision(decision))
        await approve_action(action_id, req)

    tg_bot.set_approve_callback(_handle_approval)

    # Start bot in background
    await tg_bot.start_bot_polling()
    logger.info("🦞 Agent-Lock backend started")
    logger.info(f"🌐 URL: {settings.backend_url}")

    yield  # ← app running

    # Shutdown bot cleanly
    await tg_bot.stop_bot()
    logger.info("Agent-Lock shut down.")


# ── FastAPI App ───────────────────────────────────────────────────────────────
app = FastAPI(
    title="Agent-Lock",
    description="Governance layer for AI agents",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Production: replace with the plugin URL
    allow_methods=["*"],
    allow_headers=["*"],
)

app.add_middleware(AuthContextMiddleware)

# ── Routers ───────────────────────────────────────────────────────────────────
app.include_router(intercept_router, tags=["Intercept"])
app.include_router(status_router, tags=["Status"])
app.include_router(approve_router, tags=["Approve"])
app.include_router(logs_router, tags=["Logs"])
app.include_router(auth_router, tags=["Auth"])
app.include_router(dashboard_router)
app.include_router(settings_router)


# ── Run ───────────────────────────────────────────────────────────────────────
if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=settings.backend_port,
        reload=False,
    )
