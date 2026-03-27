# 🦞 Agent-Lock

Agent-Lock is a **security and governance middleware** that intercepts and approves tool calls made by AI agents. If an agent attempts a high-risk or destructive action (like dropping a database, wiping files, or executing dangerous shell commands), Agent-Lock halts the execution, notifies you on Telegram, and waits for your human-in-the-loop approval before proceeding.

Originally built for **OpenClaw**, Agent-Lock now ships a full **MCP Gateway** that works with **Claude Desktop**, **ChatGPT**, and any MCP-compatible AI client.

---

## 📐 Architecture Overview

```

## 🧭 Integration Modes (Choose One or Both)

Agent-Lock has two independent entry points that share the same backend.

| Mode | Folder | Primary users | What it intercepts |
|---|---|---|---|
| MCP Gateway | `mcp_server/` | Claude Desktop, ChatGPT MCP clients | MCP tool calls (`server__tool`) |
| OpenClaw Plugin | `plugin/agent-lock-plugin/` | OpenClaw users | OpenClaw `before_tool_call` events |

Shared backend capabilities for both:
- Risk classification and policy enforcement
- Telegram human approval flow
- Auth token scoping/injection
- Audit logs and dashboard activity stream

---

## 🧑‍💼 External Onboarding (Recommended Order)

For external collaborators and first-time setup, use this sequence:

1. Start backend and verify health endpoint.
2. Pick integration mode:
  - MCP only (Claude/Desktop or MCP clients)
  - OpenClaw plugin only
  - Both in parallel
3. Configure only the selected mode.
4. Run one safe read-only call and validate:
  - appears in Dashboard Activity
  - has risk classification
  - has execution timing metadata
5. Run one HIGH-risk sample and confirm approval path.
6. Confirm logs:
  - backend audit log
  - plugin runtime logs (if OpenClaw mode)

Operational check:
- If backend is down, calls are blocked by design (fail-closed).
- If Telegram is misconfigured, HIGH/CRITICAL actions will not progress.
- Use separate Telegram bots for OpenClaw and Agent-Lock to avoid update conflicts.

---
┌─────────────────────────────────────────────────┐
│           AI Client (Claude / OpenClaw)         │
└───────────────────────┬─────────────────────────┘
                        │  Tool Call
                        ▼
┌─────────────────────────────────────────────────┐
│          Agent-Lock MCP Gateway                 │
│   (mcp_server/ — stdio or HTTP transport)       │
│                                                 │
│  1. Intercepts every tool call                  │
│  2. Sends to FastAPI backend for analysis       │
│  3. Waits for decision (auto or human)          │
│  4. Forwards approved calls to target server    │
└────────────┬──────────────────────┬─────────────┘
             │                      │
             ▼                      ▼
 ┌─────────────────────┐  ┌──────────────────────┐
 │  Agent-Lock Backend │  │  Target MCP Servers  │
 │  (backend/ FastAPI) │  │  (filesystem, github,│
 │                     │  │   postgres, etc.)    │
 │  • Risk Classifier  │  └──────────────────────┘
 │  • Intent Validator │
 │  • Telegram HITL    │
 │  • Auth0 Vault      │
 │  • Audit Logger     │
 └─────────────────────┘
```

---

## 🚀 Quick Start

### Requirements

