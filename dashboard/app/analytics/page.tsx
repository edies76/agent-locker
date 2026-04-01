"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { fetchActivity, fetchStats, fetchTrends, fetchHealth } from "@/lib/api"
import { Action, Stats } from "@/types"
import { Card, CardHeader, Button, Badge } from "../components/ui"

function bucketHour(ts: string): number {
  const d = new Date(ts)
  d.setMinutes(0, 0, 0)
  return d.getHours()
}

function StatCard({ label, value, icon }: { label: string; value: number; icon: React.ReactNode }) {
  return (
    <Card padding="md">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm" style={{ color: "var(--text-tertiary)" }}>{label}</p>
          <p className="text-2xl font-semibold mt-1" style={{ color: "var(--text-primary)" }}>
            {value.toLocaleString()}
          </p>
        </div>
        <div className="p-2 rounded-md" style={{ background: "var(--bg-tertiary)", color: "var(--text-tertiary)" }}>
          {icon}
        </div>
      </div>
    </Card>
  )
}

function ProgressBar({ value, max, color }: { value: number; max: number; color: string }) {
  const pct = max > 0 ? (value / max) * 100 : 0
  return (
    <div className="h-2 rounded-full overflow-hidden" style={{ background: "var(--bg-tertiary)" }}>
      <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, background: color }} />
    </div>
  )
}

