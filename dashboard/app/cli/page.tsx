"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { Badge, Button, Card, CardContent, CardHeader, Input } from "@/app/components/ui"
import { useToast } from "@/app/components/Toast"
import { fetchCLICatalog, fetchCLIConfig, runCLICommand, updateCLIConfig } from "@/lib/api"
import { CLICatalogResponse, CLICommandCatalogItem, CLIConfigResponse, CLIRunResponse } from "@/types"

type PluginForm = {
  backend_url: string
  status_poll_ms: number
  status_poll_ms_max: number
  log_level: "debug" | "info" | "warn" | "error"
  subject_token: string
}

type MCPForm = {
  backend_url: string
  subject_token: string
  auto_approve_low_risk: boolean
  require_approval_for_high: boolean
  require_approval_for_critical: boolean
  approval_timeout_seconds: number
  local_cache_ttl: number
  audit_log_path: string
}

type RunState = {
  loading: boolean
  commandId: string | null
  output: CLIRunResponse | null
}

const MUTE_OUTPUT = "No output"

function CommandBadge({ cmd }: { cmd: CLICommandCatalogItem }) {
  if (cmd.runnable) {
    return <Badge variant="success">Runnable</Badge>
  }
  return <Badge variant="warning">Manual</Badge>
}

export default function CLIPage() {
  const { showToast } = useToast()
  const [catalog, setCatalog] = useState<CLICatalogResponse | null>(null)
  const [configData, setConfigData] = useState<CLIConfigResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [runState, setRunState] = useState<RunState>({
    loading: false,
    commandId: null,
    output: null,
  })

  const [pluginForm, setPluginForm] = useState<PluginForm>({
    backend_url: "",
    status_poll_ms: 500,
    status_poll_ms_max: 2000,
    log_level: "warn",
    subject_token: "",
  })

  const [mcpForm, setMcpForm] = useState<MCPForm>({
    backend_url: "",
    subject_token: "",
    auto_approve_low_risk: true,
    require_approval_for_high: true,
    require_approval_for_critical: true,
    approval_timeout_seconds: 300,
    local_cache_ttl: 3600,
    audit_log_path: "logs/mcp_audit.jsonl",
  })

  const [addServerInput, setAddServerInput] = useState({
    name: "",
    server_command: "",
    server_args: "",
  })

  const load = useCallback(async (refresh = false) => {
    setLoading(true)
    try {
      const [catalogRes, configRes] = await Promise.all([
        fetchCLICatalog({ refresh }) as Promise<CLICatalogResponse>,
        fetchCLIConfig({ refresh }) as Promise<CLIConfigResponse>,
      ])
      setCatalog(catalogRes)
      setConfigData(configRes)
      setPluginForm({
        backend_url: configRes.plugin_runtime.backend_url || "",
        status_poll_ms: configRes.plugin_runtime.status_poll_ms ?? 500,
        status_poll_ms_max: configRes.plugin_runtime.status_poll_ms_max ?? 2000,
        log_level: configRes.plugin_runtime.log_level ?? "warn",
        subject_token: configRes.plugin_runtime.subject_token || "",
      })
      setMcpForm({
        backend_url: configRes.mcp_config.backend_url || "",
        subject_token: configRes.mcp_config.subject_token || "",
        auto_approve_low_risk: Boolean(configRes.mcp_config.auto_approve_low_risk),
        require_approval_for_high: Boolean(configRes.mcp_config.require_approval_for_high),
        require_approval_for_critical: Boolean(configRes.mcp_config.require_approval_for_critical),
        approval_timeout_seconds: Number(configRes.mcp_config.approval_timeout_seconds ?? 300),
        local_cache_ttl: Number(configRes.mcp_config.local_cache_ttl ?? 3600),
        audit_log_path: configRes.mcp_config.audit_log_path || "logs/mcp_audit.jsonl",
      })
    } catch (error) {
      showToast({
        type: "error",
        title: "Failed to load CLI controls",
        message: error instanceof Error ? error.message : "Unknown error",
      })
    } finally {
      setLoading(false)
    }
  }, [showToast])

  useEffect(() => {
    void load()
  }, [load])

  const pluginCommands = useMemo(
    () => (catalog?.commands || []).filter((c) => c.family === "plugin"),
    [catalog]
  )
  const mcpCommands = useMemo(
    () => (catalog?.commands || []).filter((c) => c.family === "mcp"),
    [catalog]
  )

  async function handleSaveConfig() {
    setSaving(true)
    try {
      const res = await updateCLIConfig({
        plugin: pluginForm,
        mcp: mcpForm,
      })
      if (!res?.ok) {
        throw new Error(res?.error || "Config update failed")
      }
      showToast({
        type: "success",
        title: "CLI runtime config saved",
      })
      await load(true)
    } catch (error) {
      showToast({
        type: "error",
        title: "Could not save config",
        message: error instanceof Error ? error.message : "Unknown error",
      })
    } finally {
      setSaving(false)
    }
  }

  async function executeCommand(cmd: CLICommandCatalogItem) {
    if (!cmd.runnable) return
    setRunState({ loading: true, commandId: cmd.id, output: null })
    try {
      const body: {
        family: "plugin" | "mcp"
        command: string
        timeout_seconds: number
        options?: Record<string, unknown>
      } = {
        family: cmd.family,
        command: cmd.command,
        timeout_seconds: cmd.command === "update" ? 420 : 180,
      }

      if (cmd.id === "mcp.add-server") {
        body.options = {
          name: addServerInput.name.trim(),
          server_command: addServerInput.server_command.trim(),
          server_args: addServerInput.server_args.trim(),
        }
      }

      const result = (await runCLICommand(body)) as CLIRunResponse
      setRunState({ loading: false, commandId: cmd.id, output: result })

      if (result.ok) {
        showToast({ type: "success", title: `${cmd.title} finished` })
        if (cmd.id === "mcp.add-server") {
          setAddServerInput({ name: "", server_command: "", server_args: "" })
        }
        await load(true)
      } else {
        showToast({
          type: "error",
          title: `${cmd.title} failed`,
          message: result.error || `Exit code ${result.exit_code ?? "unknown"}`,
        })
      }
    } catch (error) {
      setRunState({ loading: false, commandId: cmd.id, output: null })
      showToast({
        type: "error",
        title: "Command execution failed",
        message: error instanceof Error ? error.message : "Unknown error",
      })
    }
  }

  function renderCommandList(commands: CLICommandCatalogItem[]) {
    return (
      <div className="space-y-3">
        {commands.map((cmd) => {
          const isRunning = runState.loading && runState.commandId === cmd.id
          return (
            <div key={cmd.id} className="rounded-lg border p-3" style={{ borderColor: "var(--border-primary)" }}>
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <p className="font-semibold" style={{ color: "var(--text-primary)" }}>{cmd.title}</p>
                    <CommandBadge cmd={cmd} />
                  </div>
                  <p className="text-sm" style={{ color: "var(--text-secondary)" }}>{cmd.description}</p>
                  <code className="text-xs" style={{ color: "var(--text-muted)" }}>
                    {cmd.family === "plugin" ? "agent-lock" : "agent-lock-mcp"} {cmd.command}
                  </code>
                  {!cmd.runnable && cmd.manual_reason && (
                    <p className="text-xs" style={{ color: "var(--text-muted)" }}>{cmd.manual_reason}</p>
                  )}
                </div>
                <Button
                  size="sm"
                  variant={cmd.runnable ? "primary" : "secondary"}
                  disabled={!cmd.runnable || isRunning}
                  loading={isRunning}
                  onClick={() => void executeCommand(cmd)}
                >
                  {cmd.runnable ? "Run" : "Manual only"}
                </Button>
              </div>
              {cmd.id === "mcp.add-server" && (
                <div className="mt-3 grid gap-2 md:grid-cols-3">
                  <Input
                    placeholder="Server name"
                    value={addServerInput.name}
                    onChange={(e) => setAddServerInput((p) => ({ ...p, name: e.target.value }))}
                  />
                  <Input
                    placeholder="Command"
                    value={addServerInput.server_command}
                    onChange={(e) => setAddServerInput((p) => ({ ...p, server_command: e.target.value }))}
                  />
                  <Input
                    placeholder="Args (optional)"
                    value={addServerInput.server_args}
                    onChange={(e) => setAddServerInput((p) => ({ ...p, server_args: e.target.value }))}
                  />
                </div>
              )}
            </div>
          )
        })}
      </div>
    )
  }

  const outputText = useMemo(() => {
    if (!runState.output) return ""
    const out = (runState.output.stdout || "").trim() || MUTE_OUTPUT
    const err = (runState.output.stderr || "").trim()
    return [
      `ok: ${runState.output.ok}`,
      `command: ${runState.output.executed || `${runState.output.family} ${runState.output.command}`}`,
      `exit_code: ${runState.output.exit_code ?? "n/a"}`,
      runState.output.timed_out ? "timed_out: true" : null,
      runState.output.error ? `error: ${runState.output.error}` : null,
      "",
      "stdout:",
      out,
      "",
      "stderr:",
      err || MUTE_OUTPUT,
    ]
      .filter(Boolean)
      .join("\n")
  }, [runState.output])

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="page-title">Agent-Lock CLI Controls</h1>
          <p className="page-subtitle">
            Run most `agent-lock` and `agent-lock-mcp` commands and configure runtime from dashboard.
          </p>
        </div>
        <Button variant="secondary" onClick={() => void load(true)} disabled={loading}>
          Refresh
        </Button>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader title="Plugin Runtime Config" subtitle={configData?.paths.plugin_runtime_path || ""} />
          <CardContent className="space-y-3">
            <Input
              label="Backend URL"
              value={pluginForm.backend_url}
              onChange={(e) => setPluginForm((p) => ({ ...p, backend_url: e.target.value }))}
            />
            <div className="grid gap-3 md:grid-cols-2">
              <Input
                label="status_poll_ms"
                type="number"
                value={String(pluginForm.status_poll_ms)}
                onChange={(e) => setPluginForm((p) => ({ ...p, status_poll_ms: Number(e.target.value || 0) }))}
              />
              <Input
                label="status_poll_ms_max"
                type="number"
                value={String(pluginForm.status_poll_ms_max)}
                onChange={(e) => setPluginForm((p) => ({ ...p, status_poll_ms_max: Number(e.target.value || 0) }))}
              />
            </div>
            <div>
              <label className="block text-sm mb-1" style={{ color: "var(--text-secondary)" }}>log_level</label>
              <select
                className="input w-full"
                value={pluginForm.log_level}
                onChange={(e) =>
                  setPluginForm((p) => ({ ...p, log_level: e.target.value as PluginForm["log_level"] }))
                }
              >
                <option value="debug">debug</option>
                <option value="info">info</option>
                <option value="warn">warn</option>
                <option value="error">error</option>
              </select>
            </div>
            <Input
              label="subject_token"
              value={pluginForm.subject_token}
              onChange={(e) => setPluginForm((p) => ({ ...p, subject_token: e.target.value }))}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader title="MCP Runtime Config" subtitle={configData?.paths.mcp_config_path || ""} />
          <CardContent className="space-y-3">
            <Input
              label="backend_url"
              value={mcpForm.backend_url}
              onChange={(e) => setMcpForm((p) => ({ ...p, backend_url: e.target.value }))}
            />
            <Input
              label="subject_token"
              value={mcpForm.subject_token}
              onChange={(e) => setMcpForm((p) => ({ ...p, subject_token: e.target.value }))}
            />
            <div className="grid gap-3 md:grid-cols-2">
              <Input
                label="approval_timeout_seconds"
                type="number"
                value={String(mcpForm.approval_timeout_seconds)}
                onChange={(e) =>
                  setMcpForm((p) => ({ ...p, approval_timeout_seconds: Number(e.target.value || 0) }))
                }
              />
              <Input
                label="local_cache_ttl"
                type="number"
                value={String(mcpForm.local_cache_ttl)}
                onChange={(e) => setMcpForm((p) => ({ ...p, local_cache_ttl: Number(e.target.value || 0) }))}
              />
            </div>
            <Input
              label="audit_log_path"
              value={mcpForm.audit_log_path}
              onChange={(e) => setMcpForm((p) => ({ ...p, audit_log_path: e.target.value }))}
            />
            <div className="space-y-2 text-sm" style={{ color: "var(--text-secondary)" }}>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={mcpForm.auto_approve_low_risk}
                  onChange={(e) => setMcpForm((p) => ({ ...p, auto_approve_low_risk: e.target.checked }))}
                />
                auto_approve_low_risk
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={mcpForm.require_approval_for_high}
                  onChange={(e) => setMcpForm((p) => ({ ...p, require_approval_for_high: e.target.checked }))}
                />
                require_approval_for_high
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={mcpForm.require_approval_for_critical}
                  onChange={(e) =>
                    setMcpForm((p) => ({ ...p, require_approval_for_critical: e.target.checked }))
                  }
                />
                require_approval_for_critical
              </label>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="flex justify-end">
        <Button onClick={() => void handleSaveConfig()} loading={saving}>
          Save Runtime Config
        </Button>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader title="Plugin CLI Commands" subtitle={`${pluginCommands.length} commands`} />
          <CardContent>{renderCommandList(pluginCommands)}</CardContent>
        </Card>

        <Card>
          <CardHeader title="MCP CLI Commands" subtitle={`${mcpCommands.length} commands`} />
          <CardContent>{renderCommandList(mcpCommands)}</CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader
          title="Last Execution Output"
          subtitle="stdout/stderr of the latest command launched from dashboard"
        />
        <CardContent>
          <pre className="whitespace-pre-wrap rounded-lg border p-3 text-xs overflow-auto max-h-[420px]" style={{ borderColor: "var(--border-primary)", color: "var(--text-secondary)" }}>
            {outputText || "No command executed yet."}
          </pre>
        </CardContent>
      </Card>
    </div>
  )
}

