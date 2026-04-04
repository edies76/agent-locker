"use client"

import { useEffect, useMemo, useState } from "react"
import { Button, Card, Input, Select, Badge } from "@/app/components/ui"
import { fetchCLICatalog, runCLICommand } from "@/lib/api"
import type { CLICatalogCommand, CLICatalogCommandInput, CLIRunResponse } from "@/types"

const FAMILY_OPTIONS = [
  { value: "all", label: "All" },
  { value: "plugin", label: "Plugin" },
  { value: "mcp", label: "MCP" },
]

function getDefaultOptions(inputs: CLICatalogCommandInput[] | undefined): Record<string, string> {
  const options: Record<string, string> = {}
  for (const input of inputs ?? []) {
    options[input.name] = ""
  }
  return options
}

export default function CLIPage() {
  const [loading, setLoading] = useState(false)
  const [runningId, setRunningId] = useState<string | null>(null)
  const [catalog, setCatalog] = useState<CLICatalogCommand[]>([])
  const [familyFilter, setFamilyFilter] = useState("all")
  const [outputs, setOutputs] = useState<Record<string, CLIRunResponse>>({})
  const [optionsByCommand, setOptionsByCommand] = useState<Record<string, Record<string, string>>>({})
  const [loadError, setLoadError] = useState<string | null>(null)

  const filteredCommands = useMemo(() => {
    const commands = catalog
    if (familyFilter === "all") return commands
    return commands.filter((cmd) => cmd.family === familyFilter)
  }, [catalog, familyFilter])

  const loadCatalog = async () => {
    setLoading(true)
    try {
      const res = await fetchCLICatalog({ refresh: true })
      const commands = Array.isArray(res?.commands) ? res.commands : []
      setCatalog(commands)
      setLoadError(
        commands.length === 0
          ? "No CLI commands were returned by backend. Check /dashboard/cli/catalog availability."
          : null
      )
      setOptionsByCommand((prev) => {
        const next = { ...prev }
        for (const cmd of commands) {
          if (!next[cmd.id]) next[cmd.id] = getDefaultOptions(cmd.inputs)
        }
        return next
      })
    } catch (error) {
      setCatalog([])
      setLoadError(error instanceof Error ? error.message : "Could not load CLI catalog.")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadCatalog()
  }, [])

  const handleInputChange = (cmdId: string, key: string, value: string) => {
    setOptionsByCommand((prev) => ({
      ...prev,
      [cmdId]: {
        ...(prev[cmdId] ?? {}),
        [key]: value,
      },
    }))
  }

  const runCommand = async (cmd: CLICatalogCommand) => {
    setRunningId(cmd.id)
    try {
      const options = optionsByCommand[cmd.id] ?? {}
      const payloadOptions: Record<string, unknown> = {}
      for (const input of cmd.inputs ?? []) {
        const value = (options[input.name] ?? "").trim()
        if (!value) continue
        if (input.type === "number") payloadOptions[input.name] = Number(value)
        else if (input.type === "boolean") payloadOptions[input.name] = value.toLowerCase() === "true"
        else payloadOptions[input.name] = value
      }
      const res = await runCLICommand({
        family: cmd.family,
        command: cmd.command,
        options: payloadOptions,
      })
      setOutputs((prev) => ({ ...prev, [cmd.id]: res }))
    } finally {
      setRunningId(null)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="page-title">CLI Controls</h1>
          <p className="page-subtitle">Run Agent-Lock plugin and MCP commands from dashboard</p>
        </div>
        <div className="flex gap-2">
          <div className="min-w-[160px]">
            <Select
              options={FAMILY_OPTIONS}
              value={familyFilter}
              onChange={(e) => setFamilyFilter(e.target.value)}
            />
          </div>
          <Button variant="secondary" onClick={() => void loadCatalog()} loading={loading}>
            Refresh
          </Button>
        </div>
      </div>

      <div className="grid gap-4">
        {loadError && (
          <Card padding="md">
            <p className="text-sm" style={{ color: "#fca5a5" }}>{loadError}</p>
          </Card>
        )}
        {!loading && !loadError && filteredCommands.length === 0 && (
          <Card padding="md">
            <p className="text-sm" style={{ color: "var(--text-muted)" }}>
              No commands available for this filter.
            </p>
          </Card>
        )}
        {filteredCommands.map((cmd) => {
          const output = outputs[cmd.id]
          const cmdOptions = optionsByCommand[cmd.id] ?? {}
          const isRunning = runningId === cmd.id
          return (
            <Card key={cmd.id} padding="md">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold" style={{ color: "var(--text-primary)" }}>{cmd.title}</h3>
                    <Badge variant={cmd.family === "plugin" ? "accent" : "neutral"}>{cmd.family}</Badge>
                    <Badge variant={cmd.runnable ? "success" : "warning"}>
                      {cmd.runnable ? "Runnable" : "Manual"}
                    </Badge>
                  </div>
                  <p className="text-sm" style={{ color: "var(--text-secondary)" }}>{cmd.description}</p>
                  <p className="text-xs font-mono mt-1" style={{ color: "var(--text-muted)" }}>
                    {cmd.family} {cmd.command}
                  </p>
                </div>
                {cmd.runnable ? (
                  <Button size="sm" onClick={() => void runCommand(cmd)} loading={isRunning}>
                    Run
                  </Button>
                ) : (
                  <Badge variant="warning">{cmd.manual_reason ?? "Manual command"}</Badge>
                )}
              </div>

              {(cmd.inputs ?? []).length > 0 && (
                <div className="mt-3 grid gap-3 md:grid-cols-2">
                  {(cmd.inputs ?? []).map((input) => (
                    <Input
                      key={input.name}
                      label={input.label}
                      value={cmdOptions[input.name] ?? ""}
                      onChange={(e) => handleInputChange(cmd.id, input.name, e.target.value)}
                      placeholder={input.required ? "Required" : "Optional"}
                    />
                  ))}
                </div>
              )}

              {output && (
                <div className="mt-3 rounded-lg border p-3" style={{ borderColor: "var(--border-primary)", background: "var(--bg-tertiary)" }}>
                  <div className="mb-2 flex items-center gap-2">
                    <Badge variant={output.ok ? "success" : "danger"}>{output.ok ? "Success" : "Failed"}</Badge>
                    <span className="text-xs font-mono" style={{ color: "var(--text-muted)" }}>
                      exit={String(output.exit_code ?? "n/a")}
                    </span>
                  </div>
                  {output.executed && (
                    <p className="text-xs font-mono mb-2" style={{ color: "var(--text-muted)" }}>
                      {output.executed}
                    </p>
                  )}
                  {output.stdout && (
                    <pre className="text-xs font-mono whitespace-pre-wrap mb-2" style={{ color: "var(--text-primary)" }}>
{output.stdout}
                    </pre>
                  )}
                  {output.stderr && (
                    <pre className="text-xs font-mono whitespace-pre-wrap" style={{ color: "#fda4af" }}>
{output.stderr}
                    </pre>
                  )}
                </div>
              )}
            </Card>
          )
        })}
      </div>
    </div>
  )
}

