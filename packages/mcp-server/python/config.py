"""
Configuration for Agent-Lock MCP Gateway.

Defines target MCP servers to proxy and all gateway policy settings.
A default config file is created at ~/.agent-lock/mcp_config.json on
first run if none is found.
"""

from __future__ import annotations

import json
import sys
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any


@dataclass
class TargetServer:
    """Configuration for a single target MCP server subprocess."""

    name: str
    command: str  # executable, e.g. "npx", "python", "uv"
    args: list[
        str
    ]  # CLI arguments, e.g. ["-y", "@anthropic/mcp-server-filesystem", "/path"]
    env: dict[str, str] = field(default_factory=dict)
    enabled: bool = True


@dataclass
class AgentLockMCPConfig:
    """Full configuration for the Agent-Lock MCP Gateway."""

    # ── Target servers ────────────────────────────────────────────────────────
    target_servers: list[TargetServer] = field(default_factory=list)

    # ── Backend ───────────────────────────────────────────────────────────────
    # URL of the Agent-Lock FastAPI backend (risk classification, Telegram, audit).
    # Official cloud: https://agent-lock-backend-api-7.azurewebsites.net
    # Local dev: http://localhost:8000
    backend_url: str = "https://agent-lock-backend-api-7.azurewebsites.net"
    # Optional end-user Auth0 subject token to unlock Token Vault brokered calls.
    # For production prefer short-lived runtime injection via env var.
    subject_token: str | None = None

    # ── Telegram (optional — backend also has its own token) ─────────────────
    telegram_bot_token: str | None = None
    telegram_chat_id: str | None = None

    # ── Risk / approval policies ──────────────────────────────────────────────
    auto_approve_low_risk: bool = True
    require_approval_for_high: bool = True
    require_approval_for_critical: bool = True

    # Maximum seconds to wait for a human Telegram response before timing out.
    # After the timeout the action is cancelled (fail-closed).
    approval_timeout_seconds: float = 300.0  # 5 minutes

    # ── Latency Optimizations ─────────────────────────────────────────────────
    # Local cache TTL for auto-approved LOW risk tools (seconds).
    # 0 to disable local caching.
    local_cache_ttl: int = 3600  # 1 hour

    # ── Audit ─────────────────────────────────────────────────────────────────
    audit_log_path: str = "logs/mcp_audit.jsonl"

    # ── Serialisation helpers ─────────────────────────────────────────────────

    @classmethod
    def from_file(cls, path: str | Path) -> "AgentLockMCPConfig":
        """Load configuration from a JSON file."""
        path = Path(path)
        if not path.exists():
            return cls()

        with open(path, "r", encoding="utf-8") as fh:
            data: dict[str, Any] = json.load(fh)

        servers = [
            TargetServer(
                name=s["name"],
                command=s["command"],
                args=s.get("args", []),
                env=s.get("env", {}),
                enabled=s.get("enabled", True),
            )
            for s in data.get("target_servers", [])
        ]

        return cls(
            target_servers=servers,
            backend_url=data.get("backend_url", "https://agent-lock-backend-api-7.azurewebsites.net"),
            subject_token=data.get("subject_token"),
            telegram_bot_token=data.get("telegram_bot_token"),
            telegram_chat_id=data.get("telegram_chat_id"),
            auto_approve_low_risk=data.get("auto_approve_low_risk", True),
            require_approval_for_high=data.get("require_approval_for_high", True),
            require_approval_for_critical=data.get(
                "require_approval_for_critical", True
            ),
            approval_timeout_seconds=float(data.get("approval_timeout_seconds", 300.0)),
            local_cache_ttl=int(data.get("local_cache_ttl", 3600)),
            audit_log_path=data.get("audit_log_path", "logs/mcp_audit.jsonl"),
        )

    def to_file(self, path: str | Path) -> None:
        """Persist configuration to a JSON file (creates parent directories)."""
        path = Path(path)
        path.parent.mkdir(parents=True, exist_ok=True)

        data: dict[str, Any] = {
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
            "subject_token": self.subject_token,
            "telegram_bot_token": self.telegram_bot_token,
            "telegram_chat_id": self.telegram_chat_id,
            "auto_approve_low_risk": self.auto_approve_low_risk,
            "require_approval_for_high": self.require_approval_for_high,
            "require_approval_for_critical": self.require_approval_for_critical,
            "approval_timeout_seconds": self.approval_timeout_seconds,
            "local_cache_ttl": self.local_cache_ttl,
            "audit_log_path": self.audit_log_path,
        }

        with open(path, "w", encoding="utf-8") as fh:
            json.dump(data, fh, indent=2, ensure_ascii=False)


# ── Default example config (target servers commented out) ─────────────────────

DEFAULT_CONFIG = AgentLockMCPConfig(
    target_servers=[
        # Uncomment and edit to add real target servers:
        #
        # TargetServer(
        #     name="filesystem",
        #     command="npx",
        #     args=["-y", "@anthropic/mcp-server-filesystem", "C:\\Users\\you\\Documents"],
        # ),
        # TargetServer(
        #     name="github",
        #     command="npx",
        #     args=["-y", "@anthropic/mcp-server-github"],
        #     env={"GITHUB_TOKEN": "ghp_xxxx"},
        # ),
        # TargetServer(
        #     name="postgres",
        #     command="npx",
        #     args=["-y", "@anthropic/mcp-server-postgres", "postgresql://localhost/mydb"],
        # ),
    ],
)


# ── load_config ───────────────────────────────────────────────────────────────


def load_config(config_path: str | None = None) -> AgentLockMCPConfig:
    """
    Load the Agent-Lock MCP Gateway configuration.

    Resolution order:
      1. ``config_path`` argument (if provided via --config CLI flag)
      2. ``AGENT_LOCK_MCP_CONFIG`` environment variable
      3. Default location: ``~/.agent-lock/mcp_config.json``

    If the resolved file does not exist, a default config is written to that
    location and returned so the user has a ready-to-edit template.
    """
    import os

    path_str = (
        config_path
        or os.environ.get("AGENT_LOCK_MCP_CONFIG")
        or str(Path.home() / ".agent-lock" / "mcp_config.json")
    )
    path = Path(path_str)

    if path.exists():
        print(f"[Agent-Lock] Loading config from {path}", file=sys.stderr)
        try:
            cfg = AgentLockMCPConfig.from_file(path)
            if not cfg.subject_token:
                cfg.subject_token = os.environ.get("AGENT_LOCK_SUBJECT_TOKEN")
            return cfg
        except Exception as exc:
            print(
                f"[Agent-Lock] ⚠️  Failed to parse config at {path}: {exc}\n"
                "             Falling back to defaults.",
                file=sys.stderr,
            )
            return AgentLockMCPConfig()

    # First run — create a default config file so the user has a template.
    print(
        f"[Agent-Lock] No config found at {path}. Creating default template ...",
        file=sys.stderr,
    )
    default = AgentLockMCPConfig(subject_token=os.environ.get("AGENT_LOCK_SUBJECT_TOKEN"))
    try:
        default.to_file(path)
        print(
            f"[Agent-Lock] ✅ Default config written to {path}\n"
            "             Edit it to add your target MCP servers.",
            file=sys.stderr,
        )
    except Exception as exc:
        print(
            f"[Agent-Lock] ⚠️  Could not write default config to {path}: {exc}",
            file=sys.stderr,
        )

    return default
