"""
Action Rules — Tabla de clasificación de riesgo por herramienta y patrón de comando.

Filosofía de diseño:
- Solo es CRITICAL lo que destruye datos o expone secretos.
- Solo es HIGH lo que modifica datos de forma irreversible.
- Todo lo demás es LOW (leer, listar, buscar, navegar, escribir archivos de código, etc.)
- El default para herramientas desconocidas es LOW. La escalación la decide Gemini + políticas.
"""
import re
from models import RiskLevel

# ── Patrones de riesgo crítico ────────────────────────────────────────────────
# Solo cosas verdaderamente destructivas o que exponen secretos.
CRITICAL_PATTERNS = [
    # SQL destructivo
    r"\bDROP\b",
    r"\bTRUNCATE\b",
    r"\bDELETE\b\s+FROM",

    # Shell destructivo
    r"rm\s+-rf",
    r"rmdir\s+/s",
    r"del\s+/[fqsS]",
    r"\bshred\b",
    r"\bwipe\b",
    r"\bmkfs\b",

    # Infraestructura destructiva
    r"docker\s+rm",
    r"kubectl\s+delete",
    r"terraform\s+destroy",

    # Exposición de secretos (solo escritura/envío, no lectura de .env)
    r"(password|secret|api.?key)\s*=\s*\S+",
]

# ── Patrones de riesgo alto ───────────────────────────────────────────────────
# Cosas que modifican datos pero no los destruyen completamente.
HIGH_PATTERNS = [
    # SQL modificador
    r"\bALTER\b\s+TABLE",

    # Producción
    r"\bdeploy\b",
    r"\bprod(uction)?\b",

    # Código arbitrario peligroso
    r"\beval\s*\(",
    r"\bexec\s*\(",
    r"\bsubprocess\b",
    r"\bos\.system\b",
    r"__import__",

    # Apagado de sistema
    r"\bshutdown\b",
    r"\breboot\b",
]

# ── Herramientas clasificadas por defecto ─────────────────────────────────────
# La mayoría son LOW. Solo las verdaderamente peligrosas son altas.
TOOL_RISK_MAP: dict[str, RiskLevel] = {
    # ── Bajo riesgo (lectura, escritura normal, navegación) ──
    "read_file": RiskLevel.LOW,
    "list_files": RiskLevel.LOW,
    "search_files": RiskLevel.LOW,
    "web_search": RiskLevel.LOW,
    "get_weather": RiskLevel.LOW,
    "write_file": RiskLevel.LOW,
    "edit_file": RiskLevel.LOW,
    "create_file": RiskLevel.LOW,
    "send_email": RiskLevel.LOW,
    "http_request": RiskLevel.LOW,
    "browser.click": RiskLevel.LOW,
    "browser.open": RiskLevel.LOW,
    "browser.navigate": RiskLevel.LOW,
    "database.query": RiskLevel.LOW,
    "database.read": RiskLevel.LOW,
    "database.insert": RiskLevel.LOW,
    "database.update": RiskLevel.LOW,
    "git_commit": RiskLevel.LOW,
    "git_push": RiskLevel.LOW,

    # ── Alto riesgo (ejecución de código arbitrario) ──
    "execute_code": RiskLevel.HIGH,
    "run_command": RiskLevel.HIGH,
    "bash": RiskLevel.HIGH,
    "terminal": RiskLevel.HIGH,

    # ── Crítico (borrado explícito) ──
    "delete_file": RiskLevel.CRITICAL,
    "rm": RiskLevel.CRITICAL,
    "database.delete": RiskLevel.CRITICAL,
}


def classify_by_content(text: str) -> RiskLevel | None:
    """
    Analiza el texto de un comando/argumento y retorna su nivel de riesgo.
    Retorna None si no hay ningún patrón peligroso detectado.
    """
    for pattern in CRITICAL_PATTERNS:
        if re.search(pattern, text, re.IGNORECASE):
            return RiskLevel.CRITICAL

    for pattern in HIGH_PATTERNS:
        if re.search(pattern, text, re.IGNORECASE):
            return RiskLevel.HIGH

    # No detectamos nada → None (no Low, porque Low no necesita match)
    return None


def get_tool_default_risk(tool_name: str) -> RiskLevel:
    """
    Retorna el nivel de riesgo por defecto de una herramienta.
    
    CAMBIO IMPORTANTE: el default ahora es LOW, no HIGH.
    Herramientas desconocidas se tratan como seguras a menos que
    el contenido de sus args o Gemini digan lo contrario.
    """
    # Coincidencia exacta
    if tool_name in TOOL_RISK_MAP:
        return TOOL_RISK_MAP[tool_name]

    # Coincidencia por substring para herramientas de borrado
    tool_lower = tool_name.lower()
    if any(k in tool_lower for k in ["delete", "remove", "drop", "destroy"]):
        return RiskLevel.CRITICAL
    if any(k in tool_lower for k in ["exec", "run", "bash", "shell"]):
        return RiskLevel.HIGH

    # DEFAULT: LOW — dejamos que Gemini y las políticas escalen si es necesario
    return RiskLevel.LOW
