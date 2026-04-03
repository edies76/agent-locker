# 🦞 Agent-Lock

Agent-Lock is a **security and governance middleware** that intercepts and approves tool calls made by AI agents. If an agent attempts a high-risk or destructive action (like dropping a database, wiping files, or executing dangerous shell commands), Agent-Lock halts the execution, notifies you on Telegram, and waits for your human-in-the-loop approval before proceeding.

Originally built for **OpenClaw**, Agent-Lock now ships a full **MCP Gateway** that works with **Claude Desktop**, **ChatGPT**, and any MCP-compatible AI client.

---

## 📐 Architectural Separation Overview

Agent-Lock is split into two physical repositories to enforce security boundaries and simplify deployment:

1. **Frontend & MCP Layer (This Repository)**
   - Houses the local `mcp_server` (proxy for Claude/Manus/Cursor), the `dashboard/` (Next.js), and the `plugin/` integrations.
   - Designed to run **locally on the user's/developer's machine** to maintain secure filesystem access.
   
2. **Governance Backend ([edies76/backend-agentlock](https://github.com/edies76/backend-agentlock))**
   - The centralized policy engine containing Auth, Risk Classification, Telegram Approvals, and Audit Logs.
   - Hosted remotely. 
   - **Production URL:** `https://agent-lock-backend-api-7.azurewebsites.net`

All frontend apps in this repo communicate with the live Azure Web App out of the box.

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

## ✅ Verified Runtime Notes (2026-04-01)

This section documents what was validated in a live environment and what was changed to stabilize the Auth flow.

### Auth + URL verification

- Public backend in use: `https://agent-lock-backend-api-7.azurewebsites.net`
- `GET /auth/login` now redirects with:
  - `redirect_uri=https://agent-lock-backend-api-7.azurewebsites.net/auth/callback`
  - signed `state` format `nonce.signature` (state hardening enabled)
- Auth0 application (`My App`, client `GIu3JAdUIQ6o01Uq1iqpdLfQWFP4rpV6`) was verified/updated with:
  - Allowed Callback URLs:
    - `https://agent-lock-backend-api-7.azurewebsites.net/auth/callback`
    - `http://localhost:8000/auth/callback`
  - Allowed Logout URLs:
    - `https://agent-lock-backend-api-7.azurewebsites.net`
    - `http://localhost:8000/`
  - Allowed Origins / Web Origins:
    - `https://agent-lock-backend-api-7.azurewebsites.net`
    - `http://localhost:8000`

### AUTH_REQUIRED behavior hardening

- Duplicate AUTH_REQUIRED actions are deduplicated (same active `action_id`) to avoid notification spam.
- Added Telegram re-notify cooldown support for stale auth-required actions:
  - `AUTH_REQUIRED_RENOTIFY_SECONDS` (config key: `auth_required_renotify_seconds`, default `60`)
- Persisted auth-required notification state in SQLite:
  - `auth_notification_sent`
  - `auth_last_notified_at`

### Telegram auth UX

- Auth-required message includes explicit login link text and clickable link.
- Local URL fallback behavior improved.
- Cloud URL is now preferred via `PUBLIC_BASE_URL`.

### Logging noise reduction

- Plugin runtime logging reduced in installed config:
  - `C:\Users\ediva\.openclaw\extensions\agent-lock\agent-lock.config.json`
  - `log_level: "error"` (or `"warn"` for moderate verbosity)
- AUTH_REQUIRED warn log is now throttled per action/tool to reduce repeated noise.

### Important repository/deploy note

- In this repository, `backend/` is currently ignored by `.gitignore`.
- That means backend fixes do **not** deploy through regular git push in this repo.
- For cloud rollout, deploy backend directly (zip deploy) or use the backend repository/pipeline that tracks backend files.

---

## 🔢 Mandatory Versioning Policy (Required)

Every code/documentation change in Agent-Lock must bump version and update docs.

### Rules

1. **No change without version bump.**
2. **Update version before local install/deploy.**
3. **Reflect version and behavior changes in documentation (`README.md` and plugin docs).**

### Current plugin version line

- Latest local plugin updates validated through:
  - `1.1.1` → `1.1.2` → `1.1.3`
  - `1.1.3` auth-flow hardening:
    - AUTH_REQUIRED no longer exposes raw `login_url` in agent-facing `blockReason`.
    - Plugin now waits for auth completion (status polling) before blocking, so login can finish in-band.
    - Timeout is configurable via `AGENT_LOCK_AUTH_WAIT_MS` (default `600000`).
  - `1.1.4` subject-token stabilization:
    - Plugin now always sends a stable subject token (`default`) when env/config token is missing.
    - Prevents repeated AUTH_REQUIRED loops caused by empty subject identity between chat/login flows.
  - `1.1.5` forced Gmail relogin flow:
    - For `agent_lock_gmail_send`, plugin can force a fresh auth path (new subject token suffix) to re-trigger login.
    - After login completes and status becomes `PENDING`, plugin now continues into the approval flow automatically (instead of blocking as auth-required timeout).
  - `1.1.6` auth flow normalization:
    - Removed forced relogin behavior.
    - Plugin now uses normal session-based login semantics: request login only when unauthenticated, and do not ask again once authenticated.
  - `1.1.7` auth session tools:
    - Added `agent_lock_auth_status` to inspect current login state/account from the agent.
    - Added `agent_lock_auth_logout` to force logout so the next protected action requires login again.
  - `1.1.8` CLI auth commands:
    - Added `agent-lock login` (prints login URL bound to current subject token).
    - Added `agent-lock auth-status` (shows authenticated account from backend `/auth/me`).
    - Added `agent-lock logout` (forces backend logout for current subject token).
  - `1.1.9` channel alignment hardening:
    - `agent-lock login` now appends `subject_token` in the login URL query string, so browser login and CLI/plugin status checks are tied to the same identity channel.
  - `1.1.10` interactive login + channel consistency:
    - `agent-lock login` now opens browser automatically and waits interactively in terminal for login confirmation.
    - CLI `logout` now uses `POST /auth/logout` first (compatible with backend), with GET fallback.
    - Removed forced `connection=google-oauth2` from default login URLs to avoid "connection is not enabled" failures.
    - Backend now binds `subject_token` from login flow to server session, so `/auth/me` and CLI/plugin auth channel stay aligned.
  - `1.1.11` cloud session utility:
    - Added `agent-lock cloud-logout` command to force logout directly against official cloud backend (`https://agent-lock-backend-api-7.azurewebsites.net`) using current `subject_token`.
  - `1.1.12` unified logout behavior:
    - `agent-lock logout` now logs out from configured backend and official cloud backend in one command.
    - Added request timeout guard to avoid hanging CLI calls.
    - `agent-lock cloud-logout` is now a compatibility alias of `logout`.
  - `1.1.13` auth status detection:
    - `agent-lock status` now queries `/auth/me` to verify actual authentication state.
    - Shows `authenticated: true/false` and provides actionable guidance.
    - Detects plugin connected but not authenticated vs fully authenticated states.

### Standard local update command

```powershell
cd plugin\agent-lock-plugin
.\update-local.ps1
```

This script:
- bumps `package.json` version (1.1.x policy),
- syncs `openclaw.plugin.json`,
- builds and installs into OpenClaw extensions.

After running it, restart gateway:

```powershell
openclaw gateway
```

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

## 👥 Super-Easy MCP Setup (For Other Users)

If you want teammates to use Agent-Lock MCP with almost zero friction on Windows:

1. Download this repository (ZIP) and extract it.
2. Double-click [installers/mcp/install-mcp.bat](installers/mcp/install-mcp.bat).
3. Open and edit `%USERPROFILE%\\.agent-lock\\mcp_config.json` to add `target_servers`.
4. Double-click [installers/mcp/start-mcp.bat](installers/mcp/start-mcp.bat) to run MCP in stdio mode.

Optional testing mode:

- Use [installers/mcp/start-mcp-http.bat](installers/mcp/start-mcp-http.bat) to run MCP over HTTP on port `8001`.
- SSE endpoint for clients: `http://localhost:8001/sse`

Default backend used by installer config:

- Azure backend URL: `https://agent-lock-backend-api-7.azurewebsites.net`

Notes:

- The installer creates `.mcp-venv` automatically and installs dependencies.
- Existing `%USERPROFILE%\\.agent-lock\\mcp_config.json` is never overwritten.

## 🖱️ One-Click Local Starters

To make local usage easy for teammates, installers are grouped under [installers](installers):

- MCP installers:
  - [installers/mcp/install-mcp.bat](installers/mcp/install-mcp.bat)
  - [installers/mcp/start-mcp.bat](installers/mcp/start-mcp.bat)
  - [installers/mcp/start-mcp-http.bat](installers/mcp/start-mcp-http.bat)

- Backend starters:
  - [installers/backend/run-backend.bat](installers/backend/run-backend.bat)
  - [installers/backend/run-backend.ps1](installers/backend/run-backend.ps1)
- Frontend starters:
  - [installers/frontend/start-frontend.bat](installers/frontend/start-frontend.bat)
  - [installers/frontend/start-frontend.ps1](installers/frontend/start-frontend.ps1)

Typical local workflow:

1. Double-click backend starter.
2. Double-click frontend starter.
3. Open `http://localhost:3000`.

Important (Telegram 409 conflict prevention):

- Local backend starters set `TELEGRAM_POLLING_ENABLED=false` by default.
- This prevents `getUpdates` conflicts when cloud backend is already polling with the same bot token.
- If you intentionally want Telegram polling locally, run with `TELEGRAM_POLLING_ENABLED=true` and ensure only one polling instance uses that bot token.

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
AUTH0_GITHUB_CONNECTION_NAME=github
AUTH0_SLACK_CONNECTION_NAME=slack
AUTH0_GOOGLE_AUDIENCE=https://www.googleapis.com/
AUTH0_GOOGLE_SCOPES=https://www.googleapis.com/auth/gmail.send https://www.googleapis.com/auth/calendar
```

### 2. Install Dependencies

```powershell
# Backend deps
cd backend
python -m venv venv
.\venv\Scripts\pip install -r ..\requirements.txt
cd ..

# Plugin (public npm package)
npm i -g @agentlock/agent-lock
agent-lock install
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

- `GET /vault/status` - Check Token Vault authentication status
- `POST /vault/google/gmail/send` - Send email via Gmail API
- `POST /vault/github/issues/create` - Create GitHub issue
- `POST /vault/slack/messages/send` - Send Slack message
- `POST /vault/google/calendar/events` - Create Google Calendar event

These endpoints use Token Vault exchange from the current authenticated user session or bearer token to call external APIs server-side (broker mode).

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
