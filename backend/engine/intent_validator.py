"""
Intent Validator powered by Gemini Flash (gemini-2.0-flash-latest)

Gemini analiza semánticamente si la acción del agente coincide
con la intención del usuario y retorna:
- score: 0.0 (no coincide) → 1.0 (coincide perfectamente)
- analysis: explicación en español, lista para mostrar en Telegram
- contradictions: lista de contradicciones detectadas (vacía si no hay)
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

SYSTEM_PROMPT = """Eres el motor de validación de Agent-Lock, una capa de seguridad para agentes de IA.
Tu trabajo es analizar si la acción que un agente quiere ejecutar coincide con lo que el usuario realmente pidió.

Debes ser:
- Estricto con acciones destructivas (DROP, DELETE, rm -rf, etc.)
- Tolerante con acciones de lectura/optimización
- Capaz de detectar contradicciones semánticas sutiles
- Conciso y claro en español

SIEMPRE responde ÚNICAMENTE con un JSON válido, sin markdown, sin explicaciones adicionales:
{
  "score": 0.0 a 1.0,
  "analysis": "explicación breve en español (máx 120 chars)",
  "contradictions": ["descripción de contradicción si existe", ...]
}"""


@dataclass
class ValidationResult:
    score: float
    analysis: str
    contradictions: list[str] = field(default_factory=list)


async def validate_intent(
    user_intent: str,
    tool_name: str,
    args: dict,
    raw_command: str | None = None,
) -> ValidationResult:
    """
    Llama a Gemini Flash para validar si la acción del agente coincide
    con la intención del usuario.

    Si la API key no está configurada, cae de vuelta a análisis básico por keywords.
    """
    if not settings.gemini_api_key:
        logger.warning("GEMINI_API_KEY no configurada. Usando fallback básico.")
        return _fallback_validate(user_intent, tool_name, args)

    args_str = json.dumps(args, ensure_ascii=False, indent=2)
    if len(args_str) > 1500:
        args_str = args_str[:1497] + "..."

    user_message = f"""Usuario dijo: "{user_intent}"

El agente quiere ejecutar:
- Herramienta: {tool_name}
- Argumentos:
{args_str}
{f'- Comando raw: {raw_command}' if raw_command else ''}

Analiza si esta acción es consistente con la instrucción del usuario."""

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

        return ValidationResult(
            score=float(result.get("score", 0.5)),
            analysis=str(result.get("analysis", "Sin análisis disponible.")),
            contradictions=list(result.get("contradictions", [])),
        )

    except httpx.HTTPStatusError as e:
        logger.error(f"Gemini HTTP error {e.response.status_code}: {e.response.text}")
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
    destructive = any(kw in args_text for kw in ["DROP", "TRUNCATE", "DELETE FROM", "RM -RF", "RMDIR"])
    read_intent = any(kw in intent_lower for kw in [
        "lee", "leer", "muéstrame", "muestra", "lista", "listar",
        "read", "show", "list", "get", "find", "search", "analyze", "optimiz"
    ])

    if destructive and read_intent:
        return ValidationResult(
            score=0.2,
            analysis="⚠️ Posible contradicción: intención de lectura/optimización pero acción destructiva.",
            contradictions=["Acción destructiva detectada con intención de lectura/optimización."],
        )
    elif destructive:
        return ValidationResult(
            score=0.5,
            analysis="⚠️ Acción destructiva detectada. Verifica que esto es lo que querías.",
            contradictions=[],
        )
    else:
        return ValidationResult(
            score=0.75,
            analysis="✅ No se detectaron contradicciones obvias (análisis básico, Gemini no disponible).",
            contradictions=[],
        )
