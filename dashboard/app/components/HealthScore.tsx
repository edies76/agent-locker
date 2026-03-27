"use client"

import { calculateHealthScore, getHealthStatus, HealthMetrics } from '@/lib/chart'
import { useMemo } from 'react'

interface HealthScoreProps {
  metrics: HealthMetrics
}

export default function HealthScore({ metrics }: HealthScoreProps) {
  const score = useMemo(() => calculateHealthScore(metrics), [metrics])
  const status = useMemo(() => getHealthStatus(score), [score])

  // Calculate circumference for circular progress
  const radius = 70
  const circumference = 2 * Math.PI * radius
  const progress = (score / 100) * circumference

  return (
    <div className="bg-brand-card border border-brand-border rounded-xl p-6">
      <h2 className="text-base font-semibold text-slate-200 mb-6">System Health</h2>

      <div className="flex items-center gap-8">
        {/* Circular gauge */}
        <div className="relative">
          <svg width="160" height="160" className="transform -rotate-90">
            {/* Background circle */}
            <circle
              cx="80"
              cy="80"
              r={radius}
              fill="none"
              stroke="#1e293b"
              strokeWidth="12"
            />
            {/* Progress circle */}
            <circle
              cx="80"
              cy="80"
              r={radius}
              fill="none"
              stroke={status.bgColor.replace('bg-', '')}
              strokeWidth="12"
              strokeDasharray={circumference}
              strokeDashoffset={circumference - progress}
              strokeLinecap="round"
              className="transition-all duration-1000 ease-out"
              style={{
                stroke:
                  score >= 90
                    ? '#10b981'
                    : score >= 75
                    ? '#3b82f6'
                    : score >= 60
                    ? '#f59e0b'
                    : score >= 40
                    ? '#f97316'
                    : '#ef4444',
              }}
            />
          </svg>

          {/* Score text */}
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className={`text-5xl font-bold tabular-nums ${status.color}`}>
              {score}
            </span>
            <span className="text-sm text-slate-500 font-medium mt-1">{status.label}</span>
          </div>
        </div>

        {/* Metrics breakdown */}
        <div className="flex-1 space-y-3">
          <MetricRow
            label="Approval Rate"
            value={`${(metrics.approvalRate * 100).toFixed(1)}%`}
            status={metrics.approvalRate >= 0.8 ? 'good' : metrics.approvalRate >= 0.6 ? 'fair' : 'poor'}
          />
          <MetricRow
            label="Avg Response Time"
            value={`${metrics.avgResponseTime.toFixed(1)}s`}
            status={metrics.avgResponseTime <= 30 ? 'good' : metrics.avgResponseTime <= 60 ? 'fair' : 'poor'}
          />
          <MetricRow
            label="Signature Failures"
            value={`${metrics.signatureFailures}`}
            status={metrics.signatureFailures === 0 ? 'good' : metrics.signatureFailures < 5 ? 'fair' : 'poor'}
          />
          <MetricRow
            label="Critical Rejections"
            value={`${metrics.criticalRejections}`}
            status={
              metrics.totalActions === 0
                ? 'good'
                : metrics.criticalRejections / metrics.totalActions <= 0.05
                ? 'good'
                : metrics.criticalRejections / metrics.totalActions <= 0.15
                ? 'fair'
                : 'poor'
            }
          />
        </div>
      </div>

      {/* Health tips */}
      {score < 75 && (
        <div className="mt-6 p-4 bg-amber-500/10 border border-amber-500/20 rounded-lg">
          <p className="text-xs text-amber-200 font-medium mb-2">💡 Recommendations:</p>
          <ul className="text-xs text-amber-300/80 space-y-1 list-disc list-inside">
            {metrics.approvalRate < 0.6 && (
              <li>Low approval rate — review risk classification rules</li>
            )}
            {metrics.avgResponseTime > 60 && (
              <li>Slow response time — check backend performance or add auto-approval rules</li>
            )}
            {metrics.signatureFailures > 0 && (
              <li>Signature failures detected — investigate possible tampering</li>
            )}
            {metrics.criticalRejections / metrics.totalActions > 0.1 && (
              <li>High critical rejection rate — review agent behavior</li>
            )}
          </ul>
        </div>
      )}
    </div>
  )
}

function MetricRow({
  label,
  value,
  status,
}: {
  label: string
  value: string
  status: 'good' | 'fair' | 'poor'
}) {
  const statusColor =
    status === 'good'
      ? 'text-emerald-400'
      : status === 'fair'
      ? 'text-amber-400'
      : 'text-red-400'

  const dotColor =
    status === 'good'
      ? 'bg-emerald-500'
      : status === 'fair'
      ? 'bg-amber-500'
      : 'bg-red-500'

  return (
    <div className="flex items-center justify-between text-sm">
      <div className="flex items-center gap-2">
        <span className={`w-2 h-2 rounded-full ${dotColor}`} />
        <span className="text-slate-400">{label}</span>
      </div>
      <span className={`font-mono font-semibold ${statusColor}`}>{value}</span>
    </div>
  )
}
