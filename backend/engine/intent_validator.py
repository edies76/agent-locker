"""
Intent Validator powered by Gemini Flash (gemini-2.0-flash)

Gemini analiza semánticamente si la acción del agente coincide
con la intención del usuario y retorna:
- score: 0.0 (no coincide) → 1.0 (coincide perfectamente)
- analysis: explicación breve en español
- contradictions: lista de contradicciones detectadas (vacía si no hay)

NOTA IMPORTANTE sobre user_intent:
- Si el plugin no puede capturar la instrucción real del usuario,
  llegará un string genérico como "[sesión OpenClaw]".
- En ese caso, el validador NO puede hacer un análisis semántico real.
  Retornamos un score neutral alto (0.85) para no escalar riesgo sin evidencia.
"""
import json
import logging
import httpx
from dataclasses import dataclass, field
from config import get_settings
from typing import Optional

logger = logging.getLogger("agent-lock.intent-validator")
settings = get_settings()

GEMINI_API_URL = (
    "https://generativelanguage.googleapis.com/v1beta/models"
    "/gemini-2.0-flash:generateContent"
)

SYSTEM_PROMPT = """Eres el motor de validación de Agent-Lock, una capa de seguridad para agentes de IA.
Tu trabajo es analizar si la acción que un agente quiere ejecutar coincide con lo que el usuario realmente pidió.

Reglas de análisis:
1. Si la acción parece una consecuencia lógica de la instrucción del usuario, da un score ALTO (0.8-1.0).
   Ejemplo: Usuario pide "optimiza la base de datos" y el agente quiere hacer SELECT → score 0.95
2. Si la acción es destructiva pero el usuario NO pidió borrar nada, da un score MUY BAJO (0.0-0.2).
   Ejemplo: Usuario pide "optimiza" pero el agente intenta DROP TABLE → score 0.1
3. Si la acción no tiene relación clara pero no es destructiva, score MEDIO (0.5-0.7).
4. Para acciones de lectura/búsqueda/navegación normales, sé tolerante: score alto (0.8+).
5. Solo marca contradicciones cuando hay un conflicto REAL y claro entre instrucción y acción.

SIEMPRE responde ÚNICAMENTE con un JSON válido, sin markdown, sin explicaciones adicionales:
{
  "score": 0.0 a 1.0,
  "analysis": "explicación breve en español (máx 150 chars)",
  "contradictions": ["descripción de contradicción si existe"]
}"""


# Strings genéricos que indican que no hay user_intent real
_GENERIC_INTENTS = {
    "[sesión openclaw]",
    "[sesión openc",
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
    """Detecta si el user_intent es genérico (no fue capturado del usuario real)."""
    return user_intent.strip().lower() in _GENERIC_INTENTS


async def validate_intent(
    user_intent: str,
    tool_name: str,
    args: dict,
    raw_command: Optional[str] = None,
) -> ValidationResult:
    """
    Valida la intención del usuario contra la acción del agente.
    
    Si no hay user_intent real → retorna score neutral (no penaliza).
    Si Gemini no está configurado → fallback por keywords.
    Si Gemini falla → fallback por keywords.
    """
    # ── Sin user_intent real: no podemos validar semánticamente ────────────────
    if _is_generic_intent(user_intent):
        logger.info(
            f"User intent genérico detectado ('{user_intent}'). "
            f"Skipping validación semántica — retornando score neutral."
        )
        return ValidationResult(
            score=0.85,
            analysis="ℹ️ Sin instrucción de usuario capturada. Análisis basado solo en reglas.",
            contradictions=[],
            gemini_used=False,
        )

    # ── Sin API key: fallback ─────────────────────────────────────────────────
    if not settings.gemini_api_key:
        logger.warning("GEMINI_API_KEY no configurada. Usando fallback básico.")
        return _fallback_validate(user_intent, tool_name, args)

    # ── Llamada a Gemini ──────────────────────────────────────────────────────
    args_str = json.dumps(args, ensure_ascii=False, indent=2)
    if len(args_str) > 1500:
        args_str = args_str[:1497] + "..."

    user_message = f"""El usuario le dijo al agente: "{user_intent}"

El agente quiere ejecutar:
- Herramienta: {tool_name}
- Argumentos:
{args_str}
{f'- Comando raw: {raw_command}' if raw_command else ''}

¿La acción es consistente con la instrucción del usuario? Analiza posibles contradicciones."""

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

        # Extraer texto de la respuesta
        text = data["candidates"][0]["content"]["parts"][0]["text"]
        result = json.loads(text)

        score = float(result.get("score", 0.5))
        analysis = str(result.get("analysis", "Sin análisis disponible."))
        contradictions = list(result.get("contradictions", []))

        # Limpiar contradicciones vacías
        contradictions = [c for c in contradictions if c and c.strip()]

        logger.info(
            f"🧠 Gemini validó | tool={tool_name} | score={score:.2f} | "
            f"contradicciones={len(contradictions)} | análisis='{analysis[:80]}'"
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
        logger.error(f"Error parseando respuesta de Gemini: {e}")
        return _fallback_validate(user_intent, tool_name, args)
    except Exception as e:
        logger.error(f"Error inesperado en Gemini validator: {e}")
        return _fallback_validate(user_intent, tool_name, args)


def _fallback_validate(user_intent: str, tool_name: str, args: dict) -> ValidationResult:
    """
    Fallback básico por palabras clave cuando Gemini no está disponible.
    """
    intent_lower = user_intent.lower()
    args_text = " ".join(str(v) for v in args.values()).upper()

    # Detectar operaciones destructivas obvias
    destructive = any(kw in args_text for kw in [
        "DROP", "TRUNCATE", "DELETE FROM", "RM -RF", "RMDIR"
    ])
    read_intent = any(kw in intent_lower for kw in [
        "lee", "leer", "muéstrame", "muestra", "lista", "listar",
        "read", "show", "list", "get", "find", "search", "analyze", "optimiz"
    ])

    if destructive and read_intent:
        return ValidationResult(
            score=0.15,
            analysis="⚠️ Contradicción: instrucción de lectura pero acción destructiva detectada.",
            contradictions=["Acción destructiva detectada con intención de lectura/optimización."],
            gemini_used=False,
        )
    elif destructive:
        return ValidationResult(
            score=0.4,
            analysis="⚠️ Acción destructiva detectada. Requiere verificación.",
            contradictions=[],
            gemini_used=False,
        )
    else:
        return ValidationResult(
            score=0.85,
            analysis="✅ No se detectaron contradicciones obvias (análisis por reglas).",
            contradictions=[],
            gemini_used=False,
        )
