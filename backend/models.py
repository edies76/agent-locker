from pydantic import BaseModel, Field
from typing import Any, Optional, Literal
from enum import Enum
from datetime import datetime
import uuid


class RiskLevel(str, Enum):
    LOW = "LOW"
    HIGH = "HIGH"
    CRITICAL = "CRITICAL"


class ActionStatus(str, Enum):
    PENDING = "PENDING"
    APPROVED = "APPROVED"
    BLOCKED = "BLOCKED"
    AUTO_APPROVED = "AUTO_APPROVED"


# ── Payload del plugin de OpenClaw → Backend ──────────────────────────────────

class ToolCallRequest(BaseModel):
    """Payload que llega desde el plugin de OpenClaw cuando intercepta un tool call."""
    tool_name: str = Field(..., description="Nombre de la herramienta que el agente quiere ejecutar")
    args: dict[str, Any] = Field(default_factory=dict, description="Argumentos de la herramienta")
    user_intent: str = Field(..., description="La instrucción original del usuario al agente")
    agent_id: Optional[str] = Field(None, description="ID del agente (si está disponible)")
    session_key: Optional[str] = Field(None, description="Clave de sesión de OpenClaw")
    raw_command: Optional[str] = Field(None, description="El comando exacto como string, si aplica")


# ── Respuesta del Backend → Plugin ────────────────────────────────────────────

class InterceptResponse(BaseModel):
    """Respuesta inmediata al plugin tras recibir el intercept."""
    action_id: str = Field(..., description="ID único de esta acción para polling")
    status: ActionStatus
    risk_level: RiskLevel
    intent_score: float = Field(..., ge=0.0, le=1.0, description="0=no coincide, 1=coincide perfectamente")
    analysis: str = Field(..., description="Explicación legible del análisis")
    auth_token: Optional[str] = Field(None, description="Token Auth0 de mínimos permisos (solo si AUTO_APPROVED)")


class StatusResponse(BaseModel):
    """Respuesta al plugin en el polling de estado."""
    action_id: str
    status: ActionStatus
    auth_token: Optional[str] = Field(None, description="Token Auth0 inyectable (solo si APPROVED)")
    decided_at: Optional[datetime] = None


# ── Aprobación ────────────────────────────────────────────────────────────────

class ApprovalDecision(str, Enum):
    YES = "YES"
    NO = "NO"


class ApprovalRequest(BaseModel):
    decision: ApprovalDecision


# ── Estado interno de acciones pendientes ─────────────────────────────────────

class PendingAction(BaseModel):
    action_id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    tool_name: str
    args: dict[str, Any]
    user_intent: str
    agent_id: Optional[str] = None
    session_key: Optional[str] = None
    raw_command: Optional[str] = None
    risk_level: RiskLevel
    intent_score: float
    analysis: str
    status: ActionStatus = ActionStatus.PENDING
    created_at: datetime = Field(default_factory=datetime.utcnow)
    decided_at: Optional[datetime] = None
    auth_token: Optional[str] = None


# ── Registro de Audit Log ─────────────────────────────────────────────────────

class AuditLog(BaseModel):
    action_id: str
    timestamp: datetime
    tool_name: str
    args: dict[str, Any]
    user_intent: str
    agent_id: Optional[str]
    risk_level: RiskLevel
    intent_score: float
    analysis: str
    decision: ActionStatus
    decided_at: Optional[datetime]
