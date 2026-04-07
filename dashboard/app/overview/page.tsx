"use client"

import { useEffect, useState, useCallback } from "react"
import { fetchStats, fetchActivity, fetchHealth, fetchTrends } from "@/lib/api"
import { Stats, Action } from "@/types"
import { Card, CardHeader, Badge, Table, TableHeader, TableBody, TableRow, TableHead, TableCell, TableEmpty, Button } from "../components/ui"
import Sidebar from "../components/Sidebar"

function StatCard({ label, value, trend, icon }: { label: string; value: number; trend?: string; icon: React.ReactNode }) {
  return (
    <Card padding="md">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm" style={{ color: 'var(--text-tertiary)' }}>{label}</p>
          <p className="text-2xl font-semibold mt-1" style={{ color: 'var(--text-primary)' }}>{value.toLocaleString()}</p>
          {trend && <p className="text-xs mt-1" style={{ color: 'var(--success)' }}>{trend}</p>}
        </div>
        <div className="p-2 rounded-md" style={{ background: 'var(--bg-tertiary)', color: 'var(--text-tertiary)' }}>
          {icon}
        </div>
      </div>
    </Card>
  )
}

function RiskBadge({ level }: { level: string }) {
  const variants: Record<string, 'success' | 'warning' | 'danger'> = {
    LOW: 'success',
    HIGH: 'warning', 
    CRITICAL: 'danger'
  }
  return <Badge variant={variants[level] || 'neutral'} size="sm">{level}</Badge>
}

function StatusBadge({ status }: { status: string }) {
  const variants: Record<string, 'success' | 'warning' | 'danger' | 'neutral'> = {
    AUTO_APPROVED: 'success',
    APPROVED: 'success',
    BLOCKED: 'danger',
    PENDING: 'warning',
    AUTH_REQUIRED: 'neutral',
    TIMEOUT: 'neutral'
  }
  const labels: Record<string, string> = {
    AUTO_APPROVED: 'Auto',
    APPROVED: 'Approved',
    BLOCKED: 'Blocked',
    PENDING: 'Pending',
    AUTH_REQUIRED: 'Auth Required',
    TIMEOUT: 'Timeout'
  }
  return <Badge variant={variants[status] || 'neutral'} size="sm">{labels[status] || status}</Badge>
}

function ProgressBar({ value, max, color }: { value: number; max: number; color: string }) {
  const pct = max > 0 ? (value / max) * 100 : 0
  return (
    <div className="h-2 rounded-full overflow-hidden" style={{ background: 'var(--bg-tertiary)' }}>
      <div 
        className="h-full rounded-full transition-all duration-500" 
        style={{ width: `${pct}%`, background: color }}
      />
    </div>
  )
}

