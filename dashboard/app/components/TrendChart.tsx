"use client"

import { useMemo } from 'react'
import { DataPoint, generateLinePath, generateAreaPath, formatTimeLabel } from '@/lib/chart'

interface TrendChartProps {
  data: DataPoint[]
  title: string
  color?: string
  fillGradient?: boolean
  height?: number
  showLabels?: boolean
  unit?: string
}

export default function TrendChart({
  data,
  title,
  color = '#6366f1',
  fillGradient = true,
  height = 180,
  showLabels = true,
  unit = '',
}: TrendChartProps) {
  const width = 600
  const padding = { top: 20, right: 20, bottom: 30, left: 50 }

  const { linePath, areaPath, minValue, maxValue, labels } = useMemo(() => {
    if (data.length === 0) {
      return { linePath: '', areaPath: '', minValue: 0, maxValue: 0, labels: [] }
    }

    const config = { width, height, padding, strokeColor: color }
    const linePath = generateLinePath(data, config)
    const areaPath = generateAreaPath(data, config)

    const values = data.map(d => d.value)
    const minValue = Math.min(...values)
    const maxValue = Math.max(...values)

    // Generate time labels (show first, middle, last)
    const timestamps = data.map(d => d.timestamp)
    const minTime = Math.min(...timestamps)
    const maxTime = Math.max(...timestamps)
    const hoursAgo = (Date.now() - minTime) / (1000 * 60 * 60)

    const labels = [
      { x: padding.left, label: formatTimeLabel(minTime, hoursAgo) },
      {
        x: padding.left + (width - padding.left - padding.right) / 2,
        label: formatTimeLabel((minTime + maxTime) / 2, hoursAgo),
      },
      {
        x: width - padding.right,
        label: formatTimeLabel(maxTime, hoursAgo),
      },
    ]

    return { linePath, areaPath, minValue, maxValue, labels }
  }, [data, color, width, height, padding])

  const currentValue = data.length > 0 ? data[data.length - 1].value : 0
  const previousValue = data.length > 1 ? data[data.length - 2].value : currentValue
  const change = currentValue - previousValue
  const changePercent =
    previousValue !== 0 ? ((change / previousValue) * 100).toFixed(1) : '0.0'

  return (
    <div className="bg-brand-card border border-brand-border rounded-xl p-5 space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h3 className="text-sm font-medium text-slate-400">{title}</h3>
          <div className="flex items-end gap-2 mt-1">
            <span className="text-3xl font-bold text-white tabular-nums">
              {currentValue.toFixed(unit === 's' ? 1 : 0)}
              <span className="text-lg text-slate-500 ml-1">{unit}</span>
            </span>
            {data.length > 1 && (
              <span
                className={`text-sm font-medium mb-1 ${
                  change > 0
                    ? 'text-emerald-400'
                    : change < 0
                    ? 'text-red-400'
                    : 'text-slate-500'
                }`}
              >
                {change > 0 ? '↑' : change < 0 ? '↓' : '→'} {Math.abs(parseFloat(changePercent))}%
              </span>
            )}
          </div>
        </div>
        <div className="text-xs text-slate-600">Last 24h</div>
      </div>

      {/* Chart */}
      {data.length === 0 ? (
        <div className="flex items-center justify-center h-[180px] text-slate-600 text-sm">
          No data available
        </div>
      ) : (
        <div className="relative">
          <svg
            width={width}
            height={height}
            viewBox={`0 0 ${width} ${height}`}
            className="w-full h-auto"
          >
            <defs>
              {fillGradient && (
                <linearGradient id={`gradient-${title}`} x1="0%" y1="0%" x2="0%" y2="100%">
                  <stop offset="0%" stopColor={color} stopOpacity="0.3" />
                  <stop offset="100%" stopColor={color} stopOpacity="0.0" />
                </linearGradient>
              )}
            </defs>

            {/* Grid lines */}
            {showLabels && (
              <g className="text-[10px] text-slate-600 font-mono">
                {[0, 0.25, 0.5, 0.75, 1].map((pct, i) => {
                  const y =
                    padding.top + (height - padding.top - padding.bottom) * pct
                  const value = maxValue - (maxValue - minValue) * pct
                  return (
                    <g key={i}>
                      <line
                        x1={padding.left}
                        y1={y}
                        x2={width - padding.right}
                        y2={y}
                        stroke="#1e293b"
                        strokeWidth="1"
                        strokeDasharray="2,3"
                      />
                      <text x={padding.left - 8} y={y + 3} textAnchor="end" fill="#64748b">
                        {value.toFixed(0)}
                      </text>
                    </g>
                  )
                })}
              </g>
            )}

            {/* Area fill */}
            {fillGradient && areaPath && (
              <path d={areaPath} fill={`url(#gradient-${title})`} />
            )}

            {/* Line */}
            {linePath && (
              <path
                d={linePath}
                fill="none"
                stroke={color}
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            )}

            {/* Time labels */}
            {showLabels && (
              <g className="text-[10px] text-slate-600">
                {labels.map((label, i) => (
                  <text
                    key={i}
                    x={label.x}
                    y={height - 8}
                    textAnchor="middle"
                    fill="#64748b"
                  >
                    {label.label}
                  </text>
                ))}
              </g>
            )}
          </svg>
        </div>
      )}
    </div>
  )
}
