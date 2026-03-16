"""
Action Rules — Risk classification table by tool and command pattern.

Philosophy:
- Only CRITICAL: Items that destroy data or expose secrets.
- Only HIGH: Items that execute arbitrary code / modify infrastructure.
- LOW_SHELL_PATTERNS: If command CONTENT is clearly safe, 
  downgrade risk even if the tool is "exec" or "bash".
- Default for unknown tools: LOW.
"""
from __future__ import annotations
import re
from models import RiskLevel

# ── Critical Risk Patterns ───────────────────────────────────────────────────
CRITICAL_PATTERNS = [
    # Destructive SQL
    r"\bDROP\b",
    r"\bTRUNCATE\b",
    r"\bDELETE\b\s+FROM",

    # Destructive Shell
    r"rm\s+-rf",
    r"rmdir\s+/s",
    r"del\s+/[fqsS]",
    r"\bshred\b",
    r"\bwipe\b",
    r"\bmkfs\b",

    # Destructive Infrastructure
    r"docker\s+rm",
    r"kubectl\s+delete",
    r"terraform\s+destroy",

    # Secret Exposure
    r"(password|secret|api.?key)\s*=\s*\S+",
]

# ── High Risk Patterns ────────────────────────────────────────────────────────
HIGH_PATTERNS = [
    r"\bALTER\b\s+TABLE",
    r"\bdeploy\b",
    r"\bprod(uction)?\b",
    r"\beval\s*\(",
    r"\bexec\s*\(",        # exec() as a Python/JS function, not the OpenClaw tool
    r"\bsubprocess\b",
    r"\bos\.system\b",
    r"__import__",
    r"\bshutdown\b",
    r"\breboot\b",
]

# ── Low Risk Patterns (Safe shell commands / Display) ────────────────────────
# If command CONTENT matches these, it's considered safe
# even if the tool is "exec" or "bash".
LOW_SHELL_PATTERNS = [
    # PowerShell — Display and read-only
    r"\bWrite-Host\b",
    r"\bWrite-Output\b",
    r"\bWrite-Verbose\b",
    r"\bWrite-Debug\b",
    r"\bGet-\w+",              # Any PS Get-* is read-only
    r"\bGetFolderPath\s*\(",   # [Environment]::GetFolderPath('Desktop')
    r"\[Environment\]::GetFolderPath\s*\(",
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
    r"\bSet-Location\b",       # cd equivalent in PS
    r"\bPush-Location\b",
    r"\bPop-Location\b",
    # PS — File creation/writing (equivalent to write_file, already LOW)
    r"\bNew-Item\b",           # Creates files or folders
    r"\bNew-Object\b",         # Creates .NET objects, non-destructive
    r"\bSet-Content\b",        # Writes to file (equivalent to write_file)
    r"\bAdd-Content\b",        # Appends to a file
    r"\bOut-File\b",           # Redirects output to file
    r"\bCopy-Item\b",          # Copies files (non-destructive)
    r"\bRename-Item\b",        # Renames (borderline but non-critical)
    r"\bMove-Item\b",          # Moves (no data loss)
    r"\bInvoke-WebRequest\b",  # HTTP request (already LOW as http_request)
    r"\bInvoke-RestMethod\b",  # REST API call

    # Bash/cmd — Display, navigation, and normal writing
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
    r"^\s*mkdir\b",            # Create folder
    r"^\s*touch\b",            # Create empty file
    r"^\s*cp\b",               # Copy
    r"^\s*mv\b",               # Move
    r"\bconsole\.log\b",
    r"^\s*python\b.*print",
    r"^\s*node\b.*console",

    # Network (Read-only)
    r"^\s*ping\b",
    r"\bcurl\b.+-[Gg]\b",
    r"\bgit\s+(log|status|diff|fetch|pull|branch|show|stash list)\b",
    r"\bdocker\s+(ps|images|inspect|logs|stats|info)\b",
    r"\bnpm\s+(list|ls|view|info|audit|outdated)\b",
    r"\bpip\b.*(list|show|freeze|check)\b",

    # Read SQL
    r"\bSELECT\b",
    r"\bSHOW\b",
    r"\bDESCRIBE\b",
    r"\bEXPLAIN\b",
]

# ── Tool Default Risk Mapping ────────────────────────────────────────────────
TOOL_RISK_MAP: dict[str, RiskLevel] = {
    # Low Risk
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

    # High Risk — Arbitrary code execution
    "exec":            RiskLevel.HIGH,   # OpenClaw tool for shell (content can downgrade)
    "execute_code":    RiskLevel.HIGH,
    "run_command":     RiskLevel.HIGH,
    "bash":            RiskLevel.HIGH,
    "terminal":        RiskLevel.HIGH,

    # Critical — Explicit deletion
    "delete_file":     RiskLevel.CRITICAL,
    "rm":              RiskLevel.CRITICAL,
    "database.delete": RiskLevel.CRITICAL,
}


def classify_by_content(text: str) -> RiskLevel | None:
    """
    Analyzes text and returns the risk level based on content.

    Evaluation Order:
    1. CRITICAL  → if destructive content → returns CRITICAL
    2. HIGH      → if dangerous content    → returns HIGH
    3. LOW       → if explicitly safe content → returns LOW (downgrades tool risk!)
    4. None      → no match, let the tool default decide
    """
    for pattern in CRITICAL_PATTERNS:
        if re.search(pattern, text, re.IGNORECASE):
            return RiskLevel.CRITICAL

    for pattern in HIGH_PATTERNS:
        if re.search(pattern, text, re.IGNORECASE):
            return RiskLevel.HIGH

    # If content is explicitly safe, DOWNGRADE risk
    for pattern in LOW_SHELL_PATTERNS:
        if re.search(pattern, text, re.IGNORECASE | re.MULTILINE):
            return RiskLevel.LOW

    return None


def get_tool_default_risk(tool_name: str) -> RiskLevel:
    """Returns the base risk of a tool. Default: LOW."""
    if tool_name in TOOL_RISK_MAP:
        return TOOL_RISK_MAP[tool_name]

    tool_lower = tool_name.lower()
    if any(k in tool_lower for k in ["delete", "remove", "drop", "destroy"]):
        return RiskLevel.CRITICAL
    if any(k in tool_lower for k in ["exec", "run", "bash", "shell"]):
        return RiskLevel.HIGH

    return RiskLevel.LOW
