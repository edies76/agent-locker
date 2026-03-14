"""
Intent Validator powered by Gemini Flash (gemini-2.0-flash)

Gemini semantically analyzes if the agent's action matches the user's intent and returns:
- score: 0.0 (does not match) → 1.0 (perfect match)
- analysis: brief explanation in English
- contradictions: list of detected contradictions (empty if none)

IMPORTANT NOTE on user_intent:
- If the plugin cannot capture the real user instruction, it will result in a generic string like "[OpenClaw session]".
- In this case, the validator cannot perform a real semantic analysis.
- We return a high neutral score (0.85) to avoid escalating risk without evidence.
"""
import json
import logging
import httpx
from dataclasses import dataclass, field
from config import get_settings

logger = logging.getLogger("agent-lock.intent-validator")
settings = get_settings()

GEMINI_API_URL = (
    "https://generativelanguage.googleapis.com/v1beta/models"
    "/gemini-2.0-flash:generateContent"
)

SYSTEM_PROMPT = """You are the validation engine for Agent-Lock, a security layer for AI agents.
Your job is to analyze if the action an agent wants to execute matches what the user actually requested.

Analysis Rules:
1. If the action seems like a logical consequence of the user's instruction, give a HIGH score (0.8-1.0).
   Example: User asks "optimize the database" and the agent wants to perform SELECT → score 0.95
2. If the action is destructive but the user DID NOT ask to delete anything, give a VERY LOW score (0.0-0.2).
   Example: User asks to "optimize" but the agent tries DROP TABLE → score 0.1
3. If the action has no clear relation but is not destructive, give a MEDIUM score (0.5-0.7).
4. For normal read/search/navigation actions, be tolerant: high score (0.8+).
5. Only flag contradictions when there is a REAL and clear conflict between instruction and action.

ALWAYS respond ONLY with a valid JSON, no markdown, no additional explanations:
{
  "score": 0.0 to 1.0,
  "analysis": "brief explanation in English (max 150 chars)",
  "contradictions": ["description of contradiction if it exists"]
}"""


# Generic strings indicating no real user_intent
_GENERIC_INTENTS = {
    "[sesión openclaw]",
    "[sesión openc",
    "[openclaw session]",
    "",
    "n/a",
    "unknown",
    "no intent",
}


@dataclass
class ValidationResult:
    score: float
    analysis: str
    contradictions: list[str] = field(default_factory=list)
    gemini_used: bool = False


def _is_generic_intent(user_intent: str) -> bool:
    """Detects if user_intent is generic (not captured from the real user)."""
    return user_intent.strip().lower() in _GENERIC_INTENTS


async def validate_intent(
    user_intent: str,
    tool_name: str,
    args: dict,
    raw_command: str | None = None,
) -> ValidationResult:
    """
    Validates user intent against agent action.
    
    If no real user_intent → returns neutral score (does not penalize).
    If Gemini is not configured → keyword-based fallback.
    If Gemini fails → keyword-based fallback.
    """
    # ── No real user_intent: semantic validation not possible ───────────────────
    if _is_generic_intent(user_intent):
        logger.info(
            f"Generic user intent detected ('{user_intent}'). "
            f"Skipping semantic validation — returning neutral score."
        )
        return ValidationResult(
            score=0.85,
            analysis="ℹ️ No user instruction captured. Analysis based only on rules.",
            contradictions=[],
            gemini_used=False,
        )

    # ── No API key: fallback ──────────────────────────────────────────────────
    if not settings.gemini_api_key:
        logger.warning("GEMINI_API_KEY not configured. Using basic fallback.")
        return _fallback_validate(user_intent, tool_name, args)

    # ── Gemini Call ───────────────────────────────────────────────────────────
    args_str = str(json.dumps(args, ensure_ascii=False, indent=2))
    if len(args_str) > 1500:
        args_str = f"{args_str[:1497]}..."

    user_message = f"""The user told the agent: "{user_intent}"

The agent wants to execute:
- Tool: {tool_name}
- Arguments:
{args_str}
{f'- Raw command: {raw_command}' if raw_command else ''}

Is the action consistent with the user's instruction? Analyze possible contradictions."""

    payload = {
        "system_instruction": {"parts": [{"text": SYSTEM_PROMPT}]},
        "contents": [{"parts": [{"text": user_message}]}],
        "generationConfig": {
            "temperature": 0.1,
            "maxOutputTokens": 300,
            "responseMimeType": "application/json",
        },
    }

    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            response = await client.post(
                GEMINI_API_URL,
                params={"key": settings.gemini_api_key},
                json=payload,
            )
            response.raise_for_status()
            data = response.json()

        # Extract text from response
        text = data["candidates"][0]["content"]["parts"][0]["text"]
        result = json.loads(text)

        score = float(result.get("score", 0.5))
        analysis = str(result.get("analysis", "No analysis available."))
        contradictions = list(result.get("contradictions", []))

        # Clear empty contradictions
        contradictions = [c for c in contradictions if c and c.strip()]

        safe_analysis = str(analysis)[:80]
        logger.info(
            f"🧠 Gemini validated | tool={tool_name} | score={score:.2f} | "
            f"contradictions={len(contradictions)} | analysis='{safe_analysis}'"
        )

        return ValidationResult(
            score=score,
            analysis=analysis,
            contradictions=contradictions,
            gemini_used=True,
        )

    except httpx.HTTPStatusError as e:
        logger.error(f"Gemini HTTP error {e.response.status_code}: {e.response.text[:200]}")
        return _fallback_validate(user_intent, tool_name, args)
    except (json.JSONDecodeError, KeyError, ValueError) as e:
        logger.error(f"Error parsing Gemini response: {e}")
        return _fallback_validate(user_intent, tool_name, args)
    except Exception as e:
        logger.error(f"Unexpected error in Gemini validator: {e}")
        return _fallback_validate(user_intent, tool_name, args)


def _fallback_validate(user_intent: str, tool_name: str, args: dict) -> ValidationResult:
    """
    Basic keyword-based fallback when Gemini is unavailable.
    """
    intent_lower = user_intent.lower()
    args_text = " ".join(str(v) for v in args.values()).upper()

    # Detect obvious destructive operations
    destructive = any(kw in args_text for kw in [
        "DROP", "TRUNCATE", "DELETE FROM", "RM -RF", "RMDIR"
    ])
    read_intent = any(kw in intent_lower for kw in [
        "read", "show", "list", "get", "find", "search", "analyze", "optimiz"
    ])

    if destructive and read_intent:
        return ValidationResult(
            score=0.15,
            analysis="⚠️ Contradiction: read instruction but destructive action detected.",
            contradictions=["Destructive action detected with read/optimization intent."],
            gemini_used=False,
        )
    elif destructive:
        return ValidationResult(
            score=0.4,
            analysis="⚠️ Destructive action detected. Requires verification.",
            contradictions=[],
            gemini_used=False,
        )
    else:
        return ValidationResult(
            score=0.85,
            analysis="✅ No obvious contradictions detected (rules-based analysis).",
            contradictions=[],
            gemini_used=False,
        )
