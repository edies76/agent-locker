"""
Tool Call Validator for Agent-Lock MCP Server.

Integrates with the existing Agent-Lock backend for:
- Risk classification
- Intent validation
- Approval workflow
"""

import asyncio
import hashlib
import time
import uuid
from typing import Any

import httpx

from .config import AgentLockMCPConfig


# Risk classification patterns (mirrored from backend/action_rules.py)
CRITICAL_PATTERNS = [
    "rm -rf",
    "rm -r",
    "del /s",
    "format",
    "mkfs",
    "dd if=",
    "shutdown",
    "reboot",
    "halt",
    "poweroff",
    "DROP TABLE",
    "DROP DATABASE",
    "TRUNCATE",
    "DELETE FROM",
    "GRANT ALL",
    "chmod 777",
    "chown root",
    "> /dev/sd",
    "os.system",
    "subprocess.call",
    "eval(",
    "exec(",
    "__import__",
]

HIGH_PATTERNS = [
    "sudo",
    "apt install",
    "yum install",
    "brew install",
    "npm install -g",
    "pip install",
    "git push",
    "git reset --hard",
    "curl -X POST",
    "curl -X PUT",
    "curl -X DELETE",
    "wget",
    "scp",
    "rsync",
    "ssh",
    "docker run",
    "docker exec",
    "kubectl",
    "helm",
    "terraform apply",
    "ansible-playbook",
    "write_file",
    "create_file",
    "delete_file",
    "move_file",
    "copy_file",
    "execute_command",
    "run_shell",
    "bash -c",
    "powershell -c",
]

# Tools that are generally safe
SAFE_TOOLS = [
    "read_file",
    "list_directory",
    "get_file_info",
    "search_files",
    "read_resource",
    "get_status",
    "list_tools",
    "list_servers",
]


def classify_risk(tool_name: str, arguments: dict[str, Any]) -> str:
    """
    Classify the risk level of a tool call.
    
    Returns: "LOW", "HIGH", or "CRITICAL"
    """
    # Check if tool is in safe list
    if tool_name in SAFE_TOOLS:
        return "LOW"
    
    # Convert arguments to string for pattern matching
    args_str = str(arguments).lower()
    tool_str = tool_name.lower()
    combined = f"{tool_str} {args_str}"
    
    # Check for critical patterns
    for pattern in CRITICAL_PATTERNS:
        if pattern.lower() in combined:
            return "CRITICAL"
    
    # Check for high-risk patterns
    for pattern in HIGH_PATTERNS:
        if pattern.lower() in combined:
            return "HIGH"
    
    # Default to HIGH for any write/execute operations
    if any(word in tool_name.lower() for word in ["write", "create", "delete", "execute", "run", "send", "post", "put"]):
        return "HIGH"
    
    # Default to LOW for read-only operations
    return "LOW"


async def validate_tool_call(
    server_name: str,
    tool_name: str,
    arguments: dict[str, Any],
    config: AgentLockMCPConfig,
) -> dict[str, Any]:
    """
    Validate a tool call through the Agent-Lock backend.
    
    Returns:
        {
            "risk_level": "LOW" | "HIGH" | "CRITICAL",
            "decision": "approved" | "blocked" | "pending",
            "reason": str,
            "action_id": str (if pending),
        }
    """
    # Step 1: Classify risk locally
    risk_level = classify_risk(tool_name, arguments)
    
    # Step 2: Check if auto-approve is enabled for LOW risk
    if risk_level == "LOW" and config.auto_approve_low_risk:
        return {
            "risk_level": risk_level,
            "decision": "approved",
            "reason": "Auto-approved: LOW risk operation",
        }
    
    # Step 3: For HIGH/CRITICAL, check with backend
    action_id = str(uuid.uuid4())
    
    # Try to call the backend for full validation
    try:
        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"{config.backend_url}/intercept",
                json={
                    "action_id": action_id,
                    "tool": f"{server_name}.{tool_name}",
                    "args": arguments,
                    "user_intent": None,  # MCP doesn't have user intent readily available
                    "agent_id": "mcp-client",
                    "platform": "mcp",
                },
                timeout=30.0,
            )
            
            if response.status_code == 200:
                result = response.json()
                return {
                    "risk_level": result.get("risk_level", risk_level),
                    "decision": result.get("status", "pending"),
                    "reason": result.get("reason", ""),
                    "action_id": action_id,
                }
    except Exception as e:
        print(f"[Validator] Backend error: {e}")
    
    # Step 4: If backend unavailable, use local rules
    if risk_level == "CRITICAL":
        return {
            "risk_level": risk_level,
            "decision": "blocked",
            "reason": "CRITICAL risk operation blocked by policy",
        }
    
    # HIGH risk requires approval
    return {
        "risk_level": risk_level,
        "decision": "pending",
        "reason": f"{risk_level} risk operation requires approval",
        "action_id": action_id,
    }
