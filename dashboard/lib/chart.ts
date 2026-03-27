/**
 * Simple SVG chart utilities for Agent-Lock dashboard
 * No external dependencies - pure SVG/TypeScript
 */

export interface DataPoint {
  timestamp: number
  value: number
}

export interface ChartConfig {
  width: number
  height: number
  padding: {
    top: number
    right: number
    bottom: number
    left: number
  }
  strokeColor: string
  fillColor?: string
  showGrid?: boolean
  showPoints?: boolean
}

const DEFAULT_CONFIG: ChartConfig = {
  width: 600,
  height: 200,
  padding: { top: 10, right: 10, bottom: 25, left: 40 },
  strokeColor: '#6366f1',
  showGrid: true,
  showPoints: false,
}

/**
 * Generates SVG path data for a line chart
 */
export function generateLinePath(
  data: DataPoint[],
  config: Partial<ChartConfig> = {}
): string {
  const cfg = { ...DEFAULT_CONFIG, ...config }
  const { width, height, padding } = cfg

  if (data.length === 0) return ''

  const chartWidth = width - padding.left - padding.right
  const chartHeight = height - padding.top - padding.bottom

  // Find min/max values
  const values = data.map(d => d.value)
  const minValue = Math.min(...values)
  const maxValue = Math.max(...values)
  const valueRange = maxValue - minValue || 1

  const timestamps = data.map(d => d.timestamp)
  const minTime = Math.min(...timestamps)
  const maxTime = Math.max(...timestamps)
  const timeRange = maxTime - minTime || 1

  // Scale functions
  const scaleX = (timestamp: number) =>
    padding.left + ((timestamp - minTime) / timeRange) * chartWidth

  const scaleY = (value: number) =>
    padding.top + chartHeight - ((value - minValue) / valueRange) * chartHeight

  // Generate path
  const points = data.map(d => ({ x: scaleX(d.timestamp), y: scaleY(d.value) }))

  let path = `M ${points[0].x} ${points[0].y}`
  for (let i = 1; i < points.length; i++) {
    path += ` L ${points[i].x} ${points[i].y}`
  }

  return path
}

/**
 * Generates area fill path (for gradient fills)
 */
export function generateAreaPath(
  data: DataPoint[],
  config: Partial<ChartConfig> = {}
): string {
  const cfg = { ...DEFAULT_CONFIG, ...config }
  const { width, height, padding } = cfg

  if (data.length === 0) return ''

  const linePath = generateLinePath(data, config)
  const chartHeight = height - padding.top - padding.bottom
  const chartWidth = width - padding.left - padding.right

  // Close the area to bottom
  return `${linePath} L ${padding.left + chartWidth} ${padding.top + chartHeight} L ${padding.left} ${padding.top + chartHeight} Z`
}

/**
 * Aggregates data points into time buckets
 */
export function aggregateByTime(
  data: DataPoint[],
  buckets: number
): DataPoint[] {
  if (data.length === 0) return []

  const sorted = [...data].sort((a, b) => a.timestamp - b.timestamp)
  const minTime = sorted[0].timestamp
  const maxTime = sorted[sorted.length - 1].timestamp
  const bucketSize = (maxTime - minTime) / buckets

  const result: DataPoint[] = []

  for (let i = 0; i < buckets; i++) {
    const bucketStart = minTime + i * bucketSize
    const bucketEnd = bucketStart + bucketSize

    const bucketData = sorted.filter(
      d => d.timestamp >= bucketStart && d.timestamp < bucketEnd
    )

    if (bucketData.length > 0) {
      const avgValue =
        bucketData.reduce((sum, d) => sum + d.value, 0) / bucketData.length
      result.push({
        timestamp: bucketStart + bucketSize / 2,
        value: avgValue,
      })
    } else {
      // Fill empty buckets with 0
      result.push({
        timestamp: bucketStart + bucketSize / 2,
        value: 0,
      })
    }
  }

  return result
}

/**
 * Format timestamp for display
 */
export function formatTimeLabel(timestamp: number, hoursAgo: number): string {
  const date = new Date(timestamp)
  if (hoursAgo <= 1) {
    return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
  } else if (hoursAgo <= 24) {
    return date.toLocaleTimeString('en-US', { hour: 'numeric' })
  } else {
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  }
}

/**
 * Calculate health score (0-100) based on system metrics
 */
export interface HealthMetrics {
  approvalRate: number // 0-1
  avgResponseTime: number // seconds
  signatureFailures: number
  criticalRejections: number
  totalActions: number
}

export function calculateHealthScore(metrics: HealthMetrics): number {
  let score = 100

  // Approval rate (max -20 points if < 50%)
  if (metrics.approvalRate < 0.5) {
    score -= (0.5 - metrics.approvalRate) * 40
  }

  // Response time (max -30 points if > 60s)
  if (metrics.avgResponseTime > 60) {
    score -= Math.min((metrics.avgResponseTime - 60) / 60, 1) * 30
  } else if (metrics.avgResponseTime > 30) {
    score -= ((metrics.avgResponseTime - 30) / 30) * 15
  }

  // Signature failures (max -25 points)
  if (metrics.signatureFailures > 0) {
    const failureRate = metrics.signatureFailures / Math.max(metrics.totalActions, 1)
    score -= Math.min(failureRate * 100, 25)
  }

  // Critical rejections (max -25 points if > 10%)
  if (metrics.totalActions > 0) {
    const criticalRate = metrics.criticalRejections / metrics.totalActions
    if (criticalRate > 0.1) {
      score -= Math.min((criticalRate - 0.1) * 100, 25)
    }
  }

  return Math.max(0, Math.round(score))
}

/**
 * Get health status color and label
 */
export function getHealthStatus(score: number): {
  color: string
  label: string
  bgColor: string
} {
  if (score >= 90) {
    return { color: 'text-emerald-400', label: 'Excellent', bgColor: 'bg-emerald-500' }
  } else if (score >= 75) {
    return { color: 'text-blue-400', label: 'Good', bgColor: 'bg-blue-500' }
  } else if (score >= 60) {
    return { color: 'text-amber-400', label: 'Fair', bgColor: 'bg-amber-500' }
  } else if (score >= 40) {
    return { color: 'text-orange-400', label: 'Poor', bgColor: 'bg-orange-500' }
  } else {
    return { color: 'text-red-400', label: 'Critical', bgColor: 'bg-red-500' }
  }
}
