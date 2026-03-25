// Export utilities for activity data

export function exportToJSON(data: any[], filename: string = 'agent-lock-activity') {
  const jsonStr = JSON.stringify(data, null, 2)
  const blob = new Blob([jsonStr], { type: 'application/json' })
  downloadBlob(blob, `${filename}-${getTimestamp()}.json`)
}

export function exportToCSV(data: any[], filename: string = 'agent-lock-activity') {
  if (data.length === 0) {
    throw new Error('No data to export')
  }

  // Get all unique keys from all objects
  const keys = Array.from(
    new Set(data.flatMap(item => Object.keys(flattenObject(item))))
  )

  // Create CSV header
  const header = keys.map(escapeCSV).join(',')

  // Create CSV rows
  const rows = data.map(item => {
    const flattened = flattenObject(item)
    return keys.map(key => escapeCSV(String(flattened[key] ?? ''))).join(',')
  })

  const csv = [header, ...rows].join('\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  downloadBlob(blob, `${filename}-${getTimestamp()}.csv`)
}

// Flatten nested objects for CSV export
function flattenObject(obj: any, prefix: string = ''): Record<string, any> {
  const result: Record<string, any> = {}

  for (const [key, value] of Object.entries(obj)) {
    const newKey = prefix ? `${prefix}.${key}` : key

    if (value === null || value === undefined) {
      result[newKey] = ''
    } else if (typeof value === 'object' && !Array.isArray(value)) {
      Object.assign(result, flattenObject(value, newKey))
    } else if (Array.isArray(value)) {
      result[newKey] = JSON.stringify(value)
    } else {
      result[newKey] = value
    }
  }

  return result
}

// Escape CSV values
function escapeCSV(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`
  }
  return value
}

// Download blob as file
function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

// Get timestamp for filename
function getTimestamp(): string {
  const now = new Date()
  return now.toISOString().replace(/[:.]/g, '-').slice(0, 19)
}
