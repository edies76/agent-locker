"use client"

import Link from "next/link"
import { useEffect, useMemo, useState, useCallback } from "react"
import { fetchActivity, fetchMCPTargets } from "@/lib/api"
import { Action, MCPTargetsResponse } from "@/types"

type FilterRisk = "ALL" | "LOW" | "HIGH" | "CRITICAL"
type FilterStatus = "ALL" | "PENDING" | "AUTO_APPROVED" | "APPROVED" | "BLOCKED"

function avg(values: number[]): number | null {
  if (!values.length) return null
  return values.reduce((a, b) => a + b, 0) / values.length
}

function toMs(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) ? v : null
}

export default function ActivityPage() {
  const [actions, setActions] = useState<Action[]>([])
  const [targets, setTargets] = useState<MCPTargetsResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [riskFilter, setRiskFilter] = useState<FilterRisk>("ALL")
  const [statusFilter, setStatusFilter] = useState<FilterStatus>("ALL")
  const [search, setSearch] = useState("")

  const load = useCallback(async () => {
    try {
      const [activityData, targetData] = await Promise.all([
        fetchActivity(120),
        fetchMCPTargets(),
      ])
      setActions(Array.isArray(activityData) ? activityData : [])
      setTargets(targetData)
      setError(null)
    } catch {
      setError("No se pudo cargar la actividad")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
    const interval = setInterval(() => {
      if (document.visibilityState === "visible") {
        load()
      }
    }, 5000)
    return () => clearInterval(interval)
  }, [load])

  const connectedServers = useMemo(() => {
    return (targets?.servers ?? []).filter((s) => s.connected).map((s) => s.name)
  }, [targets])

  const filtered = useMemo(() => {
    return actions.filter((a) => {
      if (riskFilter !== "ALL" && a.risk_level !== riskFilter) return false
      if (statusFilter !== "ALL" && a.decision !== statusFilter) return false

      const query = search.trim().toLowerCase()
      if (!query) return true

      const haystack = [
        a.tool_name,
        a.agent_id ?? "",
        a.analysis ?? "",
        a.execution?.server_name ?? "",
      ]
        .join(" ")
        .toLowerCase()

      return haystack.includes(query)
    })
  }, [actions, riskFilter, statusFilter, search])

  const timingSummary = useMemo(() => {
    const totals: number[] = []
    const overheads: number[] = []

    for (const action of filtered) {
      const total = toMs(action.execution?.timings_ms?.total_gateway_ms)
      if (total !== null) totals.push(total)

      const overhead = toMs(action.execution?.timings_ms?.agent_lock_overhead_ms)
      if (overhead !== null) overheads.push(overhead)
    }

    return {
      measured: totals.length,
      avgGateway: avg(totals),
      avgOverhead: avg(overheads),
    }
  }, [filtered])

  const toolDurationRows = useMemo(() => {
    const map = new Map<string, { count: number; total: number; serverNames: Set<string> }>()

    for (const action of filtered) {
      const total = toMs(action.execution?.timings_ms?.total_gateway_ms)
      if (total === null) continue

      const key = action.tool_name
      const row = map.get(key) ?? { count: 0, total: 0, serverNames: new Set<string>() }
      row.count += 1
      row.total += total
      if (action.execution?.server_name) row.serverNames.add(action.execution.server_name)
      map.set(key, row)
    }

    return Array.from(map.entries())
      .map(([tool, data]) => ({
        tool,
        count: data.count,
        avgMs: data.total / data.count,
        servers: Array.from(data.serverNames),
      }))
      .sort((a, b) => b.avgMs - a.avgMs)
  }, [filtered])

  const groupedByConnectedServer = useMemo(() => {
    const groups = connectedServers.map((serverName) => {
      const items = filtered.filter((a) => a.execution?.server_name === serverName)
      const totals = items
        .map((a) => toMs(a.execution?.timings_ms?.total_gateway_ms))
        .filter((v): v is number => v !== null)

      return {
        serverName,
        count: items.length,
        avgMs: avg(totals),
        items: items.slice(0, 8),
      }
    })

    return groups
  }, [connectedServers, filtered])

  const riskFilters: FilterRisk[] = ["ALL", "LOW", "HIGH", "CRITICAL"]
  const statusFilters: FilterStatus[] = ["ALL", "PENDING", "AUTO_APPROVED", "APPROVED", "BLOCKED"]

  return (
    <div className="space-y-6">
      <section className="glass-panel rounded-2xl px-6 py-5 border">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.18em] text-sky-300">Activity Intelligence</p>
            <h1 className="text-2xl md:text-3xl font-semibold text-white mt-1">Tool Timing y Separacion por MCP</h1>
            <p className="text-sm text-slate-300/80 mt-1">
              Cada llamada muestra su duracion y cada servidor MCP conectado tiene su bloque independiente.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={load} className="btn-glow text-sm font-semibold px-4 py-2 rounded-lg">
              Actualizar
            </button>
            <span className="chip text-xs text-slate-300 rounded-full px-3 py-1">
              {filtered.length} eventos visibles
            </span>
          </div>
        </div>
      </section>

      <section className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="glass-panel rounded-xl p-4 border">
          <p className="text-xs uppercase tracking-wider text-slate-400">Con timing</p>
          <p className="text-3xl font-semibold text-white mt-1">{timingSummary.measured}</p>
        </div>
        <div className="glass-panel rounded-xl p-4 border">
          <p className="text-xs uppercase tracking-wider text-slate-400">Gateway promedio</p>
          <p className="text-3xl font-semibold text-sky-300 mt-1">
            {timingSummary.avgGateway !== null ? `${timingSummary.avgGateway.toFixed(1)} ms` : "N/A"}
          </p>
        </div>
        <div className="glass-panel rounded-xl p-4 border">
          <p className="text-xs uppercase tracking-wider text-slate-400">Overhead promedio</p>
          <p className="text-3xl font-semibold text-amber-300 mt-1">
            {timingSummary.avgOverhead !== null ? `${timingSummary.avgOverhead.toFixed(1)} ms` : "N/A"}
          </p>
        </div>
        <div className="glass-panel rounded-xl p-4 border">
          <p className="text-xs uppercase tracking-wider text-slate-400">MCP conectados</p>
          <p className="text-3xl font-semibold text-emerald-300 mt-1">{connectedServers.length}</p>
        </div>
      </section>

      <section className="glass-panel rounded-xl p-4 border space-y-3">
        <div className="flex flex-col md:flex-row gap-3 md:items-center">
          <input
            type="text"
            placeholder="Buscar por tool, server o analisis"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="flex-1 rounded-lg bg-slate-900/40 border border-slate-600/40 text-slate-100 px-3 py-2 text-sm focus:outline-none focus:border-sky-400/60"
          />
          <div className="flex flex-wrap gap-2">
            {riskFilters.map((r) => (
              <button
                key={r}
                onClick={() => setRiskFilter(r)}
                className={`chip rounded-full text-xs px-3 py-1 ${riskFilter === r ? "text-sky-200 border-sky-300/70" : "text-slate-300"}`}
              >
                {r}
              </button>
            ))}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {statusFilters.map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`chip rounded-full text-xs px-3 py-1 ${statusFilter === s ? "text-emerald-200 border-emerald-300/70" : "text-slate-300"}`}
            >
              {s}
            </button>
          ))}
        </div>
      </section>

      <section className="glass-panel rounded-xl border overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-700/40 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-100">Recuento de duracion por tool</h2>
          <span className="text-xs text-slate-400">Ordenado por mayor latencia promedio</span>
        </div>

        {loading ? (
          <div className="px-4 py-6 text-sm text-slate-400">Cargando...</div>
        ) : error ? (
          <div className="px-4 py-6 text-sm text-red-300">{error}</div>
        ) : toolDurationRows.length === 0 ? (
          <div className="px-4 py-6 text-sm text-slate-400">No hay datos de timing todavia.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs uppercase tracking-wider text-slate-400 bg-slate-900/40 border-b border-slate-700/40">
                  <th className="px-4 py-2 text-left">Tool</th>
                  <th className="px-4 py-2 text-left">Avg gateway</th>
                  <th className="px-4 py-2 text-left">Muestras</th>
                  <th className="px-4 py-2 text-left">MCP servers</th>
                </tr>
              </thead>
              <tbody>
                {toolDurationRows.map((row, idx) => (
                  <tr key={row.tool} className={idx % 2 === 0 ? "bg-slate-900/20" : "bg-slate-900/5"}>
                    <td className="px-4 py-2 font-mono text-slate-100">{row.tool}</td>
                    <td className="px-4 py-2 text-sky-300 font-mono">{row.avgMs.toFixed(1)} ms</td>
                    <td className="px-4 py-2 text-slate-300">{row.count}</td>
                    <td className="px-4 py-2 text-slate-300">{row.servers.length ? row.servers.join(", ") : "N/A"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-white">Actividad separada por MCP conectado</h2>
          <span className="text-xs text-slate-400">Fuente: Dashboard + heartbeat MCP</span>
        </div>

        {connectedServers.length === 0 ? (
          <div className="glass-panel rounded-xl border px-4 py-5 text-sm text-slate-400">
            No hay MCP conectados en este momento.
          </div>
        ) : (
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
            {groupedByConnectedServer.map((group) => (
              <div key={group.serverName} className="glass-panel rounded-xl border overflow-hidden">
                <div className="px-4 py-3 border-b border-slate-700/40 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold text-white font-mono">{group.serverName}</p>
                    <p className="text-xs text-slate-400">{group.count} acciones</p>
                  </div>
                  <span className="chip text-xs text-slate-300 rounded-full px-3 py-1">
                    avg {group.avgMs !== null ? `${group.avgMs.toFixed(1)} ms` : "N/A"}
                  </span>
                </div>

                {group.items.length === 0 ? (
                  <div className="px-4 py-5 text-sm text-slate-400">Sin eventos para este MCP con tus filtros actuales.</div>
                ) : (
                  <div className="divide-y divide-slate-700/25">
                    {group.items.map((action) => (
                      <Link
                        key={action.action_id}
                        href={`/activity/${action.action_id}`}
                        className="block px-4 py-3 hover:bg-sky-900/15 transition-colors"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="text-sm font-mono text-slate-100">{action.tool_name}</p>
                            <p className="text-xs text-slate-400 mt-0.5">{new Date(action.timestamp).toLocaleString()}</p>
                          </div>
                          <div className="text-right">
                            <p className="text-xs text-sky-300 font-mono">
                              {toMs(action.execution?.timings_ms?.total_gateway_ms) !== null
                                ? `${toMs(action.execution?.timings_ms?.total_gateway_ms)!.toFixed(1)} ms`
                                : "N/A"}
                            </p>
                            <p className="text-xs text-slate-400">{action.decision}</p>
                          </div>
                        </div>
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
