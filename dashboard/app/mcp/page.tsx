"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { fetchMCPStatus, fetchMCPTargets, fetchMCPTimings } from "@/lib/api"
import { MCPStatus, MCPTargetsResponse, MCPTimingsResponse } from "@/types"

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
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      const [statusData, targetsData, timingsData] = await Promise.all([
        fetchMCPStatus(),
        fetchMCPTargets(),
        fetchMCPTimings(300),
      ])
      setStatus(statusData)
      setTargets(targetsData)
      setTimings(timingsData)
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
    return connectedServers.map((server) => {
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
  }, [connectedServers, timings])

  return (
    <div className="space-y-6">
      <section className="glass-panel rounded-2xl px-6 py-5 border">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-[0.18em] text-cyan-300">MCP Clarity Board</p>
            <h1 className="text-2xl md:text-3xl font-semibold text-white mt-1">Estado, Rendimiento y Segmentacion</h1>
            <p className="text-sm text-slate-300/85 mt-1">
              Vista operativa de Agent-Lock para entender en segundos que MCP esta conectado y cuanto tarda cada tool.
            </p>
          </div>
          <button onClick={load} className="btn-glow rounded-lg px-4 py-2 text-sm font-semibold">
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
            <h2 className="text-sm font-semibold text-slate-100">Segmentado por MCP conectado</h2>
            <span className="text-xs text-slate-400">{connectedServers.length} conectados</span>
          </div>

          {loading ? (
            <div className="px-4 py-5 text-sm text-slate-400">Cargando...</div>
          ) : connectedServers.length === 0 ? (
            <div className="px-4 py-5 text-sm text-slate-400">No hay MCP conectados.</div>
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