- [Node.js](https://nodejs.org/) & `npm`
- [Python 3.10+](https://www.python.org/)
- [OpenClaw](https://github.com/openclaw/openclaw) *(for OpenClaw mode only)*

### 1. Clone & Configure

```powershell
git clone <your-repo-url>
cd agent-lock
# Create backend/.env (no template file is shipped yet)
# Add Telegram Bot Token, Chat ID, Gemini key and Auth0 values
```

Example `backend/.env` (minimum):

```env
BACKEND_URL=http://localhost:8000
BACKEND_PORT=8000
TELEGRAM_BOT_TOKEN=
TELEGRAM_CHAT_ID=
GEMINI_API_KEY=

AUTH0_DOMAIN=
AUTH0_CLIENT_ID=
AUTH0_CLIENT_SECRET=
AUTH0_AUDIENCE=https://agent-lock-api
AUTH0_CALLBACK_URL=http://localhost:8000/auth/callback
AUTH0_SCOPE=openid profile email offline_access
AUTH0_TOKEN_VAULT_ENABLED=true
AUTH0_GOOGLE_CONNECTION_NAME=google-oauth2
AUTH0_GOOGLE_AUDIENCE=https://www.googleapis.com/
AUTH0_GOOGLE_SCOPES=https://www.googleapis.com/auth/gmail.send
```

### 2. Install Dependencies

```powershell
# From project root — builds the OpenClaw plugin and installs it
.\install-plugin.ps1
```

### 3. Run

**Terminal 1 — Backend:**
```powershell
python agent-lock.py start
```

**OpenClaw mode — Terminal 2:**
```powershell
openclaw gateway
```

**Claude Desktop mode — Terminal 2:**
```powershell
python -m mcp_server
```

---

## 🔌 MCP Gateway

Agent-Lock proxies any existing MCP server through its governance layer. Claude sees all the tools, but every call is risk-classified before it reaches the real server.

### How It Works

```
Claude Desktop ──► Agent-Lock Gateway ──► filesystem MCP server
                          │
                          └─► Risk analysis + optional Telegram approval
```

1. Claude calls `filesystem__read_file`.
2. The gateway intercepts and forwards the call to the backend.
3. The backend classifies the risk (LOW / HIGH / CRITICAL).
4. **LOW** → auto-approved, forwarded immediately.
5. **HIGH / CRITICAL** → paused, Telegram alert sent, waits for your ✅/❌.
6. On approval, the call is forwarded to the real MCP server and the result returned to Claude.

### Tool Naming Convention

Proxied tools follow the pattern `{server_name}__{tool_name}`:

| Original tool | As seen by Claude |
|---|---|
| `read_file` (filesystem) | `filesystem__read_file` |
| `create_issue` (github) | `github__create_issue` |
| `query` (postgres) | `postgres__query` |

### Built-in Management Tools

Always available in Claude — no proxying required:

| Tool | Description |
|---|---|
| `agent_lock__status` | Gateway health, backend URL, connected servers, policy summary |
| `agent_lock__list_servers` | All configured servers with name, enabled flag, and connection status |

### Transports

| Transport | Command | Use case |
|---|---|---|
| `stdio` (default) | `python -m mcp_server` | Claude Desktop |
| `http` | `python -m mcp_server --transport http --port 8001` | Testing / ChatGPT plugins |

### Claude Desktop Integration

Add this to your `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "agent-lock": {
      "command": "python",
      "args": ["-m", "mcp_server"],
      "cwd": "C:\\nueva-carpeta\\agent-lock"
    }
  }
}
```

Agent-Lock will load your target servers from `~/.agent-lock/mcp_config.json` and expose all their tools through the governance layer.

### Custom Config Path

```powershell
# Via CLI flag
python -m mcp_server --config C:\path\to\mcp_config.json

# Via environment variable
$env:AGENT_LOCK_MCP_CONFIG = "C:\path\to\mcp_config.json"
python -m mcp_server
```

---

## ⚙️ Configuration

### MCP Gateway Config (`~/.agent-lock/mcp_config.json`)

Created automatically on first run. Edit it to register your target servers:

```json
{
  "backend_url": "http://localhost:8000",
  "auto_approve_low_risk": true,
  "require_approval_for_high": true,
  "require_approval_for_critical": true,
  "approval_timeout_seconds": 300,
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
  ]
}
```

### Policy Settings

| Key | Default | Description |
|---|---|---|
| `auto_approve_low_risk` | `true` | Skip Telegram for LOW risk calls |
| `require_approval_for_high` | `true` | Telegram approval required for HIGH |
| `require_approval_for_critical` | `true` | Telegram approval required for CRITICAL |
| `approval_timeout_seconds` | `300` | Seconds to wait before cancelling (fail-closed) |

### Backend Policies (`backend/policies.json`)

Define custom risk rules using regex patterns:

```json
{
  "id": "policy_file_delete",
  "tool_pattern": ".*(file|fs|filesystem|storage|disk).*",
  "condition": ".*(delete|remove|unlink|rmdir|rm|erase|wipe|purge|trash).*",
  "action": "FORCE_PENDING",
  "risk_level": "HIGH",
  "description": "Any file deletion always requires notification and human approval."
}
```

| Field | Description |
|---|---|
| `tool_pattern` | Regex matched against the tool name |
| `condition` | Regex matched against the tool arguments |
| `action` | `FORCE_PENDING` (require approval) or `BLOCK` (always deny) |
| `risk_level` | `LOW`, `HIGH`, or `CRITICAL` |

---

## 🔐 Governance Layer

### Risk Classification

Each tool call goes through two layers:

**1. Static Rules** (`backend/engine/action_rules.py`)
Regex patterns that instantly classify known dangerous patterns:
- Shell: `rm -rf`, `format`, `del /f`, `shutdown`
- Database: `DROP TABLE`, `TRUNCATE`, `DELETE FROM` without WHERE
- Code execution: arbitrary `exec`, `eval`, `subprocess` with destructive flags

**2. AI Analysis** (`backend/engine/intent_validator.py`)
Gemini 2.0 Flash compares the agent's technical action against your original instruction to detect semantic contradictions. If your intent was "summarize this file" but the agent tries to delete it, Gemini flags the mismatch.

- **Fallback:** Keyword-based scoring if Gemini is unavailable.
- **Empty intent:** If no user instruction is captured, Gemini is skipped and a neutral score (0.85) is returned — relying solely on static rules.

### Risk Levels

| Level | Example | Default Action |
|---|---|---|
| `LOW` | `ls`, `echo`, `read_file`, `Write-Host` | Auto-approved immediately |
| `HIGH` | `delete_file`, `exec` with unknown command | Telegram alert + human approval |
| `CRITICAL` | `DROP TABLE`, `rm -rf /`, destructive shell flags | Telegram alert + human approval |

### Human-in-the-Loop (Telegram)

When a HIGH or CRITICAL action is detected:

1. A detailed alert card arrives in your Telegram DM.
2. The card includes: tool name, server, arguments, risk level, and Gemini's analysis.
3. You tap **✅ Approve** or **❌ Reject**.
4. The gateway resumes or cancels the tool call instantly.
5. If no response arrives within `approval_timeout_seconds`, the action is **cancelled** (fail-closed).

> **Important:** Use a **separate** Telegram bot for Agent-Lock and OpenClaw to avoid a `409 Conflict` error on `getUpdates`.

### Token Vault (Auth0)

Rather than exposing hardcoded credentials, Agent-Lock requests short-lived tokens from Auth0 scoped to the minimum permissions required for each tool. The agent only ever sees the ephemeral session token — never the master credentials.

### Token Vault (Connected Accounts) — Implemented

Agent-Lock now supports real Auth0 Token Vault exchange for connected accounts (Google/GitHub/Slack) using:

- `grant_type=urn:auth0:params:oauth:grant-type:token-exchange:federated-connection-access-token`
- `requested_token_type=http://auth0.com/oauth/token-type/federated-connection-access-token`
- `connection=<provider-connection-name>`

This is used when an action requires end-user context. For these provider calls, Agent-Lock can run in **broker mode**:

- Action is approved/blocked as usual.
- Agent-Lock exchanges the user token via Token Vault.
- Agent-Lock calls the provider API itself.
- The provider token is not returned to the agent.

#### New broker endpoints

- `GET /vault/status`
- `POST /vault/google/gmail/send`

`/vault/google/gmail/send` sends an email through Gmail API using Token Vault exchange from the current authenticated user session or bearer token.

#### Quick broker test

1. Authenticate user:
   - Open `http://localhost:8000/auth/login?connection=google-oauth2`
2. Check status:
   - `GET http://localhost:8000/vault/status`
3. Send test email:

```json
POST /vault/google/gmail/send
{
  "to": "you@example.com",
  "subject": "Agent-Lock Token Vault test",
  "body_text": "Hello from Agent-Lock broker mode"
}
```

If this works, your hackathon requirement for Token Vault is materially satisfied.

| Scope | Used for |
|---|---|
| `read:files` | File read operations |
| `write:db` | Database writes |
| `admin:execute` | Shell execution |

---

## 📁 Project Structure

```
agent-lock/
├── agent-lock.py           # CLI entry point (start / stop / status)
├── mcp_launcher.py         # MCP gateway launcher helper
├── launch.ps1              # One-command launcher (backend + gateway)
├── install-plugin.ps1      # OpenClaw plugin installer
├── install-mcp.bat         # MCP dependency installer
│
├── mcp_server/             # MCP Gateway — Claude Desktop integration
│   ├── server.py           # Core server: list_tools + call_tool handlers
│   ├── proxy.py            # Target server subprocess manager
│   ├── validator.py        # Backend call + approval polling logic
│   ├── config.py           # Config dataclasses + mcp_config.json loader
│   ├── __main__.py         # python -m mcp_server entry point
│   └── README.md           # MCP-specific notes
│
├── backend/                # FastAPI governance backend
│   ├── main.py             # App entry point + route registration
│   ├── models.py           # Pydantic request/response models
│   ├── store.py            # SQLite-backed persistent state store (pending actions)
│   ├── config.py           # Backend settings (.env loader)
│   ├── policies.json       # Custom risk rules
│   ├── engine/             # Risk classifier + intent validator (Gemini)
│   ├── auth/               # Auth0 token vault
│   ├── notifications/      # Telegram bot (HITL flow)
│   ├── routes/             # FastAPI route handlers
│   └── audit/              # Structured JSON audit logs
│
├── plugin/                 # OpenClaw native extension (TypeScript)
│   └── agent-lock-plugin/
│       └── src/            # Interception hooks + backend client
│
└── dashboard/              # Next.js admin dashboard
    └── app/                # Policy editor, audit viewer, server status
```

---

## 📊 Audit Logs

All tool calls — approved, blocked, or timed out — are logged at `backend/audit/logs/` in structured JSON. Each entry includes:

- Timestamp and unique action ID
- Tool name, server name, and arguments
- Risk level and classification reason
- Gemini's intent analysis and contradiction score
- Final decision (`approved` / `blocked` / `timeout`) and decision source (`auto` / `human`)

---

## 🐛 Known Issues

These are active bugs and limitations in the current version:

| # | Issue | Area | Workaround |
|---|---|---|---|
| 1 | `vscode__replace_lines_code` and `vscode__create_file_code` return no confirmation on write — tools execute but don't always report success/failure | VS Code MCP plugin | Verify edits manually after each write |
| 2 | `vscode__list_files_code` fails with "Separator is not found" when called with absolute paths — only works with relative paths from workspace root | VS Code MCP plugin | Always use relative paths (e.g. `backend/` not `C:\...`) |
| 3 | `filesystem` MCP restricted to `C:\Users\ediva\Documents` — write access denied for projects outside that directory | Filesystem MCP config | Move project inside Documents or update allowed paths in `claude_desktop_config.json` |
| 4 | MCP config drift can leave enabled targets disconnected until dashboard toggles/reloads config | MCP monitor | Use `/mcp` diagnostics and target toggle to resync |
| 5 | Telegram `409 Conflict` if Agent-Lock and OpenClaw share the same bot token — `getUpdates` polling clashes | Notifications | Register a separate bot via `@BotFather` |
| 6 | Installing backend deps on Python 3.14 may fail for `pydantic-core` in some environments | Backend setup | Use Python 3.12 virtualenv for testing/CI |

---

## 🔮 Next Steps

### Immediate (fix current blockers)

- [ ] **Fix VS Code MCP write confirmation** — investigate why `create_file_code` / `replace_lines_code` return no result object; add explicit success/error response in the plugin
- [ ] **Expand filesystem MCP allowed paths** — update `claude_desktop_config.json` to include `C:\nueva-carpeta` so the governance layer can read/write project files directly
- [x] **Persist pending actions** — `store.py` now uses SQLite to survive backend restarts

### Short Term

- [ ] **Dashboard policy editor** — live `policies.json` editing via Next.js UI without restarting the backend
- [ ] **Webhook approval channel** — alternative to Telegram (Slack, Discord, or HTTP webhook) for environments where Telegram is blocked
- [ ] **Per-server risk overrides** — define different risk thresholds per target server in `mcp_config.json` (e.g. `filesystem` always HIGH, `github` read-only = LOW)
- [~] **Auth0 scope auto-mapping** — partial: provider detection + Token Vault exchange + broker mode added; complete per-tool mapping still pending

### Medium Term

- [ ] **Multi-agent session isolation** — track `user_intent` and approval state per session ID so concurrent agents don't share approval context
- [ ] **OpenTelemetry tracing** — distributed tracing across gateway → backend → target server for full observability
- [ ] **Rate limiting per tool** — configurable call limits per tool per session to prevent runaway agents
- [x] **Dashboard audit viewer** — `/logs` page with signature verification filters and CSV/JSON export

### Long Term

- [ ] **Claude-native approval UI** — replace Telegram with an in-chat approval flow using Claude's artifact system
- [ ] **Policy testing sandbox** — simulate tool calls against `policies.json` without executing them, to validate rules before deploying
- [ ] **Multi-user support** — per-user policies, approval routing, and audit separation for team deployments

---

*Documentation updated March 2026.*
