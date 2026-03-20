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
    AUTH_REQUIRED = "AUTH_REQUIRED"


# ── OpenClaw Plugin → Backend Payload ───────────────────────────────────────

class ToolCallRequest(BaseModel):
    """Payload arriving from the OpenClaw plugin when it intercepts a tool call."""
    tool_name: str = Field(..., description="Name of the tool the agent wants to execute")
    args: dict[str, Any] = Field(default_factory=dict, description="Arguments of the tool")
    user_intent: Optional[str] = Field(
        default="",
        description="The original user instruction to the agent. Empty if not captured.",
    )
    agent_id: Optional[str] = Field(None, description="Agent ID (if available)")
    session_key: Optional[str] = Field(None, description="OpenClaw session key")
    raw_command: Optional[str] = Field(None, description="The exact command as a string, if applicable")
    subject_token: Optional[str] = Field(
        default=None,
        description="End-user or composite (sub+act) bearer token for token-exchange.",
    )


# ── Backend → Plugin Response ───────────────────────────────────────────────

class InterceptResponse(BaseModel):
    """Immediate response to the plugin after receiving the intercept."""
    action_id: str = Field(..., description="Unique ID of this action for polling")
    status: ActionStatus
    risk_level: RiskLevel
    intent_score: float = Field(..., ge=0.0, le=1.0, description="0=no match, 1=perfect match")
    analysis: str = Field(..., description="Readable explanation of the analysis")
    auth_token: Optional[str] = Field(None, description="Minimum permission Auth0 token (only if AUTO_APPROVED)")
    login_url: Optional[str] = Field(None, description="Login URL if AUTH_REQUIRED")


class StatusResponse(BaseModel):
    """Plugin response during status polling."""
    action_id: str
    status: ActionStatus
    auth_token: Optional[str] = Field(None, description="Injectable Auth0 token (only if APPROVED)")
    login_url: Optional[str] = Field(None, description="Login URL if AUTH_REQUIRED")
    decided_at: Optional[datetime] = None


# ── Approval ────────────────────────────────────────────────────────────────

class ApprovalDecision(str, Enum):
    YES = "YES"
    NO = "NO"


class ApprovalRequest(BaseModel):
    decision: ApprovalDecision


# ── Internal State of Pending Actions ───────────────────────────────────────

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
    subject_token: Optional[str] = None
    login_url: Optional[str] = None


# ── Audit Log Record ────────────────────────────────────────────────────────

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
    
    # Internal validation flag from the HMAC signature
    # Pydantic doesn't serialize fields starting with "_" by default,
    # so we use an alias or specify it explicitly. But for simplicity:
    signature_valid: Optional[bool] = Field(None, alias="_signature_valid")
