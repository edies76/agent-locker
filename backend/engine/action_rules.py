"""
Action Rules — Tabla de clasificación de riesgo por herramienta y patrón de comando.

Lógica:
- Se evalúa el tool_name y el raw_command/args contra patrones regex
- El nivel más alto que coincide gana
- Las reglas se pueden extender fácilmente
"""
import re
from models import RiskLevel

# ── Patrones de riesgo crítico ────────────────────────────────────────────────
CRITICAL_PATTERNS = [
    # SQL destructivo
    r"\bDROP\b",
    r"\bTRUNCATE\b",
    r"\bDELETE\b\s+FROM",
    r"\bALTER\b\s+TABLE",

    # Shell destructivo
    r"rm\s+-rf",
    r"rmdir\s+/s",
    r"format\b",
    r"del\s+/[fqsS]",
    r"shutdown",
    r"reboot",

    # Código arbitrario
    r"\beval\s*\(",
    r"\bexec\s*\(",
    r"\bsubprocess\b",
    r"\bos\.system\b",
    r"__import__",

    # Producción / infraestructura
    r"\bprod(uction)?\b",
    r"\bdeploy\b",
    r"docker\s+rm",
    r"kubectl\s+delete",
    r"terraform\s+destroy",

    # Credenciales / secretos
    r"(password|secret|token|api.?key)\s*=",
    r"\.env",
    r"credentials",
]

# ── Patrones de riesgo alto ───────────────────────────────────────────────────
HIGH_PATTERNS = [
    # SQL modificador
    r"\bINSERT\b",
    r"\bUPDATE\b",
    r"\bMERGE\b",
    r"\bREPLACE\b",

    # Archivos (escritura)
    r"write_?file",
    r"save_?file",
    r"open\(.*['\"]w['\"]",
    r"shutil\.copy",
    r"shutil\.move",

    # Git modificador
    r"git\s+(push|commit|merge|rebase|reset)",

    # Red (POST/PUT/DELETE)
    r"\b(POST|PUT|PATCH|DELETE)\b",

    # Permisos
    r"chmod",
    r"chown",
]

# ── Patrones de riesgo bajo (read-only / seguro) ──────────────────────────────
LOW_PATTERNS = [
    r"\bSELECT\b",
    r"\bSHOW\b",
    r"\bDESCRIBE\b",
    r"\bEXPLAIN\b",
    r"read_?file",
    r"list_?files",
    r"\bls\b",
    r"\bdir\b",
    r"\bcat\b",
    r"\becho\b",
    r"\bcurl\b.*-[Gg]\b",
    r"\bGET\b",
    r"\bping\b",
    r"git\s+(log|status|diff|fetch|pull)",
]

# ── Herramientas clasificadas por defecto ─────────────────────────────────────
TOOL_RISK_MAP: dict[str, RiskLevel] = {
    # Bajo riesgo por defecto
    "read_file": RiskLevel.LOW,
    "list_files": RiskLevel.LOW,
    "search_files": RiskLevel.LOW,
    "web_search": RiskLevel.LOW,
    "get_weather": RiskLevel.LOW,
    "database.query": RiskLevel.HIGH,  # Depende del contenido → se eleva si aplica

    # Alto riesgo por defecto
    "write_file": RiskLevel.HIGH,
    "send_email": RiskLevel.HIGH,
    "http_request": RiskLevel.HIGH,
    "browser.click": RiskLevel.HIGH,

    # Crítico por defecto
    "execute_code": RiskLevel.CRITICAL,
    "run_command": RiskLevel.CRITICAL,
    "bash": RiskLevel.CRITICAL,
    "terminal": RiskLevel.CRITICAL,
    "delete_file": RiskLevel.CRITICAL,
}


def classify_by_content(text: str) -> RiskLevel | None:
    """Analiza el texto de un comando/argumento y retorna su nivel de riesgo, o None si no hay match."""
    text_upper = text.upper()

    for pattern in CRITICAL_PATTERNS:
        if re.search(pattern, text, re.IGNORECASE):
            return RiskLevel.CRITICAL

    for pattern in HIGH_PATTERNS:
        if re.search(pattern, text, re.IGNORECASE):
            return RiskLevel.HIGH

    for pattern in LOW_PATTERNS:
        if re.search(pattern, text, re.IGNORECASE):
            return RiskLevel.LOW

    return None


def get_tool_default_risk(tool_name: str) -> RiskLevel:
    """Retorna el nivel de riesgo por defecto de una herramienta conocida."""
    # Buscar coincidencia exacta primero
    if tool_name in TOOL_RISK_MAP:
        return TOOL_RISK_MAP[tool_name]

    # Buscar por prefijo/substring
    tool_lower = tool_name.lower()
    if any(k in tool_lower for k in ["delete", "remove", "drop", "destroy", "exec", "run", "bash"]):
        return RiskLevel.CRITICAL
    if any(k in tool_lower for k in ["write", "create", "update", "send", "post", "modify"]):
        return RiskLevel.HIGH

    # Por defecto: HIGH (mejor pedir permiso que arrepentirse)
    return RiskLevel.HIGH