export default function OverviewPage() {
  const [stats, setStats] = useState<Stats | null>(null)
  const [activity, setActivity] = useState<Action[]>([])
  const [backendOk, setBackendOk] = useState<boolean | null>(null)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  const loadAll = useCallback(async (forceRefresh = false) => {
    try {
      const [statsData, activityData] = await Promise.all([
        fetchStats({ refresh: forceRefresh }),
        fetchActivity(15, { refresh: forceRefresh })
      ])
      setStats(statsData as Stats)
      if (Array.isArray(activityData)) setActivity(activityData)
      setError(false)
    } catch {
      setError(true)
    }
    setLastUpdated(new Date())
    setLoading(false)
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
    const sync = async () => {
      await loadAll(false)
      await checkHealth()
    }

    void sync()

    const interval = setInterval(() => {
      void sync()
    }, 5000)

    return () => clearInterval(interval)
  }, [loadAll, checkHealth])

  const total = stats?.total ?? 0
  const riskBreakdown = stats?.risk_breakdown ?? { LOW: 0, HIGH: 0, CRITICAL: 0 }
  const approvalRate = total > 0 
    ? Math.round(((stats?.auto_approved ?? 0) + (stats?.human_approved ?? 0)) / total * 100) 
    : 0

  return (
    <>
      <Sidebar />
      <main className="min-h-screen transition-all duration-200 md:ml-[15.4rem]">
        <div className="app-shell-container mx-auto max-w-screen-xl animate-fade-in px-4 pb-6 pt-16 md:p-6">
          <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="page-title">Dashboard</h1>
          <p className="page-subtitle max-w-2xl">Operational snapshot for approvals, risk, and gateway activity</p>
        </div>
        <div className="flex flex-wrap items-center gap-2 self-start md:self-auto">
          {/* Status indicator */}
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-md" style={{ background: 'var(--bg-tertiary)' }}>
            <span className={`status-dot ${backendOk ? 'status-dot-success status-pulse' : backendOk === false ? 'status-dot-danger' : 'status-dot-neutral'}`} />
            <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>
              {backendOk === null ? 'Connecting...' : backendOk ? 'Online' : 'Offline'}
            </span>
          </div>
          {lastUpdated && (
            <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
              {lastUpdated.toLocaleTimeString()}
            </span>
          )}
          <Button variant="secondary" size="sm" onClick={() => loadAll(true)}>
            Refresh
          </Button>
        </div>
      </div>

      {/* Stats Grid */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-4">
          {[...Array(5)].map((_, i) => (
            <Card key={i} padding="md">
              <div className="animate-pulse space-y-3">
                <div className="h-4 rounded" style={{ background: 'var(--bg-tertiary)', width: '60%' }} />
                <div className="h-8 rounded" style={{ background: 'var(--bg-tertiary)', width: '40%' }} />
              </div>
            </Card>
          ))}
        </div>
      ) : error ? (
        <Card padding="lg">
          <div className="text-center py-8">
            <p className="text-lg font-medium" style={{ color: 'var(--danger)' }}>Failed to load data</p>
            <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>Make sure the backend is running</p>
            <Button variant="secondary" className="mt-4" onClick={() => { void loadAll(true) }}>Retry</Button>
          </div>
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-4">
          <StatCard 
            label="Total Intercepted" 
            value={stats?.total ?? 0}
            icon={<svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M10 2l7 4v6c0 4-3.5 6-7 7-3.5-1-7-3-7-7V6l7-4z"/></svg>}
          />
          <StatCard 
            label="Auto-Approved" 
            value={stats?.auto_approved ?? 0}
            icon={<svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M6 10l3 3 5-6" strokeLinecap="round" strokeLinejoin="round"/></svg>}
          />
          <StatCard 
            label="Human Approved" 
            value={stats?.human_approved ?? 0}
            icon={<svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="10" cy="7" r="3"/><path d="M4 17v-1a4 4 0 014-4h4a4 4 0 014 4v1"/></svg>}
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
      )}

      {/* Middle Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-6">
        {/* Risk Breakdown */}
        <Card className="lg:col-span-2">
          <CardHeader title="Risk Distribution" subtitle={`${total} total actions`} />
          <div className="space-y-4 mt-2">
            {[
              { label: 'Low Risk', count: riskBreakdown.LOW, color: 'var(--success)' },
              { label: 'High Risk', count: riskBreakdown.HIGH, color: 'var(--warning)' },
              { label: 'Critical', count: riskBreakdown.CRITICAL, color: 'var(--danger)' },
            ].map(item => (
              <div key={item.label}>
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-2">
                    <span className="status-dot" style={{ background: item.color }} />
                    <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>{item.label}</span>
                  </div>
                  <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{item.count}</span>
                </div>
                <ProgressBar value={item.count} max={total || 1} color={item.color} />
              </div>
            ))}
          </div>
        </Card>

        {/* Quick Stats */}
        <div className="space-y-4">
          <Card>
            <div className="flex items-center justify-between">
              <span className="text-sm" style={{ color: 'var(--text-tertiary)' }}>Approval Rate</span>
              <span className="text-2xl font-semibold" style={{ color: 'var(--text-primary)' }}>{approvalRate}%</span>
            </div>
            <div className="mt-3">
              <ProgressBar value={approvalRate} max={100} color="var(--success)" />
            </div>
          </Card>
          <Card>
            <div className="flex items-center justify-between">
              <span className="text-sm" style={{ color: 'var(--text-tertiary)' }}>Signature Failures</span>
              <span className="text-2xl font-semibold" style={{ color: stats?.signature_failures ? 'var(--danger)' : 'var(--text-primary)' }}>
                {stats?.signature_failures ?? 0}
              </span>
            </div>
            <p className="text-xs mt-2" style={{ color: 'var(--text-muted)' }}>
              Invalid HMAC signatures detected
            </p>
          </Card>
        </div>
      </div>

      {/* Activity Table */}
      <Card padding="none">
        <div className="px-4 py-3 flex items-center justify-between" style={{ borderBottom: '1px solid var(--border-primary)' }}>
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Recent Activity</h3>
            <span className="status-dot status-dot-success status-pulse" />
            <span className="text-xs" style={{ color: 'var(--text-muted)' }}>Live</span>
          </div>
          <span className="text-xs" style={{ color: 'var(--text-muted)' }}>Last 15 actions</span>
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Time</TableHead>
              <TableHead>Tool</TableHead>
              <TableHead>Risk</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Agent</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              [...Array(5)].map((_, i) => (
                <TableRow key={i}>
                  {[...Array(5)].map((_, j) => (
                    <TableCell key={j}>
                      <div className="animate-pulse h-4 rounded" style={{ background: 'var(--bg-tertiary)', width: '80%' }} />
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : activity.length === 0 ? (
              <TableEmpty colSpan={5} message="No activity yet. Tool calls will appear here." />
            ) : (
              activity.map((action) => (
                <TableRow key={action.action_id}>
                  <TableCell>
                    <span className="text-xs font-mono" style={{ color: 'var(--text-muted)' }}>
                      {new Date(action.timestamp).toLocaleTimeString()}
                    </span>
                  </TableCell>
                  <TableCell>
                    <span className="font-medium font-mono" style={{ color: 'var(--text-primary)' }}>
                      {action.tool_name}
                    </span>
                  </TableCell>
                  <TableCell><RiskBadge level={action.risk_level} /></TableCell>
                  <TableCell><StatusBadge status={action.decision} /></TableCell>
                  <TableCell>
                    <span className="text-xs font-mono" style={{ color: 'var(--text-muted)' }}>
                      {action.agent_id ?? '—'}
                    </span>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>
          </div>
        </div>
      </main>
    </>
  )
}
