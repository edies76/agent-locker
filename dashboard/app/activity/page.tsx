"use client"

import Link from "next/link"
import { useEffect, useMemo, useState, useCallback } from "react"
import { fetchActivity, fetchMCPTargets } from "@/lib/api"
import { Action, MCPTargetsResponse } from "@/types"
import { useToast } from "../components/Toast"
import { exportToJSON, exportToCSV } from "@/lib/export"
import { debounce } from "@/lib/cache"
import Card, { CardHeader, CardContent } from "@/app/components/ui/Card"
import Button from "@/app/components/ui/Button"
import Badge from "@/app/components/ui/Badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableEmpty } from "@/app/components/ui/Table"

type FilterRisk = "ALL" | "LOW" | "HIGH" | "CRITICAL"
type FilterStatus = "ALL" | "PENDING" | "AUTO_APPROVED" | "APPROVED" | "BLOCKED" | "AUTH_REQUIRED"

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
  const [debouncedSearch, setDebouncedSearch] = useState("")
  const [regexMode, setRegexMode] = useState(false)
  const [dateFrom, setDateFrom] = useState("")
  const [dateTo, setDateTo] = useState("")
  const { showToast } = useToast()

  // Debounced search
  const debouncedSetSearch = useMemo(
    () => debounce((value: string) => setDebouncedSearch(value), 300),
    []
  )

  useEffect(() => {
    debouncedSetSearch(search)
  }, [search, debouncedSetSearch])

  const load = useCallback(async () => {
    try {
      const [activityData, targetData] = await Promise.all([
        fetchActivity(120),
        fetchMCPTargets(),
      ])
      setActions(Array.isArray(activityData) ? activityData : [])
      setTargets(targetData as MCPTargetsResponse)
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
      // Risk filter
      if (riskFilter !== "ALL" && a.risk_level !== riskFilter) return false
      
      // Status filter
      if (statusFilter !== "ALL" && a.decision !== statusFilter) return false

      // Date range filter
      if (dateFrom || dateTo) {
        const actionDate = new Date(a.timestamp)
        if (dateFrom && actionDate < new Date(dateFrom)) return false
        if (dateTo && actionDate > new Date(dateTo + 'T23:59:59')) return false
      }

      // Search filter (debounced)
      const query = debouncedSearch.trim()
      if (!query) return true

      const haystack = [
        a.tool_name,
        a.agent_id ?? "",
        a.analysis ?? "",
        a.execution?.server_name ?? "",
        JSON.stringify(a.args || {}),
      ].join(" ")

      if (regexMode) {
        try {
          const regex = new RegExp(query, "i")
          return regex.test(haystack)
        } catch {
          // Invalid regex, fall back to plain text
          return haystack.toLowerCase().includes(query.toLowerCase())
        }
      } else {
        return haystack.toLowerCase().includes(query.toLowerCase())
      }
    })
  }, [actions, riskFilter, statusFilter, debouncedSearch, regexMode, dateFrom, dateTo])

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
  const statusFilters: FilterStatus[] = ["ALL", "PENDING", "AUTO_APPROVED", "APPROVED", "BLOCKED", "AUTH_REQUIRED"]

  // Export handlers
  const handleExportJSON = useCallback(() => {
    try {
      exportToJSON(filtered, 'agent-lock-activity')
      showToast({
        type: 'success',
        title: 'Exported to JSON',
        message: `${filtered.length} items exported`,
        duration: 3000,
      })
    } catch (error) {
      showToast({
        type: 'error',
        title: 'Export failed',
        message: String(error),
        duration: 3000,
      })
    }
  }, [filtered, showToast])

  const handleExportCSV = useCallback(() => {
    try {
      exportToCSV(filtered, 'agent-lock-activity')
      showToast({
        type: 'success',
        title: 'Exported to CSV',
        message: `${filtered.length} items exported`,
        duration: 3000,
      })
    } catch (error) {
      showToast({
        type: 'error',
        title: 'Export failed',
        message: String(error),
        duration: 3000,
      })
    }
  }, [filtered, showToast])

  const clearFilters = useCallback(() => {
    setRiskFilter("ALL")
    setStatusFilter("ALL")
    setSearch("")
    setDateFrom("")
    setDateTo("")
    setRegexMode(false)
    showToast({
      type: 'info',
      title: 'Filters cleared',
      duration: 2000,
    })
  }, [showToast])

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-[var(--text-primary)]">Activity Intelligence</h1>
          <p className="text-sm text-[var(--text-secondary)] mt-1">
            Tool timing and MCP server separation
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button onClick={load} variant="secondary" size="sm">
            Refresh
          </Button>
          <Badge variant="neutral">
            {filtered.length} visible
          </Badge>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <p className="text-xs text-[var(--text-tertiary)] uppercase tracking-wider">With Timing</p>
            <p className="text-3xl font-semibold text-[var(--text-primary)] mt-1">{timingSummary.measured}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-xs text-[var(--text-tertiary)] uppercase tracking-wider">Avg Gateway</p>
            <p className="text-3xl font-semibold text-[var(--accent-primary)] mt-1">
              {timingSummary.avgGateway !== null ? `${timingSummary.avgGateway.toFixed(1)} ms` : "N/A"}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-xs text-[var(--text-tertiary)] uppercase tracking-wider">Avg Overhead</p>
            <p className="text-3xl font-semibold text-[var(--warning)] mt-1">
              {timingSummary.avgOverhead !== null ? `${timingSummary.avgOverhead.toFixed(1)} ms` : "N/A"}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-xs text-[var(--text-tertiary)] uppercase tracking-wider">MCP Connected</p>
            <p className="text-3xl font-semibold text-[var(--success)] mt-1">{connectedServers.length}</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="space-y-4">
          {/* Search bar with regex toggle */}
          <div className="flex flex-col lg:flex-row gap-3">
            <div className="flex-1 flex gap-2">
              <input
                type="text"
                placeholder={regexMode ? "Regex search (e.g., tool_.*delete)" : "Search by tool, server, analysis, or args"}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="flex-1 input"
              />
              <button
                onClick={() => setRegexMode(!regexMode)}
                className={`px-3 py-2 rounded-md text-xs font-mono transition-colors ${
                  regexMode
                    ? 'bg-[var(--accent-primary)] text-white'
                    : 'bg-[var(--bg-tertiary)] text-[var(--text-secondary)]'
                }`}
                title="Toggle regex mode"
              >
                .*
              </button>
            </div>
            
            {/* Export buttons */}
            <div className="flex flex-wrap gap-2">
              <Button
                onClick={handleExportJSON}
                disabled={filtered.length === 0}
                variant="secondary"
                size="sm"
              >
                📥 JSON
              </Button>
              <Button
                onClick={handleExportCSV}
                disabled={filtered.length === 0}
                variant="secondary"
                size="sm"
              >
                📊 CSV
              </Button>
              <Button
                onClick={clearFilters}
                variant="ghost"
                size="sm"
              >
                Clear
              </Button>
            </div>
          </div>

          {/* Date range picker */}
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span className="text-[var(--text-tertiary)] text-xs">Date range:</span>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="input text-xs"
              placeholder="From"
            />
            <span className="text-[var(--text-tertiary)]">→</span>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="input text-xs"
              placeholder="To"
            />
            {filtered.length !== actions.length && (
              <span className="text-[var(--text-tertiary)] text-xs sm:ml-auto">
                {filtered.length} of {actions.length} items
              </span>
            )}
          </div>

          {/* Risk filters */}
          <div className="flex flex-wrap gap-2">
            <span className="text-[var(--text-tertiary)] text-xs mr-2">Risk:</span>
            {riskFilters.map((r) => (
              <button
                key={r}
                onClick={() => setRiskFilter(r)}
                className={`px-3 py-1 rounded-md text-xs transition-all ${
                  riskFilter === r 
                    ? "bg-[var(--accent-primary)] text-white" 
                    : "bg-[var(--bg-tertiary)] text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]"
                }`}
              >
                {r}
              </button>
            ))}
          </div>
          
          {/* Status filters */}
          <div className="flex flex-wrap gap-2">
            <span className="text-[var(--text-tertiary)] text-xs mr-2">Status:</span>
            {statusFilters.map((s) => (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={`px-3 py-1 rounded-md text-xs transition-all ${
                  statusFilter === s 
                    ? "bg-[var(--accent-primary)] text-white" 
                    : "bg-[var(--bg-tertiary)] text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]"
                }`}
              >
                {s}
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Tool Duration Table */}
      <Card>
        <CardHeader
          title="Duration by Tool"
          subtitle="Ordered by highest avg latency"
        />
        <CardContent className="p-0">
          {loading ? (
            <div className="px-6 py-8 text-sm text-[var(--text-tertiary)]">Loading...</div>
          ) : error ? (
            <div className="px-6 py-8 text-sm text-[var(--error)]">{error}</div>
          ) : toolDurationRows.length === 0 ? (
            <Table>
              <TableBody>
                <TableEmpty colSpan={4} message="No timing data available yet" />
              </TableBody>
            </Table>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tool</TableHead>
                  <TableHead>Avg Gateway</TableHead>
                  <TableHead>Samples</TableHead>
                  <TableHead>MCP Servers</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {toolDurationRows.map((row) => (
                  <TableRow key={row.tool}>
                    <TableCell className="font-mono">{row.tool}</TableCell>
                    <TableCell className="text-[var(--accent-primary)] font-mono">{row.avgMs.toFixed(1)} ms</TableCell>
                    <TableCell>{row.count}</TableCell>
                    <TableCell>{row.servers.length ? row.servers.join(", ") : "N/A"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Activity by MCP Server */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-[var(--text-primary)]">Activity by Connected MCP</h2>
          <span className="text-xs text-[var(--text-tertiary)]">Source: Dashboard + MCP heartbeat</span>
        </div>

        {connectedServers.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center text-sm text-[var(--text-tertiary)]">
              No MCP servers connected at this moment
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
            {groupedByConnectedServer.map((group) => (
              <Card key={group.serverName}>
                <CardHeader
                  title={group.serverName}
                  subtitle={`${group.count} actions`}
                  action={
                    <Badge variant="neutral">
                      avg {group.avgMs !== null ? `${group.avgMs.toFixed(1)} ms` : "N/A"}
                    </Badge>
                  }
                />

                <CardContent className="p-0">
                  {group.items.length === 0 ? (
                    <div className="px-6 py-8 text-sm text-[var(--text-tertiary)] text-center">
                      No events for this MCP with current filters
                    </div>
                  ) : (
                    <div className="divide-y divide-[var(--border-color)]">
                      {group.items.map((action) => (
                        <Link
                          key={action.action_id}
                          href={`/activity/${action.action_id}`}
                          className="block px-4 py-3 hover:bg-[var(--bg-hover)] transition-colors"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <p className="text-sm font-mono text-[var(--text-primary)]">{action.tool_name}</p>
                              <p className="text-xs text-[var(--text-tertiary)] mt-0.5">
                                {new Date(action.timestamp).toLocaleString()}
                              </p>
                            </div>
                            <div className="text-right">
                              <p className="text-xs text-[var(--accent-primary)] font-mono">
                                {toMs(action.execution?.timings_ms?.total_gateway_ms) !== null
                                  ? `${toMs(action.execution?.timings_ms?.total_gateway_ms)!.toFixed(1)} ms`
                                  : "N/A"}
                              </p>
                              <Badge variant="neutral" className="mt-1">
                                {action.decision}
                              </Badge>
                            </div>
                          </div>
                        </Link>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
