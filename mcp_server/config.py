"""
Configuration for Agent-Lock MCP Server.

Defines which target MCP servers to proxy and their configurations.
"""

from dataclasses import dataclass, field
from typing import Any
import json
from pathlib import Path


@dataclass
class TargetServer:
    """A target MCP server that Agent-Lock will proxy to."""
    name: str
    command: str  # e.g., "npx", "python", "uv"
    args: list[str]  # e.g., ["-y", "@anthropic/mcp-server-filesystem"]
    env: dict[str, str] = field(default_factory=dict)
    enabled: bool = True


@dataclass
class AgentLockMCPConfig:
    """Configuration for Agent-Lock MCP Server."""
    
    # Target MCP servers to proxy to
    target_servers: list[TargetServer] = field(default_factory=list)
    
    # Backend API URL (for risk classification, intent validation, approvals)
    backend_url: str = "http://localhost:8000"
    
    # Telegram bot token (for approval notifications)
    telegram_bot_token: str | None = None
    telegram_chat_id: str | None = None
    
    # Risk thresholds
    auto_approve_low_risk: bool = True
    require_approval_for_high: bool = True
    require_approval_for_critical: bool = True
    
    # Audit log path
    audit_log_path: str = "logs/mcp_audit.jsonl"
    
    @classmethod
    def from_file(cls, path: str | Path) -> "AgentLockMCPConfig":
        """Load configuration from JSON file."""
        path = Path(path)
        if not path.exists():
            return cls()
        
        with open(path, "r") as f:
            data = json.load(f)
        
        servers = [
            TargetServer(**s) for s in data.get("target_servers", [])
        ]
        
        return cls(
            target_servers=servers,
            backend_url=data.get("backend_url", "http://localhost:8000"),
            telegram_bot_token=data.get("telegram_bot_token"),
            telegram_chat_id=data.get("telegram_chat_id"),
            auto_approve_low_risk=data.get("auto_approve_low_risk", True),
            require_approval_for_high=data.get("require_approval_for_high", True),
            require_approval_for_critical=data.get("require_approval_for_critical", True),
            audit_log_path=data.get("audit_log_path", "logs/mcp_audit.jsonl"),
        )
    
    def to_file(self, path: str | Path) -> None:
        """Save configuration to JSON file."""
        path = Path(path)
        path.parent.mkdir(parents=True, exist_ok=True)
        
        data = {
            "target_servers": [
                {
                    "name": s.name,
                    "command": s.command,
                    "args": s.args,
                    "env": s.env,
                    "enabled": s.enabled,
                }
                for s in self.target_servers
            ],
            "backend_url": self.backend_url,
            "telegram_bot_token": self.telegram_bot_token,
            "telegram_chat_id": self.telegram_chat_id,
            "auto_approve_low_risk": self.auto_approve_low_risk,
            "require_approval_for_high": self.require_approval_for_high,
            "require_approval_for_critical": self.require_approval_for_critical,
            "audit_log_path": self.audit_log_path,
        }
        
        with open(path, "w") as f:
            json.dump(data, f, indent=2)


# Default configuration with common MCP servers
DEFAULT_CONFIG = AgentLockMCPConfig(
    target_servers=[
        # Example: Filesystem MCP server (official from Anthropic)
        # TargetServer(
        #     name="filesystem",
        #     command="npx",
        #     args=["-y", "@anthropic/mcp-server-filesystem", "/path/to/allowed/dir"],
        # ),
        # Example: GitHub MCP server
        # TargetServer(
        #     name="github",
        #     command="npx",
        #     args=["-y", "@anthropic/mcp-server-github"],
        #     env={"GITHUB_TOKEN": "your-token-here"},
        # ),
    ],
)
