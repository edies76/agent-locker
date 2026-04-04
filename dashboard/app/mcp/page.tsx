"use client"

import Link from "next/link"
import { useCallback, useEffect, useMemo, useState } from "react"
import {
  fetchMCPStatus,
  fetchMCPTargets,
  fetchMCPTimings,
  fetchMCPDiagnostics,
  toggleMCPTarget,
} from "@/lib/api"
import {
  MCPStatus,
  MCPTargetsResponse,
  MCPTimingsResponse,
  MCPDiagnostics,
} from "@/types"
import { useToast } from "../components/Toast"

function ms(value: number | null | undefined): string {
  if (typeof value !== "number" || !Number.isFinite(value)) return "N/A"
  return `${value.toFixed(1)} ms`
}

function timeAgo(seconds: number | null): string {
  if (seconds === null) return "Never"
  if (seconds < 60) return `${seconds}s ago`
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`
  return `${Math.floor(seconds / 3600)}h ago`
}

export default function MCPMonitorPage() {
  const [status, setStatus] = useState<MCPStatus | null>(null)
  const [targets, setTargets] = useState<MCPTargetsResponse | null>(null)
  const [timings, setTimings] = useState<MCPTimingsResponse | null>(null)
  const [diagnostics, setDiagnostics] = useState<MCPDiagnostics | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [togglingServer, setTogglingServer] = useState<string | null>(null)
  const { showToast } = useToast()

  const load = useCallback(async () => {
    try {
      const [statusData, targetsData, timingsData, diagnosticsData] = await Promise.all([
        fetchMCPStatus(),
        fetchMCPTargets(),
        fetchMCPTimings(300),
        fetchMCPDiagnostics(),
      ])
      setStatus(statusData as MCPStatus)
      setTargets(targetsData as MCPTargetsResponse)
      setTimings(timingsData as MCPTimingsResponse)
      setDiagnostics(diagnosticsData as MCPDiagnostics)
      setError(null)
    } catch {
      setError("No se pudo cargar el monitor MCP")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
    const iv = setInterval(load, 5000)
    return () => clearInterval(iv)
  }, [load])

  const connectedServers = useMemo(() => {
    return (targets?.servers ?? []).filter((s) => s.connected).map((s) => s.name)
  }, [targets])

  const byTool = useMemo(() => {
    const latest = timings?.latest ?? []
    const map = new Map<string, { count: number; total: number }>()

    for (const item of latest) {
      const tool = item.tool_name || "unknown"
      const duration = item.timings_ms?.total_gateway_ms
      if (typeof duration !== "number") continue
      const row = map.get(tool) ?? { count: 0, total: 0 }
      row.count += 1
      row.total += duration
      map.set(tool, row)
    }

    return Array.from(map.entries())
      .map(([tool, data]) => ({ tool, count: data.count, avgMs: data.total / data.count }))
      .sort((a, b) => b.avgMs - a.avgMs)
      .slice(0, 10)
  }, [timings])

  const byServer = useMemo(() => {
    const latest = timings?.latest ?? []
    const allServers = targets?.servers?.map((s) => s.name) ?? []
    return allServers.map((server) => {
      const rows = latest.filter((x) => x.server_name === server)
      const values = rows
        .map((x) => x.timings_ms?.total_gateway_ms)
        .filter((v): v is number => typeof v === "number")
      const avgMs = values.length ? values.reduce((a, b) => a + b, 0) / values.length : null
      return {
        server,
        calls: rows.length,
        avgMs,
      }
    })
  }, [targets, timings])

  const handleToggle = useCallback(
    async (name: string, enabled: boolean) => {
      setTogglingServer(name)
      try {
        const result = await toggleMCPTarget(name, enabled)
        if (!result?.ok) {
          showToast({
            type: "error",
            title: result?.error || "Toggle failed",
            duration: 3000,
          })
          return
        }
        showToast({
          type: "success",
          title: result?.note || `${name} ${enabled ? "enabled" : "disabled"}`,
          duration: 3500,
        })
        await load()
      } catch {
        showToast({
          type: "error",
          title: "Could not update MCP target",
          duration: 3000,
        })
      } finally {
        setTogglingServer(null)
      }
    },
    [load, showToast]
  )

  const topology = useMemo(() => {
    const servers = targets?.servers ?? []
    return servers.map((s) => ({
      ...s,
      nodeColor: s.connected ? "bg-emerald-500" : s.enabled ? "bg-amber-500" : "bg-slate-500",
    }))
  }, [targets])

  return (
    <div className="space-y-6">
      <section className="glass-panel rounded-2xl border px-4 py-4 md:px-6 md:py-5">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-[0.18em] text-cyan-300">MCP Clarity Board</p>
            <h1 className="text-2xl md:text-3xl font-semibold text-white mt-1">
              Estado, Topologia y Diagnostico
            </h1>
            <p className="text-sm text-slate-300/85 mt-1">
              Mapa de servidores MCP, latencias y salud operativa en tiempo real.
            </p>
          </div>
          <button onClick={load} className="btn-glow rounded-lg px-4 py-2 text-sm font-semibold w-full md:w-auto">
            Refrescar monitor
          </button>
        </div>
      </section>

      {error && (
        <div className="glass-panel rounded-xl border px-4 py-3 text-sm text-red-300">{error}</div>
      )}

      <section className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <div className="glass-panel rounded-xl border p-4">
          <p className="text-xs uppercase tracking-wider text-slate-400">Gateway</p>
          <p className={`text-2xl font-semibold mt-1 ${status?.connected ? "text-emerald-300" : "text-red-300"}`}>
            {status?.connected ? "Online" : "Offline"}
          </p>
          <p className="text-xs text-slate-400 mt-1">Last seen {timeAgo(status?.seconds_ago ?? null)}</p>
        </div>
        <div className="glass-panel rounded-xl border p-4">
          <p className="text-xs uppercase tracking-wider text-slate-400">MCP conectados</p>
          <p className="text-2xl font-semibold text-white mt-1">{connectedServers.length}</p>
        </div>
        <div className="glass-panel rounded-xl border p-4">
          <p className="text-xs uppercase tracking-wider text-slate-400">Gateway avg</p>
          <p className="text-2xl font-semibold text-sky-300 mt-1">{ms(timings?.average_ms.total_gateway_ms)}</p>
        </div>
        <div className="glass-panel rounded-xl border p-4">
          <p className="text-xs uppercase tracking-wider text-slate-400">Baseline avg</p>
          <p className="text-2xl font-semibold text-emerald-300 mt-1">{ms(timings?.average_ms.baseline_direct_ms)}</p>
        </div>
        <div className="glass-panel rounded-xl border p-4">
          <p className="text-xs uppercase tracking-wider text-slate-400">Overhead avg</p>
          <p className="text-2xl font-semibold text-amber-300 mt-1">{ms(timings?.average_ms.agent_lock_overhead_ms)}</p>
        </div>
      </section>

      <section className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <div className="glass-panel rounded-xl border overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-700/40 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-100">Topologia MCP</h2>
            <span className="text-xs text-slate-400">
              {targets?.configured_count ?? 0} configurados / {targets?.connected_count ?? 0} online
            </span>
          </div>
          {loading ? (
            <div className="px-4 py-5 text-sm text-slate-400">Cargando...</div>
          ) : topology.length === 0 ? (
            <div className="px-4 py-5 text-sm text-slate-400">No hay servidores configurados.</div>
          ) : (
            <div className="p-4 space-y-3">
              {topology.map((s) => (
                <div key={s.name} className="rounded-lg border border-slate-700/40 p-3 bg-slate-900/20">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <span className={`w-2.5 h-2.5 rounded-full ${s.nodeColor}`} />
                      <div className="min-w-0">
                        <p className="text-sm text-slate-100 font-mono truncate">{s.name}</p>
                        <p className="text-xs text-slate-400 truncate">{s.command || "No command metadata"}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Link
                        href={`/mcp/${encodeURIComponent(s.name)}`}
                        className="rounded-md px-3 py-1 text-xs font-semibold border text-cyan-200 border-cyan-500/35 hover:bg-cyan-500/15"
                      >
                        Detalles
                      </Link>
                      <button
                        onClick={() => handleToggle(s.name, !s.enabled)}
                        disabled={togglingServer === s.name}
                        className={`rounded-md px-3 py-1 text-xs font-semibold border transition-colors ${
                          s.enabled
                            ? "text-amber-200 border-amber-500/40 hover:bg-amber-500/15"
                            : "text-emerald-200 border-emerald-500/40 hover:bg-emerald-500/15"
                        } disabled:opacity-50`}
                      >
                        {togglingServer === s.name ? "Updating..." : s.enabled ? "Disable" : "Enable"}
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="glass-panel rounded-xl border overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-700/40 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-100">Diagnostico de conexion</h2>
            <span
              className={`text-xs font-semibold ${
                diagnostics?.healthy ? "text-emerald-300" : "text-amber-300"
              }`}
            >
              {diagnostics?.healthy ? "Healthy" : "Needs attention"}
            </span>
          </div>
          <div className="p-4 space-y-4">
            <div>
              <p className="text-xs uppercase tracking-wider text-slate-500 mb-2">Causa exacta</p>
              <div className="rounded-md border border-cyan-500/25 bg-cyan-500/10 px-3 py-3">
                <p className="text-xs text-cyan-200 font-mono">
                  {(diagnostics?.root_cause_code || "UNKNOWN").toUpperCase()}
                </p>
                <p className="text-sm text-slate-100 mt-1">
                  {diagnostics?.root_cause_message || "No diagnostic summary available."}
                </p>
                <p className="text-xs text-slate-300 mt-2">
                  Siguiente paso: {diagnostics?.next_step || "Review MCP warnings and backend logs."}
                </p>
              </div>
            </div>

            {!!diagnostics?.disconnected_details?.length && (
              <div>
                <p className="text-xs uppercase tracking-wider text-slate-500 mb-2">Targets desconectados</p>
                <ul className="space-y-2">
                  {diagnostics.disconnected_details.map((item) => (
                    <li
                      key={item.name}
                      className="text-sm text-rose-200 bg-rose-500/10 border border-rose-500/20 rounded-md px-3 py-2"
                    >
                      <span className="font-mono text-rose-100">{item.name}</span>
                      {item.command ? ` | command: ${item.command}` : " | command: N/A"}
                      {item.endpoint ? ` | endpoint: ${item.endpoint}` : ""}
                      {typeof item.command_found === "boolean"
                        ? ` | command_found: ${item.command_found ? "yes" : "no"}`
                        : ""}
                      {typeof item.endpoint_reachable === "boolean"
                        ? ` | endpoint_reachable: ${item.endpoint_reachable ? "yes" : "no"}`
                        : ""}
                      {item.startup_hint ? ` | hint: ${item.startup_hint}` : ""}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div>
              <p className="text-xs uppercase tracking-wider text-slate-500 mb-2">Warnings</p>
              {diagnostics?.warnings?.length ? (
                <ul className="space-y-2">
                  {diagnostics.warnings.map((w, i) => (
                    <li key={`${w}-${i}`} className="text-sm text-amber-200 bg-amber-500/10 border border-amber-500/20 rounded-md px-3 py-2">
                      {w}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-emerald-300">No warnings detected.</p>
              )}
            </div>

            <div>
              <p className="text-xs uppercase tracking-wider text-slate-500 mb-2">Telegram polling</p>
              <div className="rounded-md border border-slate-700/40 bg-slate-900/30 px-3 py-3 space-y-1">
                <p className="text-sm text-slate-100">
                  Enabled: {diagnostics?.telegram_runtime?.polling_enabled ? "Yes" : "No"}
                </p>
                <p className="text-sm text-slate-100">
                  Active: {diagnostics?.telegram_runtime?.polling_active ? "Yes" : "No"}
                </p>
                <p className={`text-sm ${diagnostics?.telegram_runtime?.polling_conflict ? "text-rose-300" : "text-emerald-300"}`}>
                  Conflict: {diagnostics?.telegram_runtime?.polling_conflict ? "Detected" : "No"}
                </p>
                {!!diagnostics?.telegram_runtime?.last_error && (
                  <p className="text-xs text-rose-200 mt-2 border border-rose-500/20 bg-rose-500/10 rounded px-2 py-1">
                    {diagnostics.telegram_runtime.last_error}
                  </p>
                )}
              </div>
            </div>

            <div>
              <p className="text-xs uppercase tracking-wider text-slate-500 mb-2">Recommendations</p>
              {diagnostics?.recommendations?.length ? (
                <ul className="space-y-2">
                  {diagnostics.recommendations.map((r, i) => (
                    <li key={`${r}-${i}`} className="text-sm text-slate-200 bg-slate-900/30 border border-slate-700/40 rounded-md px-3 py-2">
                      {r}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-slate-400">System is operating within expected thresholds.</p>
              )}
            </div>
          </div>
        </div>
      </section>

      <section className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <div className="glass-panel rounded-xl border overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-700/40 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-100">Latencia por servidor</h2>
            <span className="text-xs text-slate-400">ultimas muestras</span>
          </div>
          {loading ? (
            <div className="px-4 py-5 text-sm text-slate-400">Cargando...</div>
          ) : (
            <div className="divide-y divide-slate-700/30">
              {byServer.map((row) => (
                <div key={row.server} className="px-4 py-3 flex items-center justify-between hover:bg-slate-900/20 transition-colors">
                  <div>
                    <p className="text-sm font-mono text-slate-100">{row.server}</p>
                    <p className="text-xs text-slate-400">{row.calls} llamadas recientes</p>
                  </div>
                  <span className="chip rounded-full px-3 py-1 text-xs text-sky-200">avg {ms(row.avgMs)}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="glass-panel rounded-xl border overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-700/40 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-100">Top tools por duracion</h2>
            <span className="text-xs text-slate-400">ultimas muestras</span>
          </div>
          {loading ? (
            <div className="px-4 py-5 text-sm text-slate-400">Cargando...</div>
          ) : byTool.length === 0 ? (
            <div className="px-4 py-5 text-sm text-slate-400">Sin muestras suficientes con timing.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-xs uppercase tracking-wider text-slate-400 bg-slate-900/35 border-b border-slate-700/40">
                    <th className="px-4 py-2 text-left">Tool</th>
                    <th className="px-4 py-2 text-left">Avg</th>
                    <th className="px-4 py-2 text-left">Muestras</th>
                  </tr>
                </thead>
                <tbody>
                  {byTool.map((row, idx) => (
                    <tr key={row.tool} className={idx % 2 === 0 ? "bg-slate-900/15" : "bg-slate-900/5"}>
                      <td className="px-4 py-2 text-slate-100 font-mono">{row.tool}</td>
                      <td className="px-4 py-2 text-sky-300 font-mono">{ms(row.avgMs)}</td>
                      <td className="px-4 py-2 text-slate-300">{row.count}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>

      <section className="glass-panel rounded-xl border px-4 py-3 text-xs text-slate-400">
        Config path: {targets?.config_path ?? "N/A"}
      </section>
    </div>
  )
}
