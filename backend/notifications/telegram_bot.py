"""
Telegram Bot — Approval notifications with inline YES/NO buttons.

Uses HTML parse_mode (more robust than MarkdownV2 for dynamic content).
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
    """Escapes HTML characters in dynamic content."""
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
    risk_label = {RiskLevel.LOW: "Low", RiskLevel.HIGH: "High", RiskLevel.CRITICAL: "CRITICAL"}[risk_level]
    score_pct = int(intent_score * 100)

    # Visual score bar
    filled = int(intent_score * 8)
    score_bar = "🟦" * filled + "⬜" * (8 - filled)

    # Format args cleanly
    args_lines = []
    for k, v in args.items():
        v_str = str(_e(str(v)))
        if len(v_str) > 80:
            v_str = f"{v_str[:77]}..."
        args_lines.append(f"   <b>{_e(k)}:</b> <code>{v_str}</code>")
    args_formatted = "\n".join(args_lines) if args_lines else "   (no arguments)"

    return (
        f"🦞 <b>Agent-Lock</b> — Approval required\n"
        f"\n"
        f"💬 <b>You said:</b>\n"
        f"   <i>{_e(user_intent)}</i>\n"
        f"\n"
        f"⚙️ <b>The agent wants to execute:</b>\n"
        f"   <code>{_e(tool_name)}</code>\n"
        f"{args_formatted}\n"
        f"\n"
        f"{risk_emoji} <b>Risk Level:</b> {risk_label}\n"
        f"🎯 <b>Match Score:</b> {score_bar} {score_pct}%\n"
        f"\n"
        f"🧠 <b>Gemini Analysis:</b>\n"
        f"   <i>{_e(analysis)}</i>\n"
        f"\n"
        f"━━━━━━━━━━━━━━━━━━━━━━━━\n"
        f"<b>Do you authorize this action?</b>"
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
        logger.warning("Telegram not configured. Notification will not be sent.")
        return False

    try:
        bot = Bot(token=settings.telegram_bot_token)
        message = _build_message(
            action_id, tool_name, args, user_intent,
            risk_level, intent_score, analysis
        )

        keyboard = InlineKeyboardMarkup([
            [
                InlineKeyboardButton("✅ YES, execute", callback_data=f"YES:{action_id}"),
                InlineKeyboardButton("❌ NO, block", callback_data=f"NO:{action_id}"),
            ]
        ])

        await bot.send_message(
            chat_id=settings.telegram_chat_id,
            text=message,
            parse_mode="HTML",
            reply_markup=keyboard,
        )
        logger.info(f"Approval request sent to Telegram | action_id={action_id} | risk={risk_level.value}")
        return True

    except Exception as e:
        logger.error(f"Error sending Telegram notification: {e}")
        return False


async def send_decision_notification(action_id: str, decision: str, tool_name: str) -> None:
    if not settings.telegram_bot_token or not settings.telegram_chat_id:
        return

    if decision == "YES":
        text = f"✅ <b>Executed</b>\n<code>{_e(tool_name)}</code> was authorized and executed."
    else:
        text = f"🚫 <b>Blocked</b>\n<code>{_e(tool_name)}</code> was blocked. Action cancelled."

    try:
        bot = Bot(token=settings.telegram_bot_token)
        await bot.send_message(
            chat_id=settings.telegram_chat_id,
            text=text,
            parse_mode="HTML",
        )
    except Exception as e:
        logger.error(f"Error sending Telegram confirmation: {e}")


async def _handle_callback(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    query = update.callback_query
    await query.answer()

    data = query.data
    parts = data.split(":", 1)
    if len(parts) != 2:
        return

    decision, action_id = parts
    decision_text = "✅ Authorized" if decision == "YES" else "❌ Blocked"

    try:
        await query.edit_message_reply_markup(reply_markup=None)
        await query.edit_message_text(
            text=f"{query.message.text}\n\n<b>Decision:</b> {decision_text}",
            parse_mode="HTML",
        )
    except Exception:
        pass

    if _approve_callback:
        await _approve_callback(action_id, decision)


async def start_bot_polling() -> None:
    global _bot_app

    if not settings.telegram_bot_token:
        logger.warning("TELEGRAM_BOT_TOKEN not configured. Telegram bot disabled.")
        return

    _bot_app = (
        Application.builder()
        .token(settings.telegram_bot_token)
        .build()
    )

    _bot_app.add_handler(CallbackQueryHandler(_handle_callback))

    logger.info("🤖 Telegram bot started in polling mode...")
    await _bot_app.initialize()
    await _bot_app.start()
    await _bot_app.updater.start_polling(drop_pending_updates=True)


async def stop_bot() -> None:
    global _bot_app
    if _bot_app:
        await _bot_app.updater.stop()
        await _bot_app.stop()
        await _bot_app.shutdown()
        logger.info("Telegram bot stopped.")
