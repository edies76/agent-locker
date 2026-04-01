"use client"

import { useState, useEffect } from "react"
import { Card, CardHeader, CardContent, Button, Input, Badge } from "@/app/components/ui"

type TargetServer = {
  name: string
  command: string
  args: string[]
  enabled: boolean
}

type SetupStep = {
  number: number
  title: string
  status: "pending" | "complete" | "active"
}

export default function MCPSetupPage() {
  const [servers, setServers] = useState<TargetServer[]>([])
  const [newServer, setNewServer] = useState({ name: "", command: "", args: "" })
  const [claudeDesktopPath, setClaudeDesktopPath] = useState<string | null>(null)
  const [setupSteps, setSetupSteps] = useState<SetupStep[]>([
    { number: 1, title: "Install npm package", status: "pending" },
    { number: 2, title: "Run agent-lock-mcp install", status: "pending" },
    { number: 3, title: "Configure target servers", status: "active" },
    { number: 4, title: "Connect Claude Desktop", status: "pending" },
  ])

  useEffect(() => {
    loadConfig()
    detectClaudeDesktop()
  }, [])

  async function loadConfig() {
    try {
      const res = await fetch("/api/mcp/config")
      if (res.ok) {
        const data = await res.json()
        setServers(data.target_servers || [])
      }
    } catch (err) {
      console.error("Failed to load MCP config:", err)
    }
  }

  async function detectClaudeDesktop() {
    try {
      const res = await fetch("/api/mcp/detect-claude")
      if (res.ok) {
        const data = await res.json()
        setClaudeDesktopPath(data.path)
      }
    } catch (err) {
      console.error("Failed to detect Claude Desktop:", err)
    }
  }

  async function saveConfig() {
    try {
      const res = await fetch("/api/mcp/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ target_servers: servers }),
      })
      if (res.ok) {
        alert("✅ Configuration saved!")
        updateStepStatus(3, "complete")
        updateStepStatus(4, "active")
      }
    } catch (err) {
      alert("❌ Failed to save config")
    }
  }

  function addServer() {
    if (!newServer.name || !newServer.command) return
    
    setServers([
      ...servers,
      {
        name: newServer.name,
        command: newServer.command,
        args: newServer.args.split(" ").filter(Boolean),
        enabled: true,
      },
    ])
    setNewServer({ name: "", command: "", args: "" })
  }

  function removeServer(index: number) {
    setServers(servers.filter((_, i) => i !== index))
  }

  function toggleServer(index: number) {
    setServers(
      servers.map((s, i) => (i === index ? { ...s, enabled: !s.enabled } : s))
    )
  }

  function updateStepStatus(stepNumber: number, status: SetupStep["status"]) {
    setSetupSteps(
      setupSteps.map((step) =>
        step.number === stepNumber ? { ...step, status } : step
      )
    )
  }

  async function autoConfigureClaude() {
    try {
      const res = await fetch("/api/mcp/configure-claude", {
        method: "POST",
      })
      if (res.ok) {
        alert("✅ Claude Desktop configured! Restart Claude to apply changes.")
        updateStepStatus(4, "complete")
      } else {
        alert("❌ Failed to auto-configure. Follow manual instructions below.")
      }
    } catch (err) {
      alert("❌ Failed to auto-configure. Follow manual instructions below.")
    }
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">MCP Setup</h1>
          <p className="text-muted-foreground mt-1">
            Configure Agent-Lock MCP Gateway for Claude Desktop
          </p>
        </div>
      </div>

      {/* Setup Steps */}
      <Card className="p-6">
        <h2 className="font-semibold mb-4">Setup Progress</h2>
        <div className="space-y-3">
          {setupSteps.map((step) => (
            <div key={step.number} className="flex items-center gap-3">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                  step.status === "complete"
                    ? "bg-green-500 text-white"
                    : step.status === "active"
                    ? "bg-blue-500 text-white"
                    : "bg-muted text-muted-foreground"
                }`}
              >
                {step.status === "complete" ? "✓" : step.number}
              </div>
              <div className="flex-1">
                <div className="font-medium">{step.title}</div>
                {step.number === 1 && step.status !== "complete" && (
                  <code className="text-xs text-muted-foreground">
                    npm i -g @agentlock/mcp-server
                  </code>
                )}
                {step.number === 2 && step.status !== "complete" && (
                  <code className="text-xs text-muted-foreground">
                    agent-lock-mcp install
                  </code>
                )}
              </div>
              <Badge
                variant={
                  step.status === "complete"
                    ? "success"
                    : step.status === "active"
                    ? "warning"
                    : "neutral"
                }
              >
                {step.status}
              </Badge>
            </div>
          ))}
        </div>
      </Card>

      {/* Target Servers Configuration */}
      <Card className="p-6">
        <h2 className="font-semibold mb-4">Target MCP Servers</h2>
        <p className="text-sm text-muted-foreground mb-4">
          Add MCP servers that Agent-Lock will proxy and protect.
        </p>

        {/* Existing Servers */}
        <div className="space-y-2 mb-4">
          {servers.map((server, index) => (
            <div
              key={index}
              className="flex items-center gap-3 p-3 rounded-lg border bg-card"
            >
              <input
                type="checkbox"
                checked={server.enabled}
                onChange={() => toggleServer(index)}
                className="w-4 h-4"
              />
              <div className="flex-1">
                <div className="font-medium">{server.name}</div>
                <code className="text-xs text-muted-foreground">
                  {server.command} {server.args.join(" ")}
                </code>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => removeServer(index)}
              >
                Remove
              </Button>
            </div>
          ))}
        </div>

        {/* Add New Server */}
        <div className="space-y-3 p-4 rounded-lg border border-dashed">
          <Input
            placeholder="Server name (e.g., filesystem)"
            value={newServer.name}
            onChange={(e) => setNewServer({ ...newServer, name: e.target.value })}
          />
          <Input
            placeholder="Command (e.g., npx)"
            value={newServer.command}
            onChange={(e) =>
              setNewServer({ ...newServer, command: e.target.value })
            }
          />
          <Input
            placeholder="Arguments (e.g., -y @modelcontextprotocol/server-filesystem C:/Documents)"
            value={newServer.args}
            onChange={(e) => setNewServer({ ...newServer, args: e.target.value })}
          />
          <Button onClick={addServer} className="w-full">
            Add Server
          </Button>
        </div>

        <div className="mt-4 flex gap-3">
          <Button onClick={saveConfig} className="flex-1">
            Save Configuration
          </Button>
        </div>
      </Card>

      {/* Claude Desktop Configuration */}
      <Card className="p-6">
        <h2 className="font-semibold mb-4">Claude Desktop Integration</h2>

        {claudeDesktopPath ? (
          <div className="space-y-4">
            <div className="flex items-start gap-3 p-3 rounded-lg bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-900">
              <div className="text-green-600 dark:text-green-400 text-xl">✓</div>
              <div className="flex-1">
                <div className="font-medium text-green-900 dark:text-green-100">
                  Claude Desktop detected
                </div>
                <code className="text-xs text-green-700 dark:text-green-300">
                  {claudeDesktopPath}
                </code>
              </div>
            </div>

            <Button onClick={autoConfigureClaude} className="w-full">
              Auto-Configure Claude Desktop
            </Button>

            <div className="text-sm text-muted-foreground">
              This will add Agent-Lock to your{" "}
              <code>claude_desktop_config.json</code>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="p-3 rounded-lg bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-900">
              <div className="font-medium text-amber-900 dark:text-amber-100 mb-2">
                Manual Configuration Required
              </div>
              <p className="text-sm text-amber-700 dark:text-amber-300 mb-3">
                Add this to your <code>claude_desktop_config.json</code>:
              </p>
              <pre className="bg-background p-3 rounded border text-xs overflow-x-auto">
{`{
  "mcpServers": {
    "agent-lock": {
      "command": "agent-lock-mcp",
      "args": ["serve"]
    }
  }
}`}
              </pre>
            </div>

            <div className="text-sm space-y-2">
              <div className="font-medium">Config file locations:</div>
              <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                <li>
                  <strong>Windows:</strong>{" "}
                  <code>%APPDATA%\Claude\claude_desktop_config.json</code>
                </li>
                <li>
                  <strong>macOS:</strong>{" "}
                  <code>~/Library/Application Support/Claude/claude_desktop_config.json</code>
                </li>
                <li>
                  <strong>Linux:</strong>{" "}
                  <code>~/.config/Claude/claude_desktop_config.json</code>
                </li>
              </ul>
            </div>
          </div>
        )}
      </Card>

      {/* Quick Start Commands */}
      <Card className="p-6">
        <h2 className="font-semibold mb-4">Quick Start Commands</h2>
        <div className="space-y-2">
          <div>
            <div className="text-sm text-muted-foreground mb-1">
              1. Install package
            </div>
            <code className="block bg-muted p-2 rounded text-sm">
              npm i -g @agentlock/mcp-server
            </code>
          </div>
          <div>
            <div className="text-sm text-muted-foreground mb-1">
              2. Install server
            </div>
            <code className="block bg-muted p-2 rounded text-sm">
              agent-lock-mcp install
            </code>
          </div>
          <div>
            <div className="text-sm text-muted-foreground mb-1">
              3. Check status
            </div>
            <code className="block bg-muted p-2 rounded text-sm">
              agent-lock-mcp status
            </code>
          </div>
          <div>
            <div className="text-sm text-muted-foreground mb-1">
              4. Test manually (optional)
            </div>
            <code className="block bg-muted p-2 rounded text-sm">
              agent-lock-mcp serve
            </code>
          </div>
        </div>
      </Card>
    </div>
  )
}
