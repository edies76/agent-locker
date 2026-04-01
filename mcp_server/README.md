# Agent-Lock MCP Gateway

MCP (Model Context Protocol) server that acts as a **governance gateway** for Claude Desktop, ChatGPT, and any other MCP-compatible client.

## What This Does

Agent-Lock MCP Gateway sits between your AI assistant and other MCP servers, intercepting every tool call before it executes:

```
Claude Desktop ──► Agent-Lock MCP Gateway ──► Target MCP Servers
                           │                   ├── filesystem
                           ▼                   ├── github
                  Risk Classification          ├── postgres
                  Gemini Intent Check          └── ...
                  Telegram Approval
```

**Every tool call goes through the governance pipeline:**
- `LOW` risk → auto-approved instantly (no latency tax)
- `HIGH` risk → Telegram notification, waits for your ✅ / ❌
- `CRITICAL` risk → Telegram notification (or blocked by policy)

---

## Tool Naming Convention

Agent-Lock exposes all target server tools using a **`{server_name}__{tool_name}`** naming scheme:

| Original tool | Exposed as |
|---|---|
| `filesystem` → `read_file` | `filesystem__read_file` |
| `github` → `create_issue` | `github__create_issue` |
| `postgres` → `query` | `postgres__query` |

This means Claude sees the **real tool schemas** with the correct argument types and descriptions — no generic wrapper needed.

**Built-in management tools** (always available):

| Tool | Description |
|---|---|
| `agent_lock__status` | Gateway health, backend URL, policy settings |
| `agent_lock__list_servers` | Connected target servers and their status |

---

## Quick Start

### 1. Install Dependencies

```bash
cd C:\Nueva-carpeta\agent-lock
pip install -r requirements.txt
```

### 2. Start the Backend

The MCP gateway delegates validation to the Agent-Lock FastAPI backend:

```bash
# From the project root
python agent-lock.py start
```

The backend must be running for risk classification, Gemini analysis, Telegram
notifications, and audit logging to work. If the backend is unreachable, all
tool calls are **blocked** (fail-closed).

### 3. Create / Edit Configuration

On first run the gateway creates a default config at `~/.agent-lock/mcp_config.json`.
Edit it to add your target MCP servers:

```json
{
  "target_servers": [
    {
      "name": "filesystem",
      "command": "npx",
      "args": ["-y", "@anthropic/mcp-server-filesystem", "C:\\Users\\you\\Documents"],
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
  ],
  "backend_url": "http://localhost:8000",
  "subject_token": "",
  "auto_approve_low_risk": true,
  "require_approval_for_high": true,
  "require_approval_for_critical": true,
  "approval_timeout_seconds": 300
}
```

`subject_token` is optional but required for brokered Token Vault tools like
`agent_lock__vault_gmail_send`. You can also provide it via
`AGENT_LOCK_SUBJECT_TOKEN` environment variable.

> **Note:** `telegram_bot_token` and `telegram_chat_id` are optional here —
> the backend's `.env` file already configures the Telegram bot used for
> approval notifications.

### 4. Run the Gateway

**For Claude Desktop (stdio transport — default):**
```bash
python -m mcp_server
```

**For testing / ChatGPT (HTTP transport):**
```bash
python -m mcp_server --transport http --port 8001
```

**Custom config path:**
```bash
python -m mcp_server --config C:\path\to\my_config.json
```

---

## Configure Claude Desktop

Add Agent-Lock to your Claude Desktop configuration file.

**Windows:** `%APPDATA%\Claude\claude_desktop_config.json`
**macOS:** `~/Library/Application Support/Claude/claude_desktop_config.json`

```json
{
  "mcpServers": {
    "agent-lock": {
      "command": "python",
      "args": ["-m", "mcp_server"],
      "cwd": "C:\\Nueva-carpeta\\agent-lock"
    }
  }
}
```

Restart Claude Desktop after saving the file.

Claude will now have access to all tools from your configured target servers,
each prefixed with the server name (e.g. `filesystem__read_file`).

---

## How Approval Works

### LOW Risk (instant)

```
Claude calls filesystem__read_file(path="notes.txt")
    │
    ▼
Agent-Lock → POST /intercept → backend classifies as LOW
    │
    ▼
AUTO_APPROVED → tool executes immediately → result returned to Claude
```

### HIGH / CRITICAL Risk (Telegram loop)

