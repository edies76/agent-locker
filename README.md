# 🦞 Agent-Lock for OpenClaw

Agent-Lock is a security and governance middleware designed to intercept and approve tool calls made by **OpenClaw** agents. If an AI agent attempts a high-risk or destructive action (like dropping a database, wiping files, or executing dangerous shell commands), Agent-Lock halts the execution, pings you on Telegram, and waits for your human-in-the-loop approval.

## 🚀 How to Start

There are two main components: the **Backend** (Python) that handles analysis and notifications, and the **Plugin** (TypeScript) that integrates natively with OpenClaw.

### 1. Requirements

- [Node.js](https://nodejs.org/) & `npm`
- [Python 3](https://www.python.org/)
- [OpenClaw](https://github.com/openclaw/openclaw) installed globally (`npm install -g openclaw`)

### 2. Setup (One-time only)

1. **Clone the repository:**
   ```powershell
   git clone <your-repo-url>
   cd agent-lock
   ```

2. **Configure Environment Variables:**
   - Navigate to `backend/` and copy the example file:
     ```powershell
     cd backend
     cp .env.example .env
     ```
   - Edit `.env` to include your Telegram Bot Token, Chat ID, and Gemini API keys.

3. **Install Dependencies & Install the Plugin:**
   - Open a PowerShell as Administrator from the project root.
   - Run the installer script, which builds the OpenClaw plugin and installs it natively into your `~/.openclaw/extensions/agent-lock` folder:
     ```powershell
     .\install-plugin.ps1
     ```

### 3. Running the System

To use the agent with human-in-the-loop protection:

**Terminal 1: Start the Backend Layer**
From the project root:
```powershell
python agent-lock.py start
```

**Terminal 2: Launch OpenClaw**
```powershell
openclaw gateway
```
OpenClaw will automatically load the Agent-Lock extension and monitor all tool calls.

---

## ⚙️ Configuration (Policies)

You can define custom risk policies inside `backend/policies.json`.
For example, this policy explicitly blocks file deletions until human approval:

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

## 🔐 How it Works

1. OpenClaw tries to run a tool (e.g., `fs.delete`).
2. Our native OpenClaw extension intercepts the tool trigger before it executes.
3. It sends the details to the Python backend.
4. If it triggers a policy (or Gemini flags the prompt as risky), the execution is paused (`PENDING`).
5. A detailed alert arrives in your Telegram DM containing the risk analysis.
6. You reply ✅ "Approve" or ❌ "Reject", and OpenClaw resumes or blocks the tool operation instantly.
