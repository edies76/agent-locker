"""
Tool Proxy for Agent-Lock MCP Server.

Handles communication with target MCP servers and proxies tool calls.
"""

import asyncio
import json
import subprocess
from typing import Any

from .config import TargetServer


class MCPClient:
    """
    Simple MCP client that communicates with a target MCP server
    via stdio (subprocess).
    """
    
    def __init__(self, server: TargetServer):
        self.server = server
        self.process: subprocess.Popen | None = None
        self.tools: list[dict[str, Any]] = []
    
    async def start(self) -> None:
        """Start the target MCP server process."""
        if not self.server.enabled:
            return
        
        # Start subprocess with the MCP server command
        env = dict(subprocess.os.environ)
        env.update(self.server.env)
        
        self.process = subprocess.Popen(
            [self.server.command] + self.server.args,
            stdin=subprocess.PIPE,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            env=env,
            text=True,
            bufsize=1,  # Line buffered
        )
        
        # Initialize MCP connection
        await self._send_request("initialize", {
            "protocolVersion": "2024-11-05",
            "capabilities": {},
            "clientInfo": {
                "name": "agent-lock-mcp",
                "version": "0.1.0",
            }
        })
        
        # List available tools
        await self._refresh_tools()
    
    async def stop(self) -> None:
        """Stop the target MCP server process."""
        if self.process:
            self.process.terminate()
            self.process.wait(timeout=5)
            self.process = None
    
    async def _send_request(self, method: str, params: dict[str, Any]) -> dict[str, Any]:
        """Send a JSON-RPC request to the target server."""
        if not self.process or not self.process.stdin:
            raise RuntimeError(f"Server {self.server.name} not started")
        
        request = {
            "jsonrpc": "2.0",
            "id": 1,
            "method": method,
            "params": params,
        }
        
        # Send request
        self.process.stdin.write(json.dumps(request) + "\n")
        self.process.stdin.flush()
        
        # Read response
        response_line = self.process.stdout.readline()
        if not response_line:
            raise RuntimeError(f"No response from server {self.server.name}")
        
        response = json.loads(response_line)
        
        if "error" in response:
            raise RuntimeError(f"Server error: {response['error']}")
        
        return response.get("result", {})
    
    async def _refresh_tools(self) -> None:
        """Refresh the list of available tools from the server."""
        try:
            result = await self._send_request("tools/list", {})
            self.tools = result.get("tools", [])
        except Exception as e:
            print(f"[MCPClient] Error refreshing tools for {self.server.name}: {e}")
            self.tools = []
    
    async def call_tool(self, tool_name: str, arguments: dict[str, Any]) -> dict[str, Any]:
        """Call a tool on the target server."""
        try:
            result = await self._send_request("tools/call", {
                "name": tool_name,
                "arguments": arguments,
            })
            return {"success": True, "result": result}
        except Exception as e:
            return {"success": False, "error": str(e)}
    
    def get_tools(self) -> list[dict[str, Any]]:
        """Get list of available tools."""
        return self.tools


class ToolProxy:
    """
    Manages connections to multiple target MCP servers
    and proxies tool calls to them.
    """
    
    def __init__(self, servers: list[TargetServer]):
        self.servers = servers
        self.clients: dict[str, MCPClient] = {}
    
    async def initialize(self) -> None:
        """Initialize connections to all target servers."""
        for server in self.servers:
            if server.enabled:
                client = MCPClient(server)
                try:
                    await client.start()
                    self.clients[server.name] = client
                    print(f"[ToolProxy] Connected to {server.name}", flush=True)
                except Exception as e:
                    print(f"[ToolProxy] Failed to connect to {server.name}: {e}", flush=True)
    
    async def shutdown(self) -> None:
        """Shutdown all client connections."""
        for client in self.clients.values():
            await client.stop()
    
    async def execute_tool(
        self,
        server_name: str,
        tool_name: str,
        arguments: dict[str, Any],
    ) -> dict[str, Any]:
        """Execute a tool on a target server."""
        client = self.clients.get(server_name)
        
        if not client:
            return {
                "success": False,
                "error": f"Server '{server_name}' not found or not enabled",
            }
        
        return await client.call_tool(tool_name, arguments)
    
    async def list_all_tools(self) -> dict[str, list[dict[str, Any]]]:
        """List all tools from all connected servers."""
        result = {}
        for name, client in self.clients.items():
            result[name] = client.get_tools()
        return result
    
    def get_server_names(self) -> list[str]:
        """Get list of connected server names."""
        return list(self.clients.keys())
