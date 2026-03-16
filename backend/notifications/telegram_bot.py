"""
Telegram Bot — Notificaciones de aprobación con botones inline YES/NO.

Usa HTML parse_mode (más robusto que MarkdownV2 con contenido dinámico).
"""


import logging
from html import escape
from typing import Optional

from telegram import Update, InlineKeyboardButton, InlineKeyboardMarkup, Bot
from telegram.ext import Application, CallbackQueryHandler, ContextTypes

from config import get_settings
from models import RiskLevel

logger = logging.getLogger("agent-lock.telegram")
settings = get_settings()

_approve_callback = None
_bot_app: Optional[Application] = None


def set_approve_callback(cb):
    global _approve_callback
    _approve_callback = cb


def _risk_emoji(risk: RiskLevel) -> str:
    return {RiskLevel.LOW: "🟢", RiskLevel.HIGH: "🟡", RiskLevel.CRITICAL: "🔴"}[risk]


def _e(text: str) -> str:
    """Escapa caracteres HTML en contenido dinámico."""
    return escape(str(text))


def _build_message(
    action_id: str,
    tool_name: str,
    args: dict,
    user_intent: str,
    risk_level: RiskLevel,
    intent_score: float,
    analysis: str,
) -> str:
    risk_emoji = _risk_emoji(risk_level)
    risk_label = {RiskLevel.LOW: "Bajo", RiskLevel.HIGH: "Alto", RiskLevel.CRITICAL: "CRÍTICO"}[risk_level]
    score_pct = int(intent_score * 100)

    # Barra visual de score
    filled = int(intent_score * 8)
    score_bar = "🟦" * filled + "⬜" * (8 - filled)

    # Formatear args de forma limpia
    args_lines = []
    for k, v in args.items():
        v_str = _e(str(v))
        if len(v_str) > 80:
            v_str = v_str[:77] + "..."
        args_lines.append(f"   <b>{_e(k)}:</b> <code>{v_str}</code>")
    args_formatted = "\n".join(args_lines) if args_lines else "   (sin argumentos)"

    return (
        f"🦞 <b>Agent-Lock</b> — Aprobación requerida\n"
        f"\n"
        f"💬 <b>Tú dijiste:</b>\n"
        f"   <i>{_e(user_intent)}</i>\n"
        f"\n"
        f"⚙️ <b>El agente quiere ejecutar:</b>\n"
        f"   <code>{_e(tool_name)}</code>\n"
        f"{args_formatted}\n"
        f"\n"
        f"{risk_emoji} <b>Nivel de riesgo:</b> {risk_label}\n"
        f"🎯 <b>Coincidencia:</b> {score_bar} {score_pct}%\n"
        f"\n"
        f"🧠 <b>Análisis de Gemini:</b>\n"
        f"   <i>{_e(analysis)}</i>\n"
        f"\n"
        f"━━━━━━━━━━━━━━━━━━━━━━━━\n"
        f"<b>¿Autorizas esta acción?</b>"
    )


async def send_approval_request(
    action_id: str,
    tool_name: str,
    args: dict,
    user_intent: str,
    risk_level: RiskLevel,
    intent_score: float,
    analysis: str,
) -> bool:
    if not settings.telegram_bot_token or not settings.telegram_chat_id:
        logger.warning("Telegram no configurado. No se enviará notificación.")
        return False

    try:
        bot = Bot(token=settings.telegram_bot_token)
        message = _build_message(
            action_id, tool_name, args, user_intent,
            risk_level, intent_score, analysis
        )

        keyboard = InlineKeyboardMarkup([
            [
                InlineKeyboardButton("✅ SÍ, ejecutar", callback_data=f"YES:{action_id}"),
                InlineKeyboardButton("❌ NO, bloquear", callback_data=f"NO:{action_id}"),
            ]
        ])

        await bot.send_message(
            chat_id=settings.telegram_chat_id,
            text=message,
            parse_mode="HTML",
            reply_markup=keyboard,
        )
        logger.info(f"Aprobación enviada a Telegram | action_id={action_id} | riesgo={risk_level.value}")
        return True

    except Exception as e:
        logger.error(f"Error enviando Telegram: {e}")
        return False


async def send_decision_notification(action_id: str, decision: str, tool_name: str) -> None:
    if not settings.telegram_bot_token or not settings.telegram_chat_id:
        return

    if decision == "YES":
        text = f"✅ <b>Ejecutado</b>\n<code>{_e(tool_name)}</code> fue autorizado y ejecutado."
    else:
        text = f"🚫 <b>Bloqueado</b>\n<code>{_e(tool_name)}</code> fue bloqueado. Acción cancelada."

    try:
        bot = Bot(token=settings.telegram_bot_token)
        await bot.send_message(
            chat_id=settings.telegram_chat_id,
            text=text,
            parse_mode="HTML",
        )
    except Exception as e:
        logger.error(f"Error enviando confirmación Telegram: {e}")


async def _handle_callback(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    query = update.callback_query
    await query.answer()

    data = query.data
    parts = data.split(":", 1)
    if len(parts) != 2:
        return

    decision, action_id = parts
    decision_text = "✅ Autorizado" if decision == "YES" else "❌ Bloqueado"

    try:
        await query.edit_message_reply_markup(reply_markup=None)
        await query.edit_message_text(
            text=f"{query.message.text}\n\n<b>Decisión:</b> {decision_text}",
            parse_mode="HTML",
        )
    except Exception:
        pass

    if _approve_callback:
        await _approve_callback(action_id, decision)


async def start_bot_polling() -> None:
    global _bot_app

    if not settings.telegram_bot_token:
        logger.warning("TELEGRAM_BOT_TOKEN no configurado. Bot de Telegram desactivado.")
        return

    _bot_app = (
        Application.builder()
        .token(settings.telegram_bot_token)
        .build()
    )

    _bot_app.add_handler(CallbackQueryHandler(_handle_callback))

    logger.info("🤖 Bot de Telegram iniciado en modo polling...")
    await _bot_app.initialize()
    await _bot_app.start()
    await _bot_app.updater.start_polling(drop_pending_updates=True)


async def stop_bot() -> None:
    global _bot_app
    if _bot_app:
        await _bot_app.updater.stop()
        await _bot_app.stop()
        await _bot_app.shutdown()
        logger.info("Bot de Telegram detenido.")
