const BASE = "https://agent-lock-backend-api-7.azurewebsites.net"

import { cachedFetch, apiCache } from "./cache"

export async function fetchHealth() {
  const res = await fetch(`${BASE}/health`, { cache: "no-store" })
  return res.json()
}

export async function fetchStats(options?: { refresh?: boolean }) {
  return cachedFetch(`${BASE}/dashboard/stats`, {
    ttl: 5000, // 5s cache
    refresh: options?.refresh,
  })
}

export async function fetchTrends(hours = 24, options?: { refresh?: boolean }) {
  return cachedFetch(`${BASE}/dashboard/trends?hours=${hours}`, {
    ttl: 30000, // 30s cache for trends (expensive calculation)
    refresh: options?.refresh,
  })
}

export async function fetchActivity(limit = 50, options?: { refresh?: boolean }) {
  return cachedFetch(`${BASE}/dashboard/activity?limit=${limit}`, {
    ttl: 3000, // 3s cache for activity
    refresh: options?.refresh,
  })
}

export async function fetchActivityItem(actionId: string) {
  return cachedFetch(`${BASE}/dashboard/activity/${actionId}`, {
    ttl: 10000, // 10s cache for individual items
  })
}

export async function fetchPending() {
  // Never cache pending approvals - always fresh
  const res = await fetch(`${BASE}/dashboard/pending`, { cache: "no-store" })
  return res.json()
}

export async function fetchMCPStatus() {
  return cachedFetch(`${BASE}/dashboard/mcp/status`, {
    ttl: 10000, // 10s cache
  })
}

export async function fetchMCPTargets() {
  return cachedFetch(`${BASE}/dashboard/mcp/targets`, {
    ttl: 15000, // 15s cache - config doesn't change often
  })
}

export async function fetchMCPTimings(limit = 100) {
  return cachedFetch(`${BASE}/dashboard/mcp/timings?limit=${limit}`, {
    ttl: 5000,
  })
}

export async function fetchMCPDiagnostics(options?: { refresh?: boolean }) {
  return cachedFetch(`${BASE}/dashboard/mcp/diagnostics`, {
    ttl: 10000,
    refresh: options?.refresh,
  })
}

export async function toggleMCPTarget(serverName: string, enabled: boolean) {
  const res = await fetch(
    `${BASE}/dashboard/mcp/targets/${encodeURIComponent(serverName)}/toggle`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ enabled }),
    }
  )
  apiCache.invalidatePattern("dashboard/mcp/targets")
  apiCache.invalidatePattern("dashboard/mcp/diagnostics")
  return res.json()
}

export async function fetchSettings() {
  return cachedFetch(`${BASE}/settings`, {
    ttl: 30000, // 30s cache - settings rarely change
  })
}

export async function fetchPolicies() {
  return cachedFetch(`${BASE}/settings/policies`, {
    ttl: 30000,
  })
}

export async function updatePolicies(body: {
  policies: unknown[]
  global_config: Record<string, unknown>
}) {
  const res = await fetch(`${BASE}/settings/policies`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
  
  // Invalidate settings cache after update
  apiCache.invalidate(`fetch:${BASE}/settings/policies`)
  apiCache.invalidate(`fetch:${BASE}/settings`)
  
  return res.json()
}

export async function testTelegram() {
  const res = await fetch(`${BASE}/settings/telegram/test`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({}),
  })
  return res.json()
}

export async function fetchTokenVaultStatus() {
  const res = await fetch(`${BASE}/vault/status`, { cache: "no-store" })
  return res.json()
}

export async function approveAction(action_id: string, decision: "YES" | "NO") {
  const res = await fetch(`${BASE}/approve/${action_id}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ decision }),
  })
  
  // Invalidate related caches after approval
  apiCache.invalidatePattern('dashboard/stats')
  apiCache.invalidatePattern('dashboard/activity')
  
  return res.json()
}

export async function fetchLogs(limit = 50) {
  return cachedFetch(`${BASE}/logs?limit=${limit}`, {
    ttl: 10000,
  })
}

export interface LogsQuery {
  limit?: number
  risk?: string
  decision?: string
  tool?: string
  agent?: string
  signature?: "all" | "valid" | "invalid"
  search?: string
  from_ts?: string
  to_ts?: string
  refresh?: boolean
}

export async function fetchLogsFiltered(query: LogsQuery = {}) {
  const params = new URLSearchParams()
  if (query.limit) params.set("limit", String(query.limit))
  if (query.risk) params.set("risk", query.risk)
  if (query.decision) params.set("decision", query.decision)
  if (query.tool) params.set("tool", query.tool)
  if (query.agent) params.set("agent", query.agent)
  if (query.signature) params.set("signature", query.signature)
  if (query.search) params.set("search", query.search)
  if (query.from_ts) params.set("from_ts", query.from_ts)
  if (query.to_ts) params.set("to_ts", query.to_ts)
  const qs = params.toString()
  return cachedFetch(`${BASE}/logs${qs ? `?${qs}` : ""}`, {
    ttl: 5000,
    refresh: query.refresh,
  })
}

// Utility to force refresh all caches
export function refreshAllCaches() {
  apiCache.clear()
}
