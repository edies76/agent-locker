"""
Tool Proxy — Async MCP client manager for Agent-Lock Gateway.

Each target MCP server runs as a subprocess communicating via JSON-RPC 2.0
over stdio (the standard MCP transport).

Key design decisions:
  - Uses asyncio.create_subprocess_exec (non-blocking) instead of subprocess.Popen.
  - Parallel initialisation: all target servers start concurrently.
  - Proper MCP handshake: initialize request → initialized notification.
  - Per-client request-ID counter to avoid collisions.
  - Fail-soft: a server that fails to start is removed silently; the gateway
    continues with the remaining servers.
  - _send() has a configurable timeout so a hung subprocess never blocks Claude.
"""

from __future__ import annotations

import asyncio
import json
import logging
import os
from typing import Any

from .config import TargetServer

logger = logging.getLogger("agent-lock.mcp.proxy")

# Seconds to wait for a single JSON-RPC response before giving up.
_REQUEST_TIMEOUT: float = 30.0

# MCP protocol version announced during the handshake.
_MCP_PROTOCOL_VERSION = "2024-11-05"


# ── Low-level MCP client ──────────────────────────────────────────────────────


class MCPClient:
    """
    Async MCP client for a single target server subprocess.

    Lifecycle:
        client = MCPClient(server_config)
        await client.start()          # launch process + handshake
        tools = client.tools          # cached tool list
        result = await client.call_tool("read_file", {"path": "..."})
        await client.stop()           # terminate process
    """

    def __init__(self, server: TargetServer) -> None:
        self.server = server
        self._process: asyncio.subprocess.Process | None = None
        self._tools: list[dict[str, Any]] = []
        self._req_id: int = 0

    # ── Public interface ──────────────────────────────────────────────────────

    @property
    def tools(self) -> list[dict[str, Any]]:
        """Cached tool list (populated during start())."""
        return self._tools

    @property
    def is_connected(self) -> bool:
        """True if the subprocess is running."""
        return self._process is not None and self._process.returncode is None

    async def start(self) -> None:
        """
        Launch the target server subprocess and perform the MCP handshake.

        Raises nothing — all errors are logged and the client stays in a
        disconnected state so ToolProxy can skip it gracefully.
        """
        if not self.server.enabled:
            logger.info(f"[{self.server.name}] disabled — skipping.")
            return

        env = {**os.environ, **self.server.env}

        logger.info(
            f"[{self.server.name}] starting: "
            f"{self.server.command} {' '.join(self.server.args)}"
        )

        try:
            self._process = await asyncio.create_subprocess_exec(
                self.server.command,
                *self.server.args,
                stdin=asyncio.subprocess.PIPE,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
                env=env,
            )
        except FileNotFoundError:
            logger.error(
                f"[{self.server.name}] command not found: '{self.server.command}'. "
                "Is it installed and on PATH?"
            )
            return
        except Exception as exc:
            logger.error(f"[{self.server.name}] failed to launch: {exc}")
            return

        # Drain stderr in the background so the pipe buffer never fills up.
        asyncio.ensure_future(self._drain_stderr())

        # MCP handshake
        try:
            await self._initialize()
            await self._refresh_tools()
            logger.info(
                f"[{self.server.name}] ✅ connected — "
                f"{len(self._tools)} tool(s) available."
            )
        except Exception as exc:
            logger.error(f"[{self.server.name}] handshake failed: {exc}")
            await self.stop()

    async def stop(self) -> None:
        """Terminate the subprocess cleanly."""
        if self._process is None:
            return
        try:
            self._process.terminate()
            await asyncio.wait_for(self._process.wait(), timeout=5.0)
        except asyncio.TimeoutError:
            logger.warning(f"[{self.server.name}] did not exit in time — killing.")
            self._process.kill()
        except Exception:
            pass
        finally:
            self._process = None

    async def call_tool(
        self,
        tool_name: str,
        arguments: dict[str, Any],
    ) -> dict[str, Any]:
        """
        Execute a tool on the target server.

        Returns:
            {"success": True,  "result": <raw MCP result dict>}
            {"success": False, "error":  <message>}
        """
        try:
            result = await self._send(
                "tools/call",
                {"name": tool_name, "arguments": arguments},
            )
            return {"success": True, "result": result}
        except Exception as exc:
            logger.error(f"[{self.server.name}] tools/call {tool_name} failed: {exc}")
            return {"success": False, "error": str(exc)}

    # ── Internal helpers ──────────────────────────────────────────────────────

    def _next_id(self) -> int:
        self._req_id += 1
        return self._req_id

    async def _initialize(self) -> None:
        """
        Perform the MCP initialize / initialized handshake.

        1. Send `initialize` request (has id → expects response).
        2. Send `notifications/initialized` notification (no id → no response).
        """
        await self._send(
            "initialize",
            {
                "protocolVersion": _MCP_PROTOCOL_VERSION,
                "capabilities": {"tools": {}},
                "clientInfo": {
                    "name": "agent-lock-mcp-gateway",
                    "version": "1.0.0",
                },
            },
        )
        # Notification — fire and forget (no response expected).
        await self._notify("notifications/initialized", {})

    async def _refresh_tools(self) -> None:
        """Fetch and cache the list of tools exposed by this server."""
        try:
            result = await self._send("tools/list", {})
            self._tools = result.get("tools", [])
        except Exception as exc:
            logger.warning(f"[{self.server.name}] could not list tools: {exc}")
            self._tools = []

    async def _send(
        self,
        method: str,
        params: dict[str, Any],
    ) -> dict[str, Any]:
        """
        Send a JSON-RPC 2.0 request and return the result dict.

        Raises RuntimeError on error responses, timeouts, or closed pipes.
        """
        if not self._process or not self._process.stdin or not self._process.stdout:
            raise RuntimeError(f"[{self.server.name}] not running")

        req_id = self._next_id()
        request = {
            "jsonrpc": "2.0",
            "id": req_id,
            "method": method,
            "params": params,
        }

        # Write request
        line = (json.dumps(request, ensure_ascii=False) + "\n").encode()
        self._process.stdin.write(line)
        await self._process.stdin.drain()

        # Read response (with timeout)
        try:
            raw = await asyncio.wait_for(
                self._process.stdout.readline(),
                timeout=_REQUEST_TIMEOUT,
            )
        except asyncio.TimeoutError:
            raise RuntimeError(
                f"[{self.server.name}] timeout waiting for response "
                f"(method={method}, id={req_id})"
            )

        if not raw:
            raise RuntimeError(
                f"[{self.server.name}] subprocess closed stdout "
                f"(method={method}, id={req_id})"
            )

        try:
            response = json.loads(raw.decode())
        except json.JSONDecodeError as exc:
            raise RuntimeError(f"[{self.server.name}] invalid JSON response: {exc}")

        if "error" in response:
            err = response["error"]
            raise RuntimeError(
                f"[{self.server.name}] JSON-RPC error "
                f"{err.get('code')}: {err.get('message')}"
            )

        return response.get("result", {})

    async def _notify(self, method: str, params: dict[str, Any]) -> None:
        """
        Send a JSON-RPC 2.0 notification (no id, no response expected).
        """
        if not self._process or not self._process.stdin:
            return
        notification = {
            "jsonrpc": "2.0",
            "method": method,
            "params": params,
        }
        line = (json.dumps(notification, ensure_ascii=False) + "\n").encode()
        try:
            self._process.stdin.write(line)
            await self._process.stdin.drain()
        except Exception as exc:
            logger.warning(
                f"[{self.server.name}] failed to send notification '{method}': {exc}"
            )

    async def _drain_stderr(self) -> None:
        """
        Continuously read and log the subprocess's stderr so the pipe
        buffer never fills up and blocks the subprocess.
        """
        if not self._process or not self._process.stderr:
            return
        try:
            async for line in self._process.stderr:
                text = line.decode(errors="replace").rstrip()
                if text:
                    logger.debug(f"[{self.server.name}] stderr: {text}")
        except Exception:
            pass


