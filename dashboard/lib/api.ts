const BASE = "http://localhost:8000"

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

// Utility to force refresh all caches
export function refreshAllCaches() {
  apiCache.clear()
}
