"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { fetchActivity, fetchStats, fetchTrends } from "@/lib/api"
import { Action, Stats } from "@/types"
import TrendChart from "../components/TrendChart"
import LoadingSpinner from "../components/LoadingSpinner"
import EmptyState from "../components/EmptyState"

function bucketHour(ts: string): number {
  const d = new Date(ts)
  d.setMinutes(0, 0, 0)
  return d.getHours()
}

export default function AnalyticsPage() {
  const [stats, setStats] = useState<Stats | null>(null)
  const [activity, setActivity] = useState<Action[]>([])
  const [trends, setTrends] = useState<any>(null)
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
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

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
        timestamp: Date.now() - (23 - h) * 3600 * 1000,
        value: counts.CRITICAL + counts.HIGH,
      }))
  }, [activity])

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

  if (loading) return <LoadingSpinner size="lg" message="Loading analytics..." />

  if (error) {
    return (
      <div className="glass-panel rounded-xl border p-5 text-red-300 text-sm">
        {error}
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <section className="glass-panel rounded-2xl px-6 py-5 border">
        <p className="text-xs uppercase tracking-[0.18em] text-sky-300">Insights</p>
        <h1 className="text-2xl md:text-3xl font-semibold text-white mt-1">Analytics Dashboard</h1>
        <p className="text-sm text-slate-300/80 mt-1">
          Top tools, peak usage hours y distribucion de riesgo.
        </p>
      </section>

      <section className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="glass-panel rounded-xl border p-4">
          <p className="text-xs uppercase tracking-wider text-slate-400">Total actions</p>
          <p className="text-2xl font-semibold text-white mt-1">{stats?.total ?? 0}</p>
        </div>
        <div className="glass-panel rounded-xl border p-4">
          <p className="text-xs uppercase tracking-wider text-slate-400">Approved</p>
          <p className="text-2xl font-semibold text-emerald-300 mt-1">
            {(stats?.auto_approved ?? 0) + (stats?.human_approved ?? 0)}
          </p>
        </div>
        <div className="glass-panel rounded-xl border p-4">
          <p className="text-xs uppercase tracking-wider text-slate-400">Blocked</p>
          <p className="text-2xl font-semibold text-red-300 mt-1">{stats?.blocked ?? 0}</p>
        </div>
        <div className="glass-panel rounded-xl border p-4">
          <p className="text-xs uppercase tracking-wider text-slate-400">Pending</p>
          <p className="text-2xl font-semibold text-amber-300 mt-1">{stats?.pending ?? 0}</p>
        </div>
      </section>

      <section className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <TrendChart
          data={trends?.actions_per_hour ?? []}
          title="Actions per hour"
          color="#38bdf8"
          unit=""
        />
        <TrendChart
          data={riskOverTime}
          title="High/Critical over time"
          color="#f97316"
          unit=""
        />
      </section>

      <section className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <div className="glass-panel rounded-xl border overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-700/40">
            <h2 className="text-sm font-semibold text-slate-100">Top tools</h2>
          </div>
          {topTools.length === 0 ? (
            <EmptyState icon="📊" title="Sin datos" description="No hay herramientas para analizar." />
          ) : (
            <div className="divide-y divide-slate-700/30">
              {topTools.map((row) => (
                <div key={row.tool} className="px-4 py-3 flex items-center justify-between">
                  <span className="text-slate-100 font-mono">{row.tool}</span>
                  <span className="text-sky-300 font-semibold">{row.count}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="glass-panel rounded-xl border overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-700/40">
            <h2 className="text-sm font-semibold text-slate-100">Peak hours heatmap</h2>
          </div>
          <div className="p-4 grid grid-cols-6 gap-2">
            {heatmap.map((c) => (
              <div
                key={c.hour}
                className="rounded-lg border border-slate-700/40 p-2 text-center"
                style={{
                  backgroundColor: `rgba(56, 189, 248, ${Math.min(c.count / 12, 1) * 0.6 + 0.1})`,
                }}
                title={`${c.hour}:00 - ${c.count} actions`}
              >
                <p className="text-xs text-slate-100 font-semibold">{c.hour}:00</p>
                <p className="text-xs text-slate-200">{c.count}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  )
}
