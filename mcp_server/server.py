"""
Agent-Lock MCP Server

An MCP server that acts as a gateway/proxy for other MCP servers,
adding governance through risk classification, intent validation, and approvals.

Usage:
    # Run with stdio transport (for Claude Desktop)
    uv run mcp_server/server.py
    
    # Run with HTTP transport (for testing)
    uv run mcp_server/server.py --transport http

Configuration:
    Set AGENT_LOCK_MCP_CONFIG env var to point to config JSON file.
    Default: ~/.agent-lock/mcp_config.json
"""

import asyncio
import json
import os
import sys
from pathlib import Path
from typing import Any

from mcp.server.fastmcp import FastMCP, Context

from .config import AgentLockMCPConfig, TargetServer
from .proxy import ToolProxy
from .validator import validate_tool_call


# Initialize FastMCP server
mcp = FastMCP(
    "Agent-Lock",
    version="0.1.0",
)


# Global state
config: AgentLockMCPConfig | None = None
tool_proxy: ToolProxy | None = None


def load_config() -> AgentLockMCPConfig:
    """Load configuration from file or create default."""
    config_path = os.environ.get(
        "AGENT_LOCK_MCP_CONFIG",
        str(Path.home() / ".agent-lock" / "mcp_config.json")
    )
    
    path = Path(config_path)
    if path.exists():
        print(f"[Agent-Lock] Loading config from {path}", file=sys.stderr)
        return AgentLockMCPConfig.from_file(path)
    else:
        print(f"[Agent-Lock] Config not found at {path}, using defaults", file=sys.stderr)
        # Create default config file
        default_config = AgentLockMCPConfig()
        default_config.to_file(path)
        print(f"[Agent-Lock] Created default config at {path}", file=sys.stderr)
        return default_config


@mcp.tool()
async def execute_tool(
    server_name: str,
    tool_name: str,
    arguments: dict[str, Any],
    ctx: Context,
) -> dict[str, Any]:
    """
    Execute a tool on a target MCP server after validation.
    
    This is the main entry point for all tool calls through Agent-Lock.
    It will:
    1. Validate the tool call (risk classification, intent check)
    2. Request approval if needed (via Telegram)
    3. Forward to target server if approved
    4. Return the result
    
    Args:
        server_name: Name of the target MCP server (e.g., "filesystem", "github")
        tool_name: Name of the tool to call (e.g., "read_file", "create_issue")
        arguments: Arguments to pass to the tool
        ctx: MCP context (injected automatically)
    
    Returns:
        Tool execution result or error message
    """
    global tool_proxy, config
    
    if tool_proxy is None:
        return {"error": "Agent-Lock not initialized"}
    
    # Log the incoming tool call
    await ctx.info(f"Tool call: {server_name}.{tool_name}")
    
    # Validate the tool call
    validation = await validate_tool_call(
        server_name=server_name,
        tool_name=tool_name,
        arguments=arguments,
        config=config,
    )
    
    risk_level = validation.get("risk_level", "HIGH")
    decision = validation.get("decision", "pending")
    
    # Log risk level
    await ctx.info(f"Risk level: {risk_level}, Decision: {decision}")
    
    # Handle based on decision
    if decision == "blocked":
        return {
            "error": "Tool call blocked by Agent-Lock",
            "reason": validation.get("reason", "Risk too high"),
            "risk_level": risk_level,
        }
    
    if decision == "pending":
        # Request approval via Telegram
        await ctx.info("Requesting approval via Telegram...")
        # TODO: Integrate with Telegram bot from backend
        # For now, return pending status
        return {
            "status": "pending_approval",
            "message": "Approval request sent to Telegram. Waiting for user decision...",
            "action_id": validation.get("action_id"),
        }
    
    # Decision is "approved" - execute the tool
    if decision == "approved":
        await ctx.info(f"Executing {server_name}.{tool_name}...")
        
        result = await tool_proxy.execute_tool(
            server_name=server_name,
            tool_name=tool_name,
            arguments=arguments,
        )
        
        return result
    
    return {"error": "Unknown decision state"}


@mcp.tool()
async def list_available_tools(ctx: Context) -> dict[str, Any]:
    """
    List all available tools from all connected target MCP servers.
    
    Returns:
        Dictionary mapping server names to their available tools
    """
    global tool_proxy
    
    if tool_proxy is None:
        return {"error": "Agent-Lock not initialized"}
    
    tools = await tool_proxy.list_all_tools()
    return {"servers": tools}


@mcp.tool()
async def list_servers(ctx: Context) -> dict[str, Any]:
    """
    List all configured target MCP servers.
    
    Returns:
        List of server names and their status
    """
    global config
    
    if config is None:
        return {"error": "Agent-Lock not initialized"}
    
    servers = []
    for server in config.target_servers:
        servers.append({
            "name": server.name,
            "enabled": server.enabled,
            "command": server.command,
        })
    
    return {"servers": servers}


@mcp.resource("agent-lock://status")
def get_status() -> str:
    """Get Agent-Lock MCP Server status."""
    global config, tool_proxy
    
    status = {
        "name": "Agent-Lock MCP Server",
        "version": "0.1.0",
        "config_loaded": config is not None,
        "proxy_ready": tool_proxy is not None,
        "target_servers": len(config.target_servers) if config else 0,
        "backend_url": config.backend_url if config else None,
    }
    
    return json.dumps(status, indent=2)


@mcp.resource("agent-lock://config")
def get_config() -> str:
    """Get current Agent-Lock configuration."""
    global config
    
    if config is None:
        return json.dumps({"error": "Config not loaded"})
    
    return json.dumps({
        "backend_url": config.backend_url,
        "auto_approve_low_risk": config.auto_approve_low_risk,
        "require_approval_for_high": config.require_approval_for_high,
        "require_approval_for_critical": config.require_approval_for_critical,
        "target_servers": [
            {"name": s.name, "enabled": s.enabled}
            for s in config.target_servers
        ],
    }, indent=2)


async def initialize() -> None:
    """Initialize Agent-Lock MCP Server."""
    global config, tool_proxy
    
    print("[Agent-Lock] Initializing...", file=sys.stderr)
    
    # Load configuration
    config = load_config()
    
    # Initialize tool proxy
    tool_proxy = ToolProxy(config.target_servers)
    await tool_proxy.initialize()
    
    print(f"[Agent-Lock] Initialized with {len(config.target_servers)} target servers", file=sys.stderr)


def main() -> None:
    """Main entry point."""
    import argparse
    
    parser = argparse.ArgumentParser(description="Agent-Lock MCP Server")
    parser.add_argument(
        "--transport",
        choices=["stdio", "http"],
        default="stdio",
        help="Transport protocol to use",
    )
    parser.add_argument(
        "--port",
        type=int,
        default=8000,
        help="Port for HTTP transport",
    )
    
    args = parser.parse_args()
    
    # Run initialization before server starts
    asyncio.run(initialize())
    
    if args.transport == "stdio":
        # stdio transport for Claude Desktop
        mcp.run()
    else:
        # HTTP transport for testing
        mcp.run(transport="streamable-http", port=args.port)


if __name__ == "__main__":
    main()
