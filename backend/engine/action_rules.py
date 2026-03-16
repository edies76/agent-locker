"""
Action Rules — Tabla de clasificación de riesgo por herramienta y patrón de comando.

Filosofía:
- Solo es CRITICAL lo que destruye datos o expone secretos.
- Solo es HIGH lo que ejecuta código arbitrario / modifica infra.
- LOW_SHELL_PATTERNS: si el CONTENIDO del comando es claramente seguro,
  baja el riesgo aunque la herramienta sea "exec" o "bash".
- Default para herramientas desconocidas: LOW.
"""
from __future__ import annotations
import re
from models import RiskLevel


# ── Patrones de riesgo crítico ────────────────────────────────────────────────
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

    # Exposición de secretos
    r"(password|secret|api.?key)\s*=\s*\S+",
]

# ── Patrones de riesgo alto ───────────────────────────────────────────────────
HIGH_PATTERNS = [
    r"\bALTER\b\s+TABLE",
    r"\bdeploy\b",
    r"\bprod(uction)?\b",
    r"\beval\s*\(",
    r"\bexec\s*\(",        # exec() como función Python/JS, no el tool exec de OpenClaw
    r"\bsubprocess\b",
    r"\bos\.system\b",
    r"__import__",
    r"\bshutdown\b",
    r"\breboot\b",
]

# ── Patrones de bajo riesgo (comandos shell seguros / display) ────────────────
# Si el CONTENIDO del comando coincide con esto, se considera seguro
# aunque la herramienta sea "exec" o "bash".
LOW_SHELL_PATTERNS = [
    # PowerShell — solo display o lectura
    r"\bWrite-Host\b",
    r"\bWrite-Output\b",
    r"\bWrite-Verbose\b",
    r"\bWrite-Debug\b",
    r"\bGet-\w+",              # Cualquier Get-* de PS es solo lectura
    r"\bTest-\w+",             # Test-Path, Test-Connection, etc.
    r"\bResolve-\w+",          # Resolve-Path, Resolve-DnsName, etc.
    r"\bSelect-\w+",           # Select-Object, Select-String, etc.
    r"\bWhere-\w+",            # Where-Object
    r"\bOut-\w+",              # Out-String, Out-Host, Out-File (display)
    r"\bFormat-\w+",           # Format-Table, Format-List, etc.
    r"\bMeasure-\w+",          # Measure-Object
    r"\bConvertTo-\w+",        # ConvertTo-Json, ConvertTo-Html, etc.
    r"\bConvertFrom-\w+",      # ConvertFrom-Json, etc.
    r"\bImport-\w+",           # Import-Csv, Import-Module
    r"\bExport-\w+",           # Export-Csv, etc.
    r"\bSet-Location\b",       # cd equivalente en PS
    r"\bPush-Location\b",
    r"\bPop-Location\b",
    # PS — creación/escritura de archivos (equivalente a write_file, que ya es LOW)
    r"\bNew-Item\b",           # Crea archivos o carpetas
    r"\bNew-Object\b",         # Crea objetos .NET, no destructivo
    r"\bSet-Content\b",        # Escribe en archivo (equivalente a write_file)
    r"\bAdd-Content\b",        # Añade al final de un archivo
    r"\bOut-File\b",           # Redirige output a archivo
    r"\bCopy-Item\b",          # Copia archivos (no destruye el original)
    r"\bRename-Item\b",        # Renombra (borderline pero no crítico)
    r"\bMove-Item\b",          # Mueve (no destruye datos)
    r"\bInvoke-WebRequest\b",  # HTTP request (ya es LOW como http_request)
    r"\bInvoke-RestMethod\b",  # REST API call

    # Bash/cmd — display, navegación y escritura normal
    r"^\s*echo\b",
    r"^\s*printf\b",
    r"^\s*print\b",
    r"^\s*cat\b",
    r"^\s*ls\b",
    r"^\s*dir\b",
    r"^\s*pwd\b",
    r"^\s*whoami\b",
    r"^\s*type\b",
    r"^\s*cd\b",
    r"^\s*find\b",
    r"^\s*mkdir\b",            # Crear carpeta
    r"^\s*touch\b",            # Crear archivo vacío
    r"^\s*cp\b",               # Copiar
    r"^\s*mv\b",               # Mover
    r"\bconsole\.log\b",
    r"^\s*python\b.*print",
    r"^\s*node\b.*console",

    # Red (solo lectura)
    r"^\s*ping\b",
    r"\bcurl\b.+-[Gg]\b",
    r"\bgit\s+(log|status|diff|fetch|pull|branch|show|stash list)\b",
    r"\bdocker\s+(ps|images|inspect|logs|stats|info)\b",
    r"\bnpm\s+(list|ls|view|info|audit|outdated)\b",
    r"\bpip\b.*(list|show|freeze|check)\b",

    # SQL lectura
    r"\bSELECT\b",
    r"\bSHOW\b",
    r"\bDESCRIBE\b",
    r"\bEXPLAIN\b",
]

