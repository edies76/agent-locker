"""
Risk Classifier — Combina reglas de herramienta + análisis Gemini + políticas
para decidir el nivel de riesgo final.

Filosofía:
- El riesgo base viene de la herramienta y el contenido de los args.
- Gemini puede ESCALAR el riesgo si detecta contradicciones reales.
- Gemini NO debería escalar cosas normales. Solo escala si el score es
  realmente bajo (<0.3) y hay contradicciones explícitas.
- Las políticas manuales (policies.json) son el override final.
"""
import json
import os
import re
from models import RiskLevel
from engine.action_rules import classify_by_content, get_tool_default_risk
from engine.intent_validator import ValidationResult


def _load_policies():
    path = os.path.join(os.path.dirname(__file__), "..", "policies.json")
    if not os.path.exists(path):
        return []
    try:
        with open(path, "r", encoding="utf-8") as f:
            data = json.load(f)
            return data.get("policies", [])
    except Exception:
        return []


def classify_risk(
    tool_name: str,
    args: dict,
    raw_command: str | None,
    intent_result: ValidationResult,
) -> RiskLevel:
    """
    Pipeline de clasificación de riesgo:
    
    0. Políticas manuales (override absoluto)
    1. Riesgo base por herramienta
    2. Riesgo por contenido de los argumentos
    3. Ajuste por Gemini (solo escala si hay contradicciones REALES)
    """
    # ── 0. POLÍTICAS MANUALES (Override absoluto) ─────────────────────────────
    policies = _load_policies()
    combined_text = _flatten_args(args)
    if raw_command:
        combined_text += " " + raw_command

    for p in policies:
        try:
            if re.match(p["tool_pattern"], tool_name) and \
               re.search(p["condition"], combined_text, re.IGNORECASE):
                if p["action"] == "FORCE_PENDING":
                    return RiskLevel.CRITICAL
        except re.error:
            continue

    # ── 1. Riesgo base del tool ───────────────────────────────────────────────
    tool_risk = get_tool_default_risk(tool_name)

    # ── 2. Riesgo por contenido de los args ───────────────────────────────────
    content_risk = classify_by_content(combined_text)

    if content_risk is None:
        # Sin match de contenido → usar el riesgo del tool tal cual
        base_risk = tool_risk
    elif content_risk == RiskLevel.LOW:
        # Contenido explícitamente seguro (echo, Write-Host, ls, etc.)
        # → baja el riesgo del tool si era HIGH (exec con echo no es peligroso)
        # → respeta CRITICAL del tool (delete_file con echo sigue siendo CRITICAL)
        if tool_risk == RiskLevel.HIGH:
            base_risk = RiskLevel.LOW
        else:
            base_risk = tool_risk
    else:
        # Contenido peligroso → tomar el máximo entre tool y contenido
        base_risk = _max_risk(tool_risk, content_risk)

    # ── 3. Ajuste por Gemini ──────────────────────────────────────────────────
    # Solo escalamos si Gemini tiene información suficiente para decidir.
    # Si no hay user_intent real (score genérico), NO escalamos.
    if intent_result.contradictions and intent_result.score < 0.3:
        # Gemini encontró contradicciones reales y tiene alta confianza de mismatch
        base_risk = _escalate(base_risk)

    return base_risk


def _flatten_args(args: dict) -> str:
    parts = []
    for v in args.values():
        if isinstance(v, str):
            parts.append(v)
        elif isinstance(v, (list, tuple)):
            parts.extend(str(item) for item in v)
        elif isinstance(v, dict):
            parts.append(_flatten_args(v))
        else:
            parts.append(str(v))
    return " ".join(parts)


def _risk_level_int(risk: RiskLevel) -> int:
    return {RiskLevel.LOW: 0, RiskLevel.HIGH: 1, RiskLevel.CRITICAL: 2}[risk]


def _max_risk(a: RiskLevel, b: RiskLevel) -> RiskLevel:
    levels = [RiskLevel.LOW, RiskLevel.HIGH, RiskLevel.CRITICAL]
    return levels[max(_risk_level_int(a), _risk_level_int(b))]


def _escalate(risk: RiskLevel) -> RiskLevel:
    if risk == RiskLevel.LOW:
        return RiskLevel.HIGH
    return RiskLevel.CRITICAL