```
Claude calls filesystem__delete_file(path="important.txt")
    │
    ▼
Agent-Lock → POST /intercept → backend classifies as CRITICAL
    │
    ▼
Telegram notification sent to you:
  🦞 Agent-Lock — Approval required
  ⚙️ filesystem__delete_file
  🔴 Risk Level: CRITICAL
  [✅ YES, execute]  [❌ NO, block]
    │
    ▼  (Agent-Lock polls GET /status/{action_id} every 2–10s)
    │
    ├─ You press ✅ → APPROVED → tool executes → result returned to Claude
    └─ You press ❌ → BLOCKED  → Claude receives a clear error message
```

If you don't respond within `approval_timeout_seconds` (default: 5 minutes),
the action is cancelled and Claude is told to retry after approving.

---

## Token Vault Broker Tool

The gateway now exposes:

- `agent_lock__vault_gmail_send`
- `agent_lock__vault_github_create_issue`
- `agent_lock__vault_slack_send`
- `agent_lock__vault_calendar_create_event`

This calls backend `POST /vault/google/gmail/send` and keeps provider tokens
inside Agent-Lock. Required:

1. Auth0 Token Vault configured for Google connected account.
2. Valid `subject_token` in config or env.

Example call arguments:

```json
{
  "to": "you@example.com",
  "subject": "Token Vault test",
  "body_text": "hello from broker mode"
}
```

GitHub issue example:

```json
{
  "owner": "my-org",
  "repo": "my-repo",
  "title": "Agent-Lock broker test",
  "body": "created via token vault broker"
}
```

---

## Risk Classification

Risk is determined by the Agent-Lock backend using a 4-layer pipeline:

| Layer | Source | Override |
|---|---|---|
| 0 | `backend/policies.json` (regex rules) | Absolute |
| 1 | Tool name → default risk table | — |
| 2 | Argument content (CRITICAL / HIGH / LOW patterns) | Can downgrade |
| 3 | Gemini 2.0 Flash — intrinsic safety analysis | Can escalate only |

**Gemini Intrinsic Mode** is used for MCP calls because there is no user message
available in the MCP context. Gemini evaluates whether the command is intrinsically
safe or dangerous for an autonomous agent to run.

---

## Example Claude Session

Once configured, Claude uses the tools transparently:

```
User: List the files in my Documents folder.

Claude: [calls filesystem__list_directory(path="C:\Users\you\Documents")]
Agent-Lock: risk=LOW → AUTO_APPROVED
Result: [file list shown to user]
```

```
User: Delete the temp folder in Documents.

Claude: [calls filesystem__delete_directory(path="C:\Users\you\Documents\temp")]
Agent-Lock: risk=CRITICAL → Telegram notification sent
[Claude waits...]
[You press ✅ on Telegram]
Agent-Lock: APPROVED
Result: Folder deleted. Claude confirms to user.
```

```
User: Drop the users table in the database.

Claude: [calls postgres__query(sql="DROP TABLE users")]
Agent-Lock: risk=CRITICAL (policy: policy_db_destructive)
[You press ❌ on Telegram]
Result: 🦞 Agent-Lock blocked this action — Blocked by user via Telegram
```

---

## Project Structure

```
mcp_server/
├── __init__.py      # Package metadata
├── __main__.py      # Entry point shim  (python -m mcp_server)
├── server.py        # Low-level MCP Server, list_tools / call_tool handlers
├── proxy.py         # Async subprocess clients for target MCP servers
├── validator.py     # Backend /intercept call + /status polling
└── config.py        # AgentLockMCPConfig dataclass + load_config()
```

---

## Troubleshooting

### Gateway not appearing in Claude Desktop

1. Verify the `cwd` path in `claude_desktop_config.json` is correct.
2. Make sure `python` is in your system PATH.
3. Check Claude Desktop logs: `%APPDATA%\Claude\logs\`

### Tools not listed (0 proxied tools)

1. Verify target servers are installed: `npx -y @anthropic/mcp-server-filesystem --help`
2. Check `~/.agent-lock/mcp_config.json` — are servers enabled?
3. Run the gateway manually and watch stderr: `python -m mcp_server`

### Approval Telegram message not arriving

1. Confirm the backend is running: `GET http://localhost:8000/health`
2. Check `backend/.env` has `TELEGRAM_BOT_TOKEN` and `TELEGRAM_CHAT_ID` set.
3. Review backend logs for Telegram errors.

### Action stuck in PENDING forever

- The default timeout is 300 seconds (5 minutes).
- After timeout, the action is cancelled and Claude receives a timeout message.
- Increase `approval_timeout_seconds` in `mcp_config.json` if needed.

### Backend unreachable

All tool calls are **blocked** when the backend is down (fail-closed design).
Start the backend first: `python agent-lock.py start`