# ── Herramientas clasificadas por defecto ─────────────────────────────────────
TOOL_RISK_MAP: dict[str, RiskLevel] = {
    # Bajo riesgo
    "read_file":       RiskLevel.LOW,
    "list_files":      RiskLevel.LOW,
    "search_files":    RiskLevel.LOW,
    "web_search":      RiskLevel.LOW,
    "get_weather":     RiskLevel.LOW,
    "write_file":      RiskLevel.LOW,
    "edit_file":       RiskLevel.LOW,
    "create_file":     RiskLevel.LOW,
    "send_email":      RiskLevel.LOW,
    "http_request":    RiskLevel.LOW,
    "browser.click":   RiskLevel.LOW,
    "browser.open":    RiskLevel.LOW,
    "browser.navigate":RiskLevel.LOW,
    "database.query":  RiskLevel.LOW,
    "database.read":   RiskLevel.LOW,
    "database.insert": RiskLevel.LOW,
    "database.update": RiskLevel.LOW,
    "git_commit":      RiskLevel.LOW,
    "git_push":        RiskLevel.LOW,

    # Alto riesgo — ejecución de código arbitrario
    "exec":            RiskLevel.HIGH,   # Tool de OpenClaw para shell (se puede bajar por contenido)
    "execute_code":    RiskLevel.HIGH,
    "run_command":     RiskLevel.HIGH,
    "bash":            RiskLevel.HIGH,
    "terminal":        RiskLevel.HIGH,

    # Crítico — borrado explícito
    "delete_file":     RiskLevel.CRITICAL,
    "rm":              RiskLevel.CRITICAL,
    "database.delete": RiskLevel.CRITICAL,
}


def classify_by_content(text: str) -> RiskLevel | None:
    """
    Analiza el texto y retorna el nivel de riesgo según el contenido.

    Orden de evaluación:
    1. CRITICAL  → si hay algo destructivo → retorna CRITICAL
    2. HIGH      → si hay algo peligroso   → retorna HIGH
    3. LOW       → si es explícitamente seguro → retorna LOW  (baja el riesgo del tool!)
    4. None      → sin match, dejar que el default del tool decida
    """
    for pattern in CRITICAL_PATTERNS:
        if re.search(pattern, text, re.IGNORECASE):
            return RiskLevel.CRITICAL

    for pattern in HIGH_PATTERNS:
        if re.search(pattern, text, re.IGNORECASE):
            return RiskLevel.HIGH

    # Si el contenido es explícitamente seguro, BAJA el riesgo
    for pattern in LOW_SHELL_PATTERNS:
        if re.search(pattern, text, re.IGNORECASE | re.MULTILINE):
            return RiskLevel.LOW

    return None


def get_tool_default_risk(tool_name: str) -> RiskLevel:
    """Retorna el riesgo base de una herramienta. Default: LOW."""
    if tool_name in TOOL_RISK_MAP:
        return TOOL_RISK_MAP[tool_name]

    tool_lower = tool_name.lower()
    if any(k in tool_lower for k in ["delete", "remove", "drop", "destroy"]):
        return RiskLevel.CRITICAL
    if any(k in tool_lower for k in ["exec", "run", "bash", "shell"]):
        return RiskLevel.HIGH

    return RiskLevel.LOW
