"""
Agent-Lock — FastAPI Application Entrypoint

Inicia el backend con:
- Bot de Telegram en background (polling)
- Todos los routers
- CORS habilitado para el plugin de OpenClaw
"""
import logging
import asyncio
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from config import get_settings
from routes.intercept import router as intercept_router
from routes.status import router as status_router
from routes.approve import router as approve_router
from routes.logs import router as logs_router
import notifications.telegram_bot as tg_bot
import store

# ── Logging setup ─────────────────────────────────────────────────────────────
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s — %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
logger = logging.getLogger("agent-lock")
settings = get_settings()


# ── Lifespan: arrancar/parar bot Telegram ─────────────────────────────────────
@asynccontextmanager
async def lifespan(app: FastAPI):
    # Registrar el callback de aprobación en el bot
    async def _handle_approval(action_id: str, decision: str) -> None:
        from models import ApprovalRequest, ApprovalDecision
        from routes.approve import approve_action
        req = ApprovalRequest(decision=ApprovalDecision(decision))
        await approve_action(action_id, req)

    tg_bot.set_approve_callback(_handle_approval)

    # Iniciar bot en background
    await tg_bot.start_bot_polling()
    logger.info("🦞 Agent-Lock backend iniciado")
    logger.info(f"🌐 URL: {settings.backend_url}")

    yield  # ← app corriendo

    # Apagar bot limpiamente
    await tg_bot.stop_bot()
    logger.info("Agent-Lock apagado.")


# ── FastAPI App ───────────────────────────────────────────────────────────────
app = FastAPI(
    title="Agent-Lock",
    description="La capa de gobernanza para agentes de IA",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # En producción: reemplazar con la URL del plugin
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Routers ───────────────────────────────────────────────────────────────────
app.include_router(intercept_router, tags=["Intercept"])
app.include_router(status_router, tags=["Status"])
app.include_router(approve_router, tags=["Approve"])
app.include_router(logs_router, tags=["Logs"])


# ── Run ───────────────────────────────────────────────────────────────────────
if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=settings.backend_port,
        reload=True,
    )
