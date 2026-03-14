"""
Risk Classifier — Combines tool rules + Gemini analysis + policies
to decide the final risk level.

Philosophy:
- Base risk comes from the tool and argument content.
- Gemini can ESCALATE risk if it detects real contradictions.
- Gemini SHOULD NOT escalate normal things. Only escalates if the score is
  really low (<0.3) and there are explicit contradictions.
- Manual policies (policies.json) are the final override.
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
    Risk classification pipeline:
    
    0. Manual policies (absolute override)
    1. Base risk by tool
    2. Risk by argument content
    3. Gemini adjustment (only escalates if there are REAL contradictions)
    """
    # ── 0. MANUAL POLICIES (Absolute override) ───────────────────────────────
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

    # ── 1. Tool base risk ────────────────────────────────────────────────────
    tool_risk = get_tool_default_risk(tool_name)

    # ── 2. Risk by argument content ──────────────────────────────────────────
    content_risk = classify_by_content(combined_text)

    if content_risk is None:
        # No content match → use tool risk as is
        base_risk = tool_risk
    elif content_risk == RiskLevel.LOW:
        # Explicitly safe content (echo, Write-Host, ls, etc.)
        # → downgrades risk if it was HIGH (exec with echo is not dangerous)
        # → respects tool's CRITICAL (delete_file with echo is still CRITICAL)
        if tool_risk == RiskLevel.HIGH:
            base_risk = RiskLevel.LOW
        else:
            base_risk = tool_risk
    else:
        # Dangerous content → take the maximum of tool and content
        base_risk = _max_risk(tool_risk, content_risk)

    # ── 3. Gemini adjustment ───────────────────────────────────────────────────
    # We only escalate if Gemini has enough information to decide.
    # If there is no real user_intent (generic score), we DO NOT escalate.
    if intent_result.contradictions and intent_result.score < 0.3:
        # Gemini found real contradictions and has high mismatch confidence
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
