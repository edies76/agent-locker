# Agent-Lock (OpenClaw Plugin)

**Agent-Lock** is a governance, security, and human-in-the-loop approval layer for AI agents powered by OpenClaw. It dynamically intercepts agent actions, analyzes their risk level using Gemini, and routes dangerous actions to you (via Telegram) for approval before execution. It also provisions secure, zero-config OAuth tokens via its **Token Vault** so agents never see your actual credentials.

## 🚀 Why Agent-Lock?
- **Zero-Trust for Agents:** Prevent AI agents from making destructive actions (like deleting files or sending unauthorized emails).
- **Token Vault:** Agent-Lock manages OAuth flows (Google, GitHub, Slack). Agents get scoped, short-lived tokens, not persistent keys.
- **Dynamic Risk Assessment:** Every action is analyzed dynamically to estimate user intent vs. agent intent. LOW risk actions are auto-approved; HIGH/CRITICAL actions require your explicitly click (`YES`/`NO`) on Telegram.
- **Granular Scope Control:** Control exactly which capabilities (e.g. `gmail.send`, `calendar.events.list`) the agent is allowed to use at runtime.

---

## 📦 Installation & Setup

**1. Install Agent-Lock globally:**
```bash
npm i -g @agentlock/agent-lock
```

**2. Install and connect to OpenClaw:**
```bash
agent-lock install
```
This command adds the plugin to OpenClaw's registry and connects it to the official backend (`https://agent-lock-backend-api-7.azurewebsites.net`).

**3. Check your status:**
```bash
agent-lock status
```

**4. Restart OpenClaw gateway:**
```bash
openclaw gateway restart
```

---

## 🔐 Authentication & Provider Flow

Agent-Lock uses a "Primary Identity Hub" architecture separated from specific Providers (Google, GitHub, Slack).

### 1. Log in to your Agent-Lock Account
Before running any protected tools, log in:
```bash
agent-lock login
```
*This opens your browser. Once authenticated, your Agent-Lock session is established.*

### 2. Connect Providers (Optional but recommended)
To allow the agent to use external integrations (like sending a Slack message or drafting an email), connect the specific provider:
```bash
agent-lock login google
agent-lock login github
agent-lock login slack
```

### 3. Check Auth Status
See your primary identity and connected providers:
```bash
agent-lock auth-status    # Shows who you are logged in as
agent-lock services       # Shows which integrations are active (✅ Google, ❌ Slack...)
```

### 4. Manage Scopes
Check which exact scopes are available and permitted by your current configuration:
```bash
agent-lock scopes          # Check all providers
agent-lock scopes google   # Check Scopes specific to Google (Gmail, Calendar, Drive, YouTube)
```

---

## 💻 CLI Command Reference

| Command | Description |
|---|---|
| `agent-lock install` | Installs plugin in OpenClaw and auto-connects to backend. |
| `agent-lock status` | Verifies your connection, token state, and OpenClaw plugin registry. |
| `agent-lock connect` | Force re-connect to the official backend. |
| `agent-lock connect-channel --token <TOKEN>` | Pairs OpenClaw with your Dashboard channel using a token. |
| `agent-lock restart` | Quick alias to restart OpenClaw gateway. |
| `agent-lock uninstall` | Removes the plugin from OpenClaw. |
| `agent-lock update` | Pulls the latest package version and re-installs. |
| `agent-lock login [provider]` | Logs into Agent-Lock, or connects a specific provider. |
| `agent-lock auth-status` | Displays your current core authenticated account. |
| `agent-lock services` | Displays status for your external connections (google/github/slack). |
| `agent-lock scopes [provider]` | Shows available vs. permitted scopes per provider. |
| `agent-lock logout [provider]` | Logs out of Agent-Lock completely, or disconnects one provider. |

---

## ⚙️ How the Intercept Flow Works
1. OpenClaw initializes the `agent-lock` plugin.
2. When the user asks the agent to do something, Agent-Lock captures the **intent** securely.
3. Before the agent executes any tool, Agent-Lock intercepts the payload and queries the backend.
4. Backend evaluates risk:
   - **LOW Risk / Auto-Approved Scope**: Approves immediately and supplies the required OAuth token.
   - **HIGH / CRITICAL Risk**: Halts execution, sends a notification to Telegram with `Approve` / `Deny` buttons. The agent receives a `PENDING` status.
5. In Telegram, you approve the action. The backend grants the token, and the agent continues!

---
*Built for the 2026 AI Hackathon.*
