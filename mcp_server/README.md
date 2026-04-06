# Agent-Lock MCP Gateway

> **Governance & security layer for Claude Desktop.** Every tool call passes through Gemini risk analysis and optional Telegram human-in-the-loop approval before execution.

```
Claude Desktop ──► Agent-Lock MCP Gateway ──► Your MCP Servers
                           │                   ├── filesystem
                           ▼                   ├── github
                  Gemini Risk Analysis          ├── postgres
                  Telegram Approval             └── ...
```

| Risk Level | Behavior |
|---|---|
| `LOW` | Auto-approved instantly — zero latency added |
| `HIGH` | Telegram notification with ✅ / ❌ buttons — waits for you |
| `CRITICAL` | Telegram notification or blocked immediately by policy |

---

## Installation

**Option A — uvx (recommended, no install needed):**
```bash
uvx agent-lock-mcp setup
```

**Option B — pip:**
```bash
pip install agent-lock-mcp
agent-lock-mcp setup
```

**Option C — From source:**
```bash
git clone https://github.com/edies76/agent-locker
cd agent-locker
pip install -e .
agent-lock-mcp setup
```

The `setup` wizard will:
1. Create **`~/.agent-lock/mcp_config.json`** with default settings.
2. **Auto-detect and patch** your `claude_desktop_config.json`.
3. Ask for an optional `subject_token` to enable Token Vault brokered actions.

---

## Configuring Claude Desktop

After running `setup`, your `claude_desktop_config.json` will contain:

**If you installed via uvx (recommended):**
```json
{
  "mcpServers": {
    "agent-lock": {
      "command": "uvx",
      "args": ["agent-lock-mcp"]
    }
  }
}
```

**If you installed via pip:**
```json
{
  "mcpServers": {
    "agent-lock": {
      "command": "agent-lock-mcp"
    }
  }
}
```

Restart Claude Desktop after saving.

> **Config file locations:**
> - Windows: `%APPDATA%\Claude\claude_desktop_config.json`
> - macOS: `~/Library/Application Support/Claude/claude_desktop_config.json`

---

## Gateway Configuration (`~/.agent-lock/mcp_config.json`)

After setup, edit this file to add your target MCP servers:

```json
{
  "backend_url": "https://agent-lock-backend-api-7.azurewebsites.net",
  "subject_token": "",
  "auto_approve_low_risk": true,
  "require_approval_for_high": true,
  "require_approval_for_critical": true,
  "approval_timeout_seconds": 300,
  "target_servers": [
    {
      "name": "filesystem",
      "command": "npx",
      "args": ["-y", "@anthropic/mcp-server-filesystem", "/Users/you/Documents"],
      "enabled": true
    },
    {
      "name": "github",
      "command": "npx",
      "args": ["-y", "@anthropic/mcp-server-github"],
      "env": { "GITHUB_TOKEN": "ghp_xxxx" },
      "enabled": true
    },
    {
      "name": "postgres",
      "command": "npx",
      "args": ["-y", "@anthropic/mcp-server-postgres", "postgresql://localhost/mydb"],
      "enabled": true
    }
  ]
}
```

**`subject_token`** is optional. It enables brokered Token Vault tools (`agent_lock__vault_gmail_send`, etc.). You can also set it via environment variable:
```bash
export AGENT_LOCK_SUBJECT_TOKEN="your-auth0-token"
```

---

## Tool Naming Convention

Agent-Lock proxies your target servers' tools using `{server}__{tool}`:

| Original | Proxied as |
|---|---|
| `filesystem` → `read_file` | `filesystem__read_file` |
| `github` → `create_issue` | `github__create_issue` |
| `postgres` → `query` | `postgres__query` |

Claude sees the **real tool schemas** with correct argument types — no generic wrapper.

**Built-in management tools (always available):**

| Tool | Description |
|---|---|
| `agent_lock__status` | Gateway health, backend URL, policy settings |
| `agent_lock__list_servers` | Connected target servers and their status |
| `agent_lock__vault_gmail_send` | Send email via brokered Token Vault |
| `agent_lock__vault_github_create_issue` | Create GitHub issue via brokered Token Vault |
| `agent_lock__vault_slack_send` | Send Slack message via brokered Token Vault |
| `agent_lock__vault_calendar_create_event` | Create Calendar event via brokered Token Vault |

---

## How the Approval Flow Works

### LOW Risk (auto, instant)
```
Claude → filesystem__read_file(path="notes.txt")
  └► Agent-Lock → POST /intercept → risk=LOW
       └► AUTO_APPROVED → executes → result to Claude
```

### HIGH / CRITICAL Risk (Telegram loop)
```
Claude → filesystem__delete_file(path="important.txt")
  └► Agent-Lock → POST /intercept → risk=CRITICAL
       └► 📱 Telegram: "🦞 DELETE important.txt — CRITICAL — [✅ YES] [❌ NO]"
            ├─ You press ✅ → APPROVED → executes → result to Claude
            └─ You press ❌ → BLOCKED  → Claude receives clear error
```

If no response within `approval_timeout_seconds` (default 5 min), the action is cancelled.

---

## Advanced Usage

**Manual run (for testing):**
```bash
# stdio — Claude Desktop
python -m mcp_server

# HTTP — testing / ChatGPT
python -m mcp_server --transport http --port 8001

# Custom config path
python -m mcp_server --config /path/to/my_config.json
```

**Self-hosted backend** (optional — default uses the official cloud):
```json
{ "backend_url": "http://localhost:8000" }
```
See the [backend README](../backend/) for setup instructions.

---

## Troubleshooting

| Problem | Fix |
|---|---|
| Gateway not appearing in Claude | Restart Claude fully (Quit, not just close). Check logs at `%APPDATA%\Claude\logs\`. |
| `0 proxied tools` | Check `~/.agent-lock/mcp_config.json` — are servers enabled? Run `python -m mcp_server` manually and watch stderr. |
| Telegram messages not arriving | Check `backend_url` is reachable. The backend handles Telegram — it must be running. |
| Action stuck in PENDING forever | Default timeout is 300 s. Increase `approval_timeout_seconds` in config. |
| Backend unreachable | All tool calls are **blocked** (fail-closed). Verify backend URL is correct. |

---

## Project Structure

```
mcp_server/
├── __init__.py       # Package metadata (version)
├── __main__.py       # Entry point — python -m mcp_server [setup]
├── server.py         # MCP Server: list_tools / call_tool handlers
├── proxy.py          # Async subprocess clients for target MCP servers
├── validator.py      # POST /intercept + GET /status polling
├── config.py         # AgentLockMCPConfig dataclass + load_config()
└── setup_wizard.py   # Interactive setup wizard
```

---

*Part of the Agent-Lock project — [github.com/edies76/agent-locker](https://github.com/edies76/agent-locker)*
