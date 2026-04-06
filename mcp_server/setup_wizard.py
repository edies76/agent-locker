"""
Agent-Lock MCP Setup Wizard
───────────────────────────
Run with:   agent-lock-mcp setup
Or:         python -m mcp_server setup

Guides the user through:
  1. Creating ~/.agent-lock/mcp_config.json
  2. Adding agent-lock to claude_desktop_config.json automatically
  3. Optionally saving a subject_token for Token Vault
"""
from __future__ import annotations

import json
import os
import platform
import sys
from pathlib import Path

BACKEND_URL = "https://agent-lock-backend-api-7.azurewebsites.net"
MCP_CONFIG_DIR = Path.home() / ".agent-lock"
MCP_CONFIG_PATH = MCP_CONFIG_DIR / "mcp_config.json"


def _claude_config_path() -> Path | None:
    """Return the Claude Desktop config path for the current OS, or None."""
    system = platform.system()
    if system == "Windows":
        appdata = os.environ.get("APPDATA") or str(Path.home() / "AppData" / "Roaming")
        return Path(appdata) / "Claude" / "claude_desktop_config.json"
    elif system == "Darwin":  # macOS
        return Path.home() / "Library" / "Application Support" / "Claude" / "claude_desktop_config.json"
    return None


def _detect_python_executable() -> str:
    """Return the best python executable string to embed in claude config."""
    # Prefer uvx if available (cleanest experience), then pipx, then sys.executable
    import shutil
    if shutil.which("uvx"):
        return "uvx"
    if shutil.which("pipx"):
        return "pipx"
    # Fallback: use the current Python executable (full path, reliable)
    return sys.executable


def _build_claude_entry(python_exe: str) -> dict:
    """Build the claude_desktop_config.json mcpServers entry."""
    if python_exe in ("uvx", "pipx"):
        return {
            "command": python_exe,
            "args": ["agent-lock-mcp"],
        }
    else:
        # Full python path with -m flag
        return {
            "command": python_exe,
            "args": ["-m", "mcp_server"],
        }


def _write_mcp_config(subject_token: str | None = None) -> None:
    """Create the default ~/.agent-lock/mcp_config.json."""
    MCP_CONFIG_DIR.mkdir(parents=True, exist_ok=True)
    config: dict = {
        "backend_url": BACKEND_URL,
        "subject_token": subject_token or "",
        "auto_approve_low_risk": True,
        "require_approval_for_high": True,
        "require_approval_for_critical": True,
        "approval_timeout_seconds": 300,
        "target_servers": [],
    }
    with open(MCP_CONFIG_PATH, "w", encoding="utf-8") as f:
        json.dump(config, f, indent=2)
    print(f"  ✅ Config saved → {MCP_CONFIG_PATH}")


def _patch_claude_config(python_exe: str) -> bool:
    """
    Add agent-lock entry to claude_desktop_config.json.
    Returns True if patched, False if skipped.
    """
    config_path = _claude_config_path()
    if not config_path:
        print("  ⚠️  Could not detect Claude Desktop config path for this OS.")
        print(f"     Manually add the entry below to your claude_desktop_config.json")
        return False

    # Load existing config or create empty one
    if config_path.exists():
        try:
            with open(config_path, "r", encoding="utf-8") as f:
                claude_cfg: dict = json.load(f)
        except Exception:
            claude_cfg = {}
    else:
        config_path.parent.mkdir(parents=True, exist_ok=True)
        claude_cfg = {}

    if "mcpServers" not in claude_cfg:
        claude_cfg["mcpServers"] = {}

    entry = _build_claude_entry(python_exe)
    claude_cfg["mcpServers"]["agent-lock"] = entry

    with open(config_path, "w", encoding="utf-8") as f:
        json.dump(claude_cfg, f, indent=2)

    print(f"  ✅ Claude Desktop config patched → {config_path}")
    return True


def _print_manual_config(python_exe: str) -> None:
    """Print what the user should add manually to claude_desktop_config.json."""
    entry = _build_claude_entry(python_exe)
    print()
    print('  Add this to your claude_desktop_config.json under "mcpServers":')
    print()
    print('  "agent-lock": ' + json.dumps(entry, indent=4))
    print()


def run_setup() -> None:
    print()
    print("🦞  Agent-Lock MCP Gateway — Setup Wizard")
    print("=" * 50)
    print()

    # ── Step 1: subject_token ──────────────────────────────────────────────────
    print("Step 1/3 — Token Vault (optional)")
    print("  Your subject_token links the MCP gateway to your Agent-Lock account")
    print("  for brokered actions (Gmail, GitHub, Slack).")
    print("  You can leave this empty and add it later in ~/.agent-lock/mcp_config.json")
    print()
    subject_token = input("  Paste your subject_token (or press Enter to skip): ").strip()

    # ── Step 2: write mcp_config.json ──────────────────────────────────────────
    print()
    print("Step 2/3 — Writing ~/.agent-lock/mcp_config.json ...")
    _write_mcp_config(subject_token or None)

    # ── Step 3: patch Claude Desktop config ────────────────────────────────────
    print()
    print("Step 3/3 — Patching Claude Desktop configuration ...")
    python_exe = _detect_python_executable()
    patched = _patch_claude_config(python_exe)

    if not patched:
        _print_manual_config(python_exe)

    # ── Done ───────────────────────────────────────────────────────────────────
    print()
    print("=" * 50)
    print("✅  Agent-Lock MCP setup complete!")
    print()
    print("Next steps:")
    print("  1. Restart Claude Desktop completely (quit + reopen).")
    print("  2. Open a new chat and ask Claude: agent_lock__status")
    print("  3. Add target MCP servers in:")
    print(f"       {MCP_CONFIG_PATH}")
    print()
    print("  📖 Full docs: https://github.com/edies76/agent-locker/tree/main/mcp_server")
    print()