# ── Multi-server proxy ────────────────────────────────────────────────────────


class ToolProxy:
    """
    Manages connections to multiple target MCP servers and
    proxies tool calls to the correct one.

    Usage:
        proxy = ToolProxy(config.target_servers)
        await proxy.initialize()                     # connects all in parallel
        tools = await proxy.list_all_tools()         # {server_name: [tool, ...]}
        result = await proxy.execute_tool("filesystem", "read_file", {...})
        await proxy.shutdown()
    """

    def __init__(self, servers: list[TargetServer]) -> None:
        self._servers = servers
        self._clients: dict[str, MCPClient] = {}

    async def initialize(self) -> None:
        """
        Start all enabled target servers in parallel.

        Servers that fail to connect are excluded from self._clients so
        downstream callers get a clear "server not found" error instead of
        a cryptic exception.
        """
        tasks: list[tuple[str, MCPClient, asyncio.Task]] = []

        for server in self._servers:
            if server.enabled:
                client = MCPClient(server)
                task = asyncio.ensure_future(client.start())
                tasks.append((server.name, client, task))

        if tasks:
            await asyncio.gather(
                *(t for _, _, t in tasks),
                return_exceptions=True,
            )

        for name, client, _ in tasks:
            if client.is_connected:
                self._clients[name] = client
            else:
                logger.warning(f"[{name}] excluded from proxy (failed to connect).")

    async def shutdown(self) -> None:
        """Stop all connected target servers."""
        if not self._clients:
            return
        await asyncio.gather(
            *(c.stop() for c in self._clients.values()),
            return_exceptions=True,
        )
        self._clients.clear()

    async def execute_tool(
        self,
        server_name: str,
        tool_name: str,
        arguments: dict[str, Any],
    ) -> dict[str, Any]:
        """
        Forward a tool call to the named target server.

        Returns:
            {"success": True,  "result": ...}
            {"success": False, "error":  ...}
        """
        client = self._clients.get(server_name)
        if client is None:
            available = list(self._clients.keys())
            return {
                "success": False,
                "error": (
                    f"Server '{server_name}' is not connected. "
                    f"Available servers: {available}"
                ),
            }
        return await client.call_tool(tool_name, arguments)

    async def list_all_tools(self) -> dict[str, list[dict[str, Any]]]:
        """
        Return a mapping of server_name → list of tool descriptors.

        Each tool descriptor is the raw dict from the target server's
        tools/list response: {"name": ..., "description": ..., "inputSchema": ...}
        """
        return {name: client.tools for name, client in self._clients.items()}

    def get_server_names(self) -> list[str]:
        """Names of currently connected target servers."""
        return list(self._clients.keys())
