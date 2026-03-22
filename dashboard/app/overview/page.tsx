"use client"

import { useEffect, useState, useCallback } from "react"
import { fetchStats, fetchActivity, fetchHealth } from "@/lib/api"
import { Stats, Action } from "@/types"
import StatCard from "../components/StatCard"
import { RiskBadge, StatusBadge } from "../components/Badge"
import ScoreBar from "../components/ScoreBar"

function Skeleton({ className }: { className?: string }) {
  return (
    <div className={`animate-pulse bg-slate-700/40 rounded-lg ${className ?? ""}`} />
  )
}

export default function OverviewPage() {
  const [stats, setStats] = useState<Stats | null>(null)
  const [activity, setActivity] = useState<Action[]>([])
  const [backendOk, setBackendOk] = useState<boolean | null>(null)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)
  const [statsError, setStatsError] = useState(false)
  const [activityError, setActivityError] = useState(false)
  const [loading, setLoading] = useState(true)

  const loadStats = useCallback(async () => {
    try {
      const data = await fetchStats()
      setStats(data)
      setStatsError(false)
    } catch {
      setStatsError(true)
    }
  }, [])

  const loadActivity = useCallback(async () => {
    try {
      const data = await fetchActivity(20)
      if (Array.isArray(data)) {
        setActivity(data)
        setActivityError(false)
      }
    } catch {
      setActivityError(true)
    }
  }, [])

  const checkHealth = useCallback(async () => {
    try {
      await fetchHealth()
      setBackendOk(true)
    } catch {
      setBackendOk(false)
    }
  }, [])

  const loadAll = useCallback(async () => {
    await Promise.all([loadStats(), loadActivity(), checkHealth()])
    setLastUpdated(new Date())
    setLoading(false)
  }, [loadStats, loadActivity, checkHealth])

  useEffect(() => {
    loadAll()

    const statsInterval = setInterval(() => {
      loadStats()
      checkHealth()
      setLastUpdated(new Date())
    }, 5000)

    const activityInterval = setInterval(() => {
      loadActivity()
    }, 3000)

    return () => {
      clearInterval(statsInterval)
      clearInterval(activityInterval)
    }
  }, [loadAll, loadStats, loadActivity, checkHealth])

  const total = stats?.total ?? 0
  const riskBreakdown = stats?.risk_breakdown ?? { LOW: 0, HIGH: 0, CRITICAL: 0 }

  function getRiskPct(count: number) {
    if (!total) return 0
    return Math.round((count / total) * 100)
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Overview</h1>
          <p className="text-slate-500 text-sm mt-0.5">
            Real-time security monitoring dashboard
          </p>
        </div>

        <div className="flex items-center gap-4">
          {/* Backend status */}
          <div className="flex items-center gap-2 bg-brand-card border border-brand-border rounded-lg px-3 py-2">
            <div
              className={`w-2 h-2 rounded-full ${
                backendOk === null
                  ? "bg-slate-500"
                  : backendOk
                  ? "bg-emerald-500 animate-pulse"
                  : "bg-red-500 animate-pulse"
              }`}
            />
            <span className="text-xs text-slate-400">
              {backendOk === null
                ? "Checking..."
                : backendOk
                ? "Backend Online"
                : "Backend Offline"}
            </span>
          </div>

          {lastUpdated && (
            <span className="text-xs text-slate-600">
              Updated {lastUpdated.toLocaleTimeString()}
            </span>
          )}

          <button
            onClick={loadAll}
            className="text-xs text-indigo-400 hover:text-indigo-300 bg-brand-card border border-brand-border rounded-lg px-3 py-2 transition-colors"
          >
            ↻ Refresh
          </button>
        </div>
      </div>

      {/* Stat Cards */}
      {loading ? (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-36" />
          ))}
        </div>
      ) : statsError ? (
        <div className="bg-red-900/20 border border-red-700/40 rounded-xl px-5 py-4 text-red-300 text-sm flex items-center gap-3">
          <span className="text-xl">⚠️</span>
          <div>
            <p className="font-semibold">Error loading statistics</p>
            <p className="text-red-400 text-xs mt-0.5">
              Make sure the backend is running at http://localhost:8000
            </p>
          </div>
          <button
            onClick={loadStats}
            className="ml-auto text-xs bg-red-800/40 hover:bg-red-700/40 border border-red-700/40 rounded-lg px-3 py-1.5 transition-colors"
          >
            Retry
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
          <StatCard
            label="Total Intercepted"
            value={stats?.total ?? 0}
            color="indigo"
            icon="🛡️"
          />
          <StatCard
            label="Auto-Approved"
            value={stats?.auto_approved ?? 0}
            color="blue"
            icon="✅"
          />
          <StatCard
            label="Human Approved"
            value={stats?.human_approved ?? 0}
            color="emerald"
            icon="🛡️"
          />
          <StatCard
            label="Blocked"
            value={stats?.blocked ?? 0}
            color="red"
            icon="🚫"
          />
          <StatCard
            label="Pending"
            value={stats?.pending ?? 0}
            color="amber"
            icon="⏳"
          />
        </div>
      )}

      {/* Bottom row: Risk breakdown + Signature Failures */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Risk Breakdown */}
        <div className="lg:col-span-2 bg-brand-card border border-brand-border rounded-xl p-5">
          <h2 className="text-base font-semibold text-slate-200 mb-5">Risk Breakdown</h2>

          {loading ? (
            <div className="space-y-4">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-8" />
              ))}
            </div>
          ) : (
            <div className="space-y-4">
              {/* LOW */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block" />
                    <span className="text-slate-300 font-medium">LOW</span>
                  </div>
                  <div className="flex items-center gap-3 text-slate-400">
                    <span className="font-mono">{riskBreakdown.LOW}</span>
                    <span className="text-slate-600 text-xs w-10 text-right">
                      {getRiskPct(riskBreakdown.LOW)}%
                    </span>
                  </div>
                </div>
                <div className="h-2.5 bg-slate-700/50 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-emerald-500 rounded-full transition-all duration-700"
                    style={{ width: `${getRiskPct(riskBreakdown.LOW)}%` }}
                  />
                </div>
              </div>

              {/* HIGH */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-amber-500 inline-block" />
                    <span className="text-slate-300 font-medium">HIGH</span>
                  </div>
                  <div className="flex items-center gap-3 text-slate-400">
                    <span className="font-mono">{riskBreakdown.HIGH}</span>
                    <span className="text-slate-600 text-xs w-10 text-right">
                      {getRiskPct(riskBreakdown.HIGH)}%
                    </span>
                  </div>
                </div>
                <div className="h-2.5 bg-slate-700/50 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-amber-500 rounded-full transition-all duration-700"
                    style={{ width: `${getRiskPct(riskBreakdown.HIGH)}%` }}
                  />
                </div>
              </div>

              {/* CRITICAL */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-red-500 inline-block" />
                    <span className="text-slate-300 font-medium">CRITICAL</span>
                  </div>
                  <div className="flex items-center gap-3 text-slate-400">
                    <span className="font-mono">{riskBreakdown.CRITICAL}</span>
                    <span className="text-slate-600 text-xs w-10 text-right">
                      {getRiskPct(riskBreakdown.CRITICAL)}%
                    </span>
                  </div>
                </div>
                <div className="h-2.5 bg-slate-700/50 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-red-500 rounded-full transition-all duration-700"
                    style={{ width: `${getRiskPct(riskBreakdown.CRITICAL)}%` }}
                  />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Signature Failures + Quick stats */}
        <div className="space-y-4">
          <div className="bg-brand-card border border-brand-border rounded-xl p-5">
            <h2 className="text-base font-semibold text-slate-200 mb-3">
              Signature Failures
            </h2>
            {loading ? (
              <Skeleton className="h-12" />
            ) : (
              <div className="flex items-end gap-2">
                <span className="text-4xl font-bold text-red-400 tabular-nums">
                  {stats?.signature_failures ?? 0}
                </span>
                <span className="text-slate-500 text-sm mb-1">failures</span>
              </div>
            )}
            <p className="text-xs text-slate-600 mt-2">
              Requests with invalid HMAC signatures — possible tampering
            </p>
          </div>

          <div className="bg-brand-card border border-brand-border rounded-xl p-5">
            <h2 className="text-sm font-semibold text-slate-400 mb-3">Approval Rate</h2>
            {loading || !stats ? (
              <Skeleton className="h-10" />
            ) : (
              <>
                <p className="text-3xl font-bold text-white">
                  {stats.total > 0
                    ? Math.round(
                        ((stats.auto_approved + stats.human_approved) / stats.total) * 100
                      )
                    : 0}
                  <span className="text-xl text-slate-500">%</span>
                </p>
                <p className="text-xs text-slate-600 mt-1">of intercepted actions approved</p>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Live Activity Feed */}
      <div className="bg-brand-card border border-brand-border rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-brand-border flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h2 className="text-base font-semibold text-slate-200">Live Activity Feed</h2>
            <span className="flex items-center gap-1 text-xs text-emerald-400">
              <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse inline-block" />
              Live
            </span>
          </div>
          <span className="text-xs text-slate-600">Polling every 3s · Last 20 actions</span>
        </div>

        {activityError ? (
          <div className="px-5 py-8 text-center">
            <p className="text-red-400 text-sm">⚠️ Error loading activity</p>
            <button
              onClick={loadActivity}
              className="mt-2 text-xs text-indigo-400 hover:text-indigo-300 underline"
            >
              Retry
            </button>
          </div>
        ) : loading ? (
          <div className="divide-y divide-brand-border">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="px-5 py-3 flex items-center gap-4">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-4 w-16" />
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-4 flex-1" />
              </div>
            ))}
          </div>
        ) : activity.length === 0 ? (
          <div className="px-5 py-12 text-center">
            <p className="text-slate-500 text-3xl mb-2">🛡️</p>
            <p className="text-slate-400 font-medium">No activity yet</p>
            <p className="text-slate-600 text-sm mt-1">
              Tool calls will appear here once AI agents start interacting
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-slate-500 uppercase tracking-wider border-b border-brand-border bg-brand-bg/50">
                  <th className="px-4 py-2.5 text-left">Time</th>
                  <th className="px-4 py-2.5 text-left">Tool</th>
                  <th className="px-4 py-2.5 text-left">Risk</th>
                  <th className="px-4 py-2.5 text-left">Status</th>
                  <th className="px-4 py-2.5 text-left">Score</th>
                  <th className="px-4 py-2.5 text-left">Agent</th>
                  <th className="px-4 py-2.5 text-left">Analysis</th>
                </tr>
              </thead>
              <tbody>
                {activity.map((action, i) => (
                  <tr
                    key={action.action_id}
                    className={`
                      border-b border-brand-border last:border-0
                      ${i % 2 === 0 ? "bg-brand-card" : "bg-brand-bg/30"}
                      hover:bg-indigo-900/10 transition-colors
                    `}
                  >
                    <td className="px-4 py-3 text-xs text-slate-400 font-mono whitespace-nowrap">
                      {new Date(action.timestamp).toLocaleString()}
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-sm font-semibold text-slate-100 font-mono">
                        {action.tool_name}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <RiskBadge level={action.risk_level} />
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={action.decision} />
                    </td>
                    <td className="px-4 py-3 min-w-[110px]">
                      <ScoreBar score={action.intent_score} compact />
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-500 font-mono">
                      {action.agent_id ?? "—"}
                    </td>
                    <td className="px-4 py-3 max-w-[260px]">
                      <p
                        className="text-xs text-slate-400 truncate"
                        title={action.analysis}
                      >
                        {action.analysis || "—"}
                      </p>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
