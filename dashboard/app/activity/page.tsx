"use client"

import { useEffect, useState, useCallback } from "react"
import { fetchActivity } from "@/lib/api"
import { Action, RiskLevel, ActionStatus } from "@/types"
import ActionRow from "../components/ActionRow"

type FilterRisk = "ALL" | RiskLevel
type FilterStatus = "ALL" | ActionStatus

const riskFilters: FilterRisk[] = ["ALL", "LOW", "HIGH", "CRITICAL"]
const statusFilters: FilterStatus[] = ["ALL", "PENDING", "AUTO_APPROVED", "APPROVED", "BLOCKED"]

function Skeleton({ className }: { className?: string }) {
  return <div className={`animate-pulse bg-slate-700/40 rounded-lg ${className ?? ""}`} />
}

export default function ActivityPage() {
  const [actions, setActions] = useState<Action[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [riskFilter, setRiskFilter] = useState<FilterRisk>("ALL")
  const [statusFilter, setStatusFilter] = useState<FilterStatus>("ALL")
  const [search, setSearch] = useState("")

  const loadActivity = useCallback(async () => {
    try {
      const data = await fetchActivity(50)
      if (Array.isArray(data)) {
        setActions(data)
        setError(false)
      }
    } catch {
      setError(true)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadActivity()
    const interval = setInterval(loadActivity, 5000)
    return () => clearInterval(interval)
  }, [loadActivity])

  const filtered = actions.filter((a) => {
    if (riskFilter !== "ALL" && a.risk_level !== riskFilter) return false
    if (statusFilter !== "ALL" && a.decision !== statusFilter) return false
    if (search.trim()) {
      const q = search.toLowerCase()
      return (
        a.tool_name.toLowerCase().includes(q) ||
        a.analysis?.toLowerCase().includes(q) ||
        a.user_intent?.toLowerCase().includes(q) ||
        a.agent_id?.toLowerCase().includes(q) ||
        false
      )
    }
    return true
  })

  const riskButtonColor: Record<FilterRisk, string> = {
    ALL: "bg-slate-700 text-slate-200 border-slate-600",
    LOW: "bg-emerald-900/60 text-emerald-300 border-emerald-700/60",
    HIGH: "bg-amber-900/60 text-amber-300 border-amber-700/60",
    CRITICAL: "bg-red-900/60 text-red-300 border-red-700/60",
  }

  const statusButtonColor: Record<FilterStatus, string> = {
    ALL: "bg-slate-700 text-slate-200 border-slate-600",
    PENDING: "bg-amber-900/60 text-amber-300 border-amber-700/60",
    AUTO_APPROVED: "bg-blue-900/60 text-blue-300 border-blue-700/60",
    APPROVED: "bg-emerald-900/60 text-emerald-300 border-emerald-700/60",
    BLOCKED: "bg-red-900/60 text-red-300 border-red-700/60",
  }

  const inactiveClass =
    "bg-brand-card text-slate-500 border-brand-border hover:text-slate-300 hover:border-slate-600"

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Activity</h1>
          <p className="text-slate-500 text-sm mt-0.5">
            All intercepted tool calls — polling every 5s
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-slate-600 font-mono">
            {filtered.length} / {actions.length} actions
          </span>
          <button
            onClick={loadActivity}
            className="text-xs text-indigo-400 hover:text-indigo-300 bg-brand-card border border-brand-border rounded-lg px-3 py-2 transition-colors"
          >
            ↻ Refresh
          </button>
        </div>
      </div>

      {/* Filter bar */}
      <div className="bg-brand-card border border-brand-border rounded-xl p-4 space-y-3">
        {/* Search */}
        <input
          type="text"
          placeholder="Search by tool, analysis, agent..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full bg-brand-bg border border-brand-border rounded-lg px-3 py-2 text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-indigo-600 transition-colors"
        />

        {/* Risk filters */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-slate-600 uppercase tracking-wider mr-1">Risk:</span>
          {riskFilters.map((r) => (
            <button
              key={r}
              onClick={() => setRiskFilter(r)}
              className={`
                text-xs font-semibold px-2.5 py-1 rounded-full border transition-all
                ${riskFilter === r ? riskButtonColor[r] : inactiveClass}
              `}
            >
              {r}
            </button>
          ))}
        </div>

        {/* Status filters */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-slate-600 uppercase tracking-wider mr-1">Status:</span>
          {statusFilters.map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`
                text-xs font-semibold px-2.5 py-1 rounded-full border transition-all
                ${statusFilter === s ? statusButtonColor[s] : inactiveClass}
              `}
            >
              {s === "AUTO_APPROVED" ? "AUTO" : s}
            </button>
          ))}
        </div>

        {/* Active filters summary */}
        {(riskFilter !== "ALL" || statusFilter !== "ALL" || search) && (
          <div className="flex items-center gap-2 pt-1">
            <span className="text-xs text-slate-600">Active filters:</span>
            {riskFilter !== "ALL" && (
              <span className="text-xs bg-indigo-900/40 text-indigo-300 border border-indigo-700/40 rounded-full px-2 py-0.5">
                Risk: {riskFilter}
              </span>
            )}
            {statusFilter !== "ALL" && (
              <span className="text-xs bg-indigo-900/40 text-indigo-300 border border-indigo-700/40 rounded-full px-2 py-0.5">
                Status: {statusFilter}
              </span>
            )}
            {search && (
              <span className="text-xs bg-indigo-900/40 text-indigo-300 border border-indigo-700/40 rounded-full px-2 py-0.5">
                Search: &ldquo;{search}&rdquo;
              </span>
            )}
            <button
              onClick={() => {
                setRiskFilter("ALL")
                setStatusFilter("ALL")
                setSearch("")
              }}
              className="text-xs text-slate-500 hover:text-slate-300 underline ml-1"
            >
              Clear all
            </button>
          </div>
        )}
      </div>

      {/* Table */}
      <div className="bg-brand-card border border-brand-border rounded-xl overflow-hidden">
        {error ? (
          <div className="px-5 py-12 text-center">
            <p className="text-red-400 text-sm font-medium">⚠️ Error loading activity</p>
            <p className="text-slate-600 text-xs mt-1">
              Make sure the backend is running at http://localhost:8000
            </p>
            <button
              onClick={loadActivity}
              className="mt-3 text-xs text-indigo-400 hover:text-indigo-300 bg-brand-bg border border-brand-border rounded-lg px-4 py-2 transition-colors"
            >
              Retry
            </button>
          </div>
        ) : loading ? (
          <div className="divide-y divide-brand-border">
            <div className="px-4 py-2.5 flex gap-4 bg-brand-bg/50">
              {["w-28", "w-32", "w-16", "w-24", "w-24", "w-20", "flex-1"].map((w, i) => (
                <Skeleton key={i} className={`h-3 ${w}`} />
              ))}
            </div>
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="px-4 py-3 flex gap-4">
                {["w-28", "w-32", "w-16", "w-24", "w-24", "w-20", "flex-1"].map((w, j) => (
                  <Skeleton key={j} className={`h-4 ${w}`} />
                ))}
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="px-5 py-16 text-center">
            <p className="text-4xl mb-3">🔍</p>
            <p className="text-slate-400 font-medium">No activity yet</p>
            <p className="text-slate-600 text-sm mt-1">
              {actions.length > 0
                ? "No actions match your current filters"
                : "Tool calls will appear here once AI agents start interacting"}
            </p>
            {actions.length > 0 && (
              <button
                onClick={() => {
                  setRiskFilter("ALL")
                  setStatusFilter("ALL")
                  setSearch("")
                }}
                className="mt-3 text-xs text-indigo-400 hover:text-indigo-300 underline"
              >
                Clear filters
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-slate-500 uppercase tracking-wider border-b border-brand-border bg-brand-bg/50">
                  <th className="px-4 py-2.5 text-left whitespace-nowrap">Time</th>
                  <th className="px-4 py-2.5 text-left">Tool</th>
                  <th className="px-4 py-2.5 text-left">Risk</th>
                  <th className="px-4 py-2.5 text-left">Status</th>
                  <th className="px-4 py-2.5 text-left">Score</th>
                  <th className="px-4 py-2.5 text-left">Agent</th>
                  <th className="px-4 py-2.5 text-left">Analysis</th>
                  <th className="px-3 py-2.5 text-left w-8"></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((action, i) => (
                  <ActionRow key={action.action_id} action={action} index={i} />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Footer note */}
      {!loading && !error && filtered.length > 0 && (
        <p className="text-xs text-slate-700 text-center">
          Click any row to expand full details · Auto-refreshes every 5s
        </p>
      )}
    </div>
  )
}