export default function AnalyticsPage() {
  const [stats, setStats] = useState<Stats | null>(null)
  const [activity, setActivity] = useState<Action[]>([])
  const [trends, setTrends] = useState<any>(null)
  const [backendOk, setBackendOk] = useState<boolean | null>(null)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      const [statsData, activityData, trendsData] = await Promise.all([
        fetchStats(),
        fetchActivity(300),
        fetchTrends(24),
      ])
      setStats(statsData as Stats)
      setActivity(Array.isArray(activityData) ? (activityData as Action[]) : [])
      setTrends(trendsData)
      setError(null)
    } catch {
      setError("No se pudo cargar analytics")
    } finally {
      setLastUpdated(new Date())
      setLoading(false)
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

  useEffect(() => {
    load()
    checkHealth()
    const interval = setInterval(() => {
      load()
      checkHealth()
    }, 10000)
    return () => clearInterval(interval)
  }, [load, checkHealth])

  const topTools = useMemo(() => {
    const map = new Map<string, number>()
    for (const a of activity) {
      map.set(a.tool_name, (map.get(a.tool_name) ?? 0) + 1)
    }
    return Array.from(map.entries())
      .map(([tool, count]) => ({ tool, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10)
  }, [activity])

  const riskOverTime = useMemo(() => {
    const byHour = new Map<number, { LOW: number; HIGH: number; CRITICAL: number }>()
    for (const a of activity) {
      const h = bucketHour(a.timestamp)
      const row = byHour.get(h) ?? { LOW: 0, HIGH: 0, CRITICAL: 0 }
      row[a.risk_level] += 1
      byHour.set(h, row)
    }
    return Array.from(byHour.entries())
      .sort((a, b) => a[0] - b[0])
      .map(([h, counts]) => ({
        hour: h,
        highCritical: counts.CRITICAL + counts.HIGH,
      }))
      .slice(-12)
  }, [activity])

  const actionsPerHour = useMemo(() => {
    const items = Array.isArray(trends?.actions_per_hour) ? trends.actions_per_hour : []
    return items
      .map((i: any) => ({
        hour: new Date(i.timestamp).getHours(),
        value: Number(i.value || 0),
      }))
      .slice(-12)
  }, [trends])

  const heatmap = useMemo(() => {
    const cells: Array<{ hour: number; count: number }> = []
    for (let hour = 0; hour < 24; hour++) {
      cells.push({
        hour,
        count: activity.filter((a) => new Date(a.timestamp).getHours() === hour).length,
      })
    }
    return cells
  }, [activity])

  const maxToolCount = topTools.length ? Math.max(...topTools.map((item: { count: number }) => item.count)) : 1
  const maxActionsPerHour = actionsPerHour.length ? Math.max(...actionsPerHour.map((item: { value: number }) => item.value)) : 1
  const maxRiskPressure = riskOverTime.length ? Math.max(...riskOverTime.map((item: { highCritical: number }) => item.highCritical)) : 1

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="page-title">Analytics</h1>
            <p className="page-subtitle">Advanced usage and risk patterns</p>
          </div>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <Card key={i} padding="md">
              <div className="animate-pulse space-y-3">
                <div className="h-4 rounded" style={{ background: "var(--bg-tertiary)", width: "60%" }} />
                <div className="h-8 rounded" style={{ background: "var(--bg-tertiary)", width: "40%" }} />
              </div>
            </Card>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="page-title">Analytics</h1>
          <p className="page-subtitle">Advanced usage and risk patterns</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-md" style={{ background: "var(--bg-tertiary)" }}>
            <span className={`status-dot ${backendOk ? "status-dot-success status-pulse" : backendOk === false ? "status-dot-danger" : "status-dot-neutral"}`} />
            <span className="text-xs" style={{ color: "var(--text-secondary)" }}>
              {backendOk === null ? "Connecting..." : backendOk ? "Online" : "Offline"}
            </span>
          </div>
          {lastUpdated && (
            <span className="text-xs" style={{ color: "var(--text-muted)" }}>
              {lastUpdated.toLocaleTimeString()}
            </span>
          )}
          <Button variant="secondary" size="sm" onClick={load}>
            Refresh
          </Button>
        </div>
      </div>

      {error && (
        <Card padding="lg">
          <div className="text-center py-4">
            <p className="text-lg font-medium" style={{ color: "var(--danger)" }}>{error}</p>
            <p className="text-sm mt-1" style={{ color: "var(--text-muted)" }}>No se pudieron cargar datos de analytics.</p>
          </div>
        </Card>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard
          label="Total Actions"
          value={stats?.total ?? 0}
          icon={<svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M4 5h12M4 10h12M4 15h12" strokeLinecap="round" /></svg>}
        />
        <StatCard
          label="Approved"
          value={(stats?.auto_approved ?? 0) + (stats?.human_approved ?? 0)}
          icon={<svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M6 10l3 3 5-6" strokeLinecap="round" strokeLinejoin="round"/></svg>}
        />
        <StatCard
          label="Blocked"
          value={stats?.blocked ?? 0}
          icon={<svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="10" cy="10" r="7"/><path d="M5 15L15 5"/></svg>}
        />
        <StatCard
          label="Pending"
          value={stats?.pending ?? 0}
          icon={<svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="10" cy="10" r="7"/><path d="M10 6v4l3 3" strokeLinecap="round"/></svg>}
        />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <Card>
          <CardHeader title="Actions per hour" subtitle="Last 12 hours" />
          {actionsPerHour.length === 0 ? (
            <p className="text-sm" style={{ color: "var(--text-muted)" }}>No hourly trend data available.</p>
          ) : (
            <div className="space-y-3">
              {actionsPerHour.map((row: { hour: number; value: number }) => (
                <div key={`h-${row.hour}`}>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs font-mono" style={{ color: "var(--text-secondary)" }}>
                      {String(row.hour).padStart(2, "0")}:00
                    </span>
                    <span className="text-xs font-semibold" style={{ color: "var(--text-primary)" }}>{row.value}</span>
                  </div>
                  <ProgressBar value={row.value} max={maxActionsPerHour || 1} color="var(--accent-primary)" />
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card>
          <CardHeader title="High/Critical pressure" subtitle="Last 12 hours" />
          {riskOverTime.length === 0 ? (
            <p className="text-sm" style={{ color: "var(--text-muted)" }}>No risk pressure data available.</p>
          ) : (
            <div className="space-y-3">
              {riskOverTime.map((row: { hour: number; highCritical: number }) => (
                <div key={`r-${row.hour}`}>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs font-mono" style={{ color: "var(--text-secondary)" }}>
                      {String(row.hour).padStart(2, "0")}:00
                    </span>
                    <Badge variant={row.highCritical > 0 ? "warning" : "neutral"} size="sm">
                      {row.highCritical}
                    </Badge>
                  </div>
                  <ProgressBar value={row.highCritical} max={maxRiskPressure || 1} color="var(--warning)" />
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <Card padding="none">
          <div className="px-4 py-3" style={{ borderBottom: "1px solid var(--border-primary)" }}>
            <h2 className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>Top tools</h2>
          </div>
          {topTools.length === 0 ? (
            <div className="px-4 py-5 text-sm" style={{ color: "var(--text-muted)" }}>
              No hay herramientas para analizar.
            </div>
          ) : (
            <div className="divide-y" style={{ borderColor: "var(--border-primary)" }}>
              {topTools.map((row: { tool: string; count: number }) => (
                <div key={row.tool} className="px-4 py-3 flex items-center justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-mono truncate" style={{ color: "var(--text-primary)" }}>{row.tool}</p>
                    <div className="mt-1.5">
                      <ProgressBar value={row.count} max={maxToolCount || 1} color="var(--accent-primary)" />
                    </div>
                  </div>
                  <span className="text-sm font-semibold" style={{ color: "var(--accent-primary)" }}>{row.count}</span>
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card padding="none">
          <div className="px-4 py-3" style={{ borderBottom: "1px solid var(--border-primary)" }}>
            <h2 className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>Peak hours heatmap</h2>
          </div>
          <div className="p-4 grid grid-cols-6 gap-2">
            {heatmap.map((c) => {
              const intensity = Math.min(c.count / 12, 1)
              return (
                <div
                  key={c.hour}
                  className="rounded-lg border p-2 text-center"
                  style={{
                    borderColor: "var(--border-primary)",
                    backgroundColor: `rgba(37, 99, 235, ${0.12 + intensity * 0.5})`,
                  }}
                  title={`${c.hour}:00 - ${c.count} actions`}
                >
                  <p className="text-xs font-semibold" style={{ color: "var(--text-primary)" }}>{c.hour}:00</p>
                  <p className="text-xs" style={{ color: "var(--text-secondary)" }}>{c.count}</p>
                </div>
              )
            })}
          </div>
        </Card>
      </div>
    </div>
  )
}
