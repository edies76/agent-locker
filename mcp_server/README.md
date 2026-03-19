# Agent-Lock MCP Server

MCP (Model Context Protocol) server that acts as a **governance gateway** for Claude Desktop, ChatGPT, and other MCP clients.

## What This Does

Agent-Lock MCP Server sits between your AI assistant (Claude Desktop, ChatGPT) and other MCP servers (filesystem, GitHub, databases, etc.):

```
Claude Desktop → Agent-Lock MCP → Target MCP Servers
                     │
                     ▼
              Risk Classification
              Intent Validation
              Approval (Telegram)
```

**Every tool call is validated before execution:**
- LOW risk → auto-approved
- HIGH risk → requires Telegram approval
- CRITICAL risk → blocked or requires approval

## Installation

### 1. Install Dependencies

```bash
cd c:\Nueva-carpeta\agent-lock
pip install -r requirements.txt
```

### 2. Create Configuration

The server will create a default config at `~/.agent-lock/mcp_config.json` on first run.

Edit it to add your target MCP servers:

```json
{
  "target_servers": [
    {
      "name": "filesystem",
      "command": "npx",
      "args": ["-y", "@anthropic/mcp-server-filesystem", "C:\\Users\\yourname\\Documents"],
      "enabled": true
    },
    {
      "name": "github",
      "command": "npx",
      "args": ["-y", "@anthropic/mcp-server-github"],
      "env": {"GITHUB_TOKEN": "ghp_xxxx"},
      "enabled": true
    }
  ],
  "backend_url": "http://localhost:8000",
  "telegram_bot_token": "YOUR_BOT_TOKEN",
  "telegram_chat_id": "YOUR_CHAT_ID",
  "auto_approve_low_risk": true,
  "require_approval_for_high": true,
  "require_approval_for_critical": true
}
```

### 3. Start the Backend

The MCP server connects to the Agent-Lock backend for validation and approvals:

```bash
cd c:\Nueva-carpeta\agent-lock
python -m uvicorn backend.main:app --reload --port 8000
```

### 4. Run the MCP Server

**For testing (HTTP transport):**
```bash
python -m mcp_server --transport http --port 8001
```

**For Claude Desktop (stdio transport):**
```bash
python -m mcp_server
```

## Configure Claude Desktop

Add Agent-Lock to your Claude Desktop config file:

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

Restart Claude Desktop after updating the config.

## Available Tools

Agent-Lock MCP Server exposes these tools:

| Tool | Description |
|------|-------------|
| `execute_tool` | Execute a tool on a target server (with validation) |
| `list_available_tools` | List all tools from all connected servers |
| `list_servers` | List configured target servers |

## Resources

| Resource | Description |
|----------|-------------|
| `agent-lock://status` | Server status |
| `agent-lock://config` | Current configuration |

## How It Works

### Risk Classification

Tools are classified by risk level:

- **LOW**: Read-only operations (read_file, list_directory)
- **HIGH**: Write operations (write_file, execute_command)
- **CRITICAL**: Destructive operations (rm -rf, DROP TABLE)

### Approval Flow

1. Tool call received
2. Risk classification
3. If HIGH/CRITICAL → send Telegram notification
4. User approves/denies via Telegram
5. Tool executed or blocked

### Integration with Backend

The MCP server calls the Agent-Lock backend (`/intercept` endpoint) for:
- Full risk classification with Gemini AI validation
- Telegram notification and approval polling
- Audit logging

## Example Usage in Claude

Once configured, Claude can use Agent-Lock tools:

```
User: Read the file C:\Users\me\Documents\notes.txt

Claude: I'll read that file for you.
[Calls: execute_tool(server="filesystem", tool="read_file", args={path: "..."})]

Agent-Lock: Risk = LOW → Auto-approved
Result: [file contents]
```

```
User: Delete the folder C:\Users\me\Documents\old_stuff

Claude: I'll delete that folder.
[Calls: execute_tool(server="filesystem", tool="delete_directory", args={...})]

Agent-Lock: Risk = CRITICAL → Blocked
Result: Error - CRITICAL risk operation blocked by policy
```

## Development

### Project Structure

```
mcp_server/
├── __init__.py      # Package init
├── __main__.py      # Entry point
├── server.py        # FastMCP server definition
├── proxy.py         # Tool proxy to target servers
├── validator.py     # Risk classification & validation
└── config.py        # Configuration management
```

### Adding New Target Servers

Edit `~/.agent-lock/mcp_config.json` to add new MCP servers:

```json
{
  "name": "my-custom-server",
  "command": "node",
  "args": ["path/to/my-server.js"],
  "enabled": true
}
```

## Troubleshooting

### Server not appearing in Claude Desktop

1. Check the config file path is correct
2. Ensure Python is in your PATH
3. Check Claude Desktop logs: `%APPDATA%\Claude\logs\`

### Tool calls failing

1. Verify the backend is running on port 8000
2. Check target MCP servers are installed (npx commands)
3. Review stderr output for error messages

### Approval not working

1. Verify Telegram bot token and chat ID in config
2. Ensure the backend's Telegram bot is configured
3. Check the backend logs for notification errors
