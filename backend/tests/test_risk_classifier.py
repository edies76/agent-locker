from engine.action_rules import classify_by_content, get_tool_default_risk
from engine.risk_classifier import classify_risk
from engine.intent_validator import ValidationResult
from models import RiskLevel


def _intent(score: float = 0.9, mode: str = "rules", contradictions=None) -> ValidationResult:
    return ValidationResult(
        score=score,
        analysis="test",
        contradictions=contradictions or [],
        gemini_used=False,
        mode=mode,
    )


def test_safe_shell_pattern_downgrades_exec_to_low():
    risk = classify_risk(
        tool_name="exec",
        args={"command": "echo hello"},
        raw_command="echo hello",
        intent_result=_intent(),
    )
    assert risk == RiskLevel.LOW


def test_dangerous_sql_escalates_to_critical():
    risk = classify_risk(
        tool_name="database.query",
        args={"query": "DROP TABLE users"},
        raw_command=None,
        intent_result=_intent(),
    )
    assert risk == RiskLevel.CRITICAL


def test_intrinsic_low_score_escalates_risk():
    risk = classify_risk(
        tool_name="read_file",
        args={"path": "README.md"},
        raw_command=None,
        intent_result=_intent(score=0.1, mode="intrinsic"),
    )
    assert risk == RiskLevel.HIGH


def test_tool_default_risk_fallback():
    assert get_tool_default_risk("delete_database") == RiskLevel.CRITICAL
    assert get_tool_default_risk("run_script") == RiskLevel.HIGH
    assert get_tool_default_risk("random_tool") == RiskLevel.LOW


def test_classify_by_content_low_pattern():
    assert classify_by_content("Write-Host 'ok'") == RiskLevel.LOW
