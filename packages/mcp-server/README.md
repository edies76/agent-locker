# @agentlock/mcp-server

**Agent-Lock MCP Server** — Governance gateway for Claude Desktop, ChatGPT, and MCP-compatible clients.

Protects AI agents by intercepting tool calls, classifying risk with Gemini, and requiring human approval for dangerous actions via Telegram.

## Installation

```bash
npm i -g @agentlock/mcp-server
agent-lock-mcp install
```

## Quick Start

### 1. Install

```bash
npm i -g @agentlock/mcp-server
agent-lock-mcp install
```

### 2. Configure

Edit `~/.agent-lock/mcp_config.json`:

```json
{
  "target_servers": [
    {
      "name": "filesystem",
      "command": "npx",
      "args": ["-y", "@anthropic/mcp-server-filesystem", "/Users/you/Documents"],
      "enabled": true
    }
  ],
  "backend_url": "https://agent-lock-backend-api-7.azurewebsites.net",
  "subject_token": "",
  "auto_approve_low_risk": true,
  "require_approval_for_high": true,
  "require_approval_for_critical": true
}
```

### 3. Add to Claude Desktop

Edit `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "agent-lock": {
      "command": "agent-lock-mcp",
      "args": ["serve"]
    }
  }
}
```

### 4. Test

```bash
agent-lock-mcp status
```

## CLI Commands

| Command | Description |
|---------|-------------|
| `install` | Install MCP server and create default config |
| `status` | Show installation status, versions, and config |
| `serve` | Start MCP server (stdio mode for Claude Desktop) |
| `update` | Update to latest version (global + local) |
| `add-server` | Add a target MCP server |
| `config-path` | Print config file path |
| `uninstall` | Remove MCP server (keeps config) |

## Update

```bash
agent-lock-mcp update
```

Output:
```
🔄 Agent-Lock MCP Server update started
   Global (npm) version:   v1.0.0
   Installed version:      v1.0.0
   npm latest:             v1.1.0

1) Removing current MCP server installation...
✅ Step 1 complete: Old installation removed

2) Installing latest global package (@agentlock/mcp-server@latest)...
✅ Step 2 complete: Global now v1.1.0

3) Reinstalling MCP server with updated CLI...
✅ Step 3 complete: Installed v1.1.0

4) Verification summary
   Global:    v1.0.0 -> v1.1.0
   Installed: v1.0.0 -> v1.1.0
✅ Aligned with npm latest (v1.1.0)

🎉 Update completed successfully!
```

## Target Servers

The MCP Server acts as a governance gateway that proxies tool calls to underlying MCP servers. Example target servers:

```json
{
  "target_servers": [
    {
      "name": "filesystem",
      "command": "npx",
      "args": ["-y", "@anthropic/mcp-server-filesystem", "/Users/you/Documents"]
    },
    {
      "name": "github",
      "command": "npx",
      "args": ["-y", "@anthropic/mcp-server-github"],
      "env": { "GITHUB_TOKEN": "ghp_xxxx" }
    },
    {
      "name": "postgres",
      "command": "npx",
      "args": ["-y", "@anthropic/mcp-server-postgres", "postgresql://localhost/mydb"]
    }
  ]
}
```

## Backend

Both **@agentlock/mcp-server** and **@agentlock/agent-lock** (OpenClaw plugin) share the same backend:

- **Official Cloud**: `https://agent-lock-backend-api-7.azurewebsites.net`
- **Local Development**: `http://localhost:8000`

The backend provides:
- Risk classification with Gemini
- Telegram approval workflow
- Dashboard and activity logs
- Token Vault for OAuth credentials

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `AGENT_LOCK_NPM_LOOKUP_TIMEOUT_MS` | `30000` | Timeout for npm version lookups |
| `AGENT_LOCK_NPM_INSTALL_TIMEOUT_MS` | `300000` | Timeout for npm install commands |
| `AGENT_LOCK_SUBJECT_TOKEN` | - | Auth0 subject token for Token Vault |

## Paths

- **Config**: `~/.agent-lock/mcp_config.json`
- **Python server**: `~/.agent-lock/mcp_server/`
- **Audit logs**: `~/.agent-lock/logs/mcp_audit.jsonl`

## Requirements

- **Node.js**: 18.0+
- **Python**: 3.8+
- **Python packages**: `mcp`, `httpx`, `pydantic` (auto-installed)

## License

MIT
