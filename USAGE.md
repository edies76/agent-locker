# Agent-Lock Quick Usage

Agent-Lock is a governance layer between AI agents and tool execution.

## 1) Choose your runtime mode

1. **MCP Gateway** (`mcp_server/`) for Claude/Desktop and MCP clients.
2. **OpenClaw Plugin** (`plugin/agent-lock-plugin/`) for OpenClaw workflows.
3. You can run both with the same backend.

## 2) Configure required values

Set backend and integration credentials (Auth0, Telegram, Gemini) in your runtime environment.  
For MCP users, configure target servers in:

`%USERPROFILE%\.agent-lock\mcp_config.json`

## 3) Start services

1. Start backend (local or cloud endpoint).
2. Start MCP gateway or plugin runtime.
3. Open dashboard and verify health/status pages.

## 4) Validate flow (must-do)

1. Run one **safe read-only** call and confirm it appears in Activity.
2. Run one **high-risk** sample and confirm approval is required.
3. Confirm final decision appears in Logs.

## 5) Operate safely

- Keep Telegram approval path available for HIGH/CRITICAL actions.
- Use separate bot tokens if multiple pollers are active.
- Treat backend/cloud mismatch as a hard failure until resolved.
