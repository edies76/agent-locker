"""
Risk Classifier — Combina las reglas de herramienta + el score de intent validator
para determinar el nivel de riesgo final de una acción.

Regla general:
- Empieza con el riesgo base de la herramienta (action_rules.py)
- Eleva el riesgo si el contenido de los args es más peligroso
- Eleva el riesgo si el score de intent es bajo (la acción no coincide con lo pedido)
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
    # ── 0. POLÍTICAS CRÍTICAS (Manuales) ──────────────────────────────────────
    # Estas reglas de oro sobreescriben a la IA si es necesario.
    policies = _load_policies()
    combined_text = _flatten_args(args)
    if raw_command: combined_text += " " + raw_command

    for p in policies:
        # Verificar si la herramienta coincide con el patrón
        if re.match(p["tool_pattern"], tool_name):
            # Verificar si el contenido coincide con la condición
            if re.search(p["condition"], combined_text, re.IGNORECASE):
                if p["action"] == "FORCE_PENDING":
                    # Forzamos riesgo crítico para obligar a pedir permiso
                    return RiskLevel.CRITICAL

    # ── 1. Riesgo base del tool ───────────────────────────────────────────────
    tool_risk = get_tool_default_risk(tool_name)

    # ── 2. Riesgo por contenido de args ───────────────────────────────────────
    content_risk = RiskLevel.LOW
    content_match = classify_by_content(combined_text)
    if content_match:
        content_risk = content_match

    # ── 3. Riesgo más alto entre tool y contenido ─────────────────────────────
    base_risk = _max_risk(tool_risk, content_risk)

    # ── 4. Modificar por intent score (IA) ────────────────────────────────────
    if intent_result.score < 0.35:
        base_risk = _escalate(base_risk)
    elif intent_result.score < 0.55 and base_risk == RiskLevel.HIGH:
        base_risk = RiskLevel.CRITICAL

    return base_risk

def _flatten_args(args: dict) -> str:
    parts = []
    for v in args.values():
        if isinstance(v, str): parts.append(v)
        elif isinstance(v, (list, tuple)): parts.extend(str(item) for item in v)
        elif isinstance(v, dict): parts.append(_flatten_args(v))
        else: parts.append(str(v))
    return " ".join(parts)

def _risk_level_int(risk: RiskLevel) -> int:
    return {RiskLevel.LOW: 0, RiskLevel.HIGH: 1, RiskLevel.CRITICAL: 2}[risk]

def _max_risk(a: RiskLevel, b: RiskLevel) -> RiskLevel:
    levels = [RiskLevel.LOW, RiskLevel.HIGH, RiskLevel.CRITICAL]
    return levels[max(_risk_level_int(a), _risk_level_int(b))]

def _escalate(risk: RiskLevel) -> RiskLevel:
    if risk == RiskLevel.LOW: return RiskLevel.HIGH
    return RiskLevel.CRITICAL
