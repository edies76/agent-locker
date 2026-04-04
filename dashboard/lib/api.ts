import { cachedFetch, apiCache } from "./cache"
import { resolveBackendEndpoint, getLastBackendResolution } from "./backendEndpoint"
import type {
  CLICatalogResponse,
  CLIRunPayload,
  CLIRunResponse,
  RuntimeControlsResponse,
  RuntimeControlsUpdateResponse,
} from "@/types"

async function buildUrl(path: string): Promise<string> {
  const { baseUrl } = await resolveBackendEndpoint()
  return `${baseUrl}${path}`
}

async function cachedFromPath<T>(
  path: string,
  options?: {
    ttl?: number
    skip?: boolean
    refresh?: boolean
  }
): Promise<T> {
  const url = await buildUrl(path)
  return cachedFetch<T>(url, options)
}

export async function getBackendConnectionInfo() {
  return (await resolveBackendEndpoint()) ?? getLastBackendResolution()
}

export async function fetchHealth() {
  const res = await fetch(await buildUrl("/health"), { cache: "no-store" })
  return res.json()
}

export async function fetchStats(options?: { refresh?: boolean }) {
  return cachedFromPath(`/dashboard/stats`, {
    ttl: 5000, // 5s cache
    refresh: options?.refresh,
  })
}

export async function fetchTrends(hours = 24, options?: { refresh?: boolean }) {
  return cachedFromPath(`/dashboard/trends?hours=${hours}`, {
    ttl: 30000, // 30s cache for trends (expensive calculation)
    refresh: options?.refresh,
  })
}

export async function fetchActivity(limit = 50, options?: { refresh?: boolean }) {
  return cachedFromPath(`/dashboard/activity?limit=${limit}`, {
    ttl: 3000, // 3s cache for activity
    refresh: options?.refresh,
  })
}

export async function fetchActivityItem(actionId: string) {
  return cachedFromPath(`/dashboard/activity/${actionId}`, {
    ttl: 10000, // 10s cache for individual items
  })
}

export async function fetchPending() {
  // Never cache pending approvals - always fresh.
  // Retry once with forced endpoint re-resolution in case the cached backend became unavailable.
  const attempt = async (forceResolve: boolean) => {
    const { baseUrl } = await resolveBackendEndpoint(forceResolve)
    const res = await fetch(`${baseUrl}/dashboard/pending`, { cache: "no-store" })
    if (!res.ok) {
      const body = await res.text()
      throw new Error(body || `Pending fetch failed (${res.status})`)
    }
    return res.json()
  }

  try {
    return await attempt(false)
  } catch {
    try {
      return await attempt(true)
    } catch {
      // Keep approvals page usable even if backend is temporarily unreachable.
      return []
    }
  }
}

export async function fetchMCPStatus() {
  return cachedFromPath(`/dashboard/mcp/status`, {
    ttl: 10000, // 10s cache
  })
}

export async function fetchMCPTargets() {
  return cachedFromPath(`/dashboard/mcp/targets`, {
    ttl: 15000, // 15s cache - config doesn't change often
  })
}

export async function fetchMCPTargetDetail(serverName: string) {
  return cachedFromPath(`/dashboard/mcp/targets/${encodeURIComponent(serverName)}`, {
    ttl: 3000,
  })
}

export async function fetchMCPTimings(limit = 100) {
  return cachedFromPath(`/dashboard/mcp/timings?limit=${limit}`, {
    ttl: 5000,
  })
}

export async function fetchMCPDiagnostics(options?: { refresh?: boolean }) {
  return cachedFromPath(`/dashboard/mcp/diagnostics`, {
    ttl: 10000,
    refresh: options?.refresh,
  })
}

export async function fetchPluginStatus(options?: { refresh?: boolean }) {
  return cachedFromPath(`/dashboard/plugin/status`, {
    ttl: 5000,
    refresh: options?.refresh,
  })
}

export async function fetchPluginActions(limit = 30, options?: { refresh?: boolean }) {
  return cachedFromPath(`/dashboard/plugin/actions?limit=${limit}`, {
    ttl: 4000,
    refresh: options?.refresh,
  })
}

export async function createPluginPairing(body: { label?: string; preferred_channel?: string }) {
  const base = await buildUrl("")
  const res = await fetch(`${base}/dashboard/plugin/pairings`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
  return res.json()
}

export async function fetchPluginPairings(options?: { refresh?: boolean }) {
  return cachedFromPath(`/dashboard/plugin/pairings`, {
    ttl: 3000,
    refresh: options?.refresh,
  })
}

export async function setPluginPairingChannel(pairingId: string, channel: string) {
  const base = await buildUrl("")
  const res = await fetch(`${base}/dashboard/plugin/pairings/${encodeURIComponent(pairingId)}/channel`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ channel }),
  })
  apiCache.invalidatePattern("dashboard/plugin/pairings")
  apiCache.invalidatePattern("dashboard/plugin/status")
  return res.json()
}

export async function toggleMCPTarget(serverName: string, enabled: boolean) {
  const base = await buildUrl("")
  const res = await fetch(
    `${base}/dashboard/mcp/targets/${encodeURIComponent(serverName)}/toggle`,
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
  return cachedFromPath(`/settings`, {
    ttl: 30000, // 30s cache - settings rarely change
  })
}

export async function fetchRuntimeControls(options?: { refresh?: boolean }) {
  return cachedFromPath<RuntimeControlsResponse>(`/settings/runtime-controls`, {
    ttl: 5000,
    refresh: options?.refresh,
  })
}

export async function updateRuntimeControls(body: {
  gemini_analysis_enabled?: boolean
  auto_approve_enabled?: boolean
  auto_approve_tool_allowlist?: string[]
  ws_bridge_enabled?: boolean
  first_time_manual_approval_enabled?: boolean
  notify_auto_approved_actions?: boolean
  integration_modes?: Record<string, "auto" | "manual" | "disabled">
}) {
  const base = await buildUrl("")
  const res = await fetch(`${base}/settings/runtime-controls`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
  apiCache.invalidatePattern("/settings")
  apiCache.invalidatePattern("/settings/runtime-controls")
  return (await res.json()) as RuntimeControlsUpdateResponse
}

export async function fetchCLICatalog(options?: { refresh?: boolean }) {
  return cachedFromPath<CLICatalogResponse>(`/dashboard/cli/catalog`, {
    ttl: 10000,
    refresh: options?.refresh,
  })
}

export async function runCLICommand(body: CLIRunPayload) {
  const base = await buildUrl("")
  const res = await fetch(`${base}/dashboard/cli/run`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
  return (await res.json()) as CLIRunResponse
}

export async function fetchPolicies() {
  return cachedFromPath(`/settings/policies`, {
    ttl: 30000,
  })
}

export async function updatePolicies(body: {
  policies: unknown[]
  global_config: Record<string, unknown>
}) {
  const policyUrl = await buildUrl(`/settings/policies`)
  const res = await fetch(policyUrl, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
  
  // Invalidate settings cache after update
  apiCache.invalidatePattern("/settings/policies")
  apiCache.invalidatePattern("/settings")
  
  return res.json()
}

export async function testTelegram() {
  const res = await fetch(await buildUrl(`/settings/telegram/test`), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({}),
  })
  return res.json()
}

export async function fetchTokenVaultStatus() {
  const res = await fetch(await buildUrl(`/vault/status`), { cache: "no-store" })
  return res.json()
}

export async function approveAction(action_id: string, decision: "YES" | "NO") {
  const attempt = async (forceResolve: boolean) => {
    const { baseUrl } = await resolveBackendEndpoint(forceResolve)
    const res = await fetch(`${baseUrl}/approve/${action_id}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ decision }),
    })
    const data = await res.json()
    if (!res.ok) {
      throw new Error(data?.detail || data?.error || `Approval failed (${res.status})`)
    }
    return data
  }

  let data: any
  try {
    data = await attempt(false)
  } catch {
    data = await attempt(true)
  }

  const status = String(data?.status || "")
  if (status !== "APPROVED" && status !== "BLOCKED") {
    throw new Error(`Unexpected approval status: ${status || "unknown"}`)
  }
  
  // Invalidate related caches after approval
  apiCache.invalidatePattern('dashboard/stats')
  apiCache.invalidatePattern('dashboard/activity')
  apiCache.invalidatePattern('dashboard/pending')

  return data
}

export async function fetchLogs(limit = 50) {
  return cachedFromPath(`/logs?limit=${limit}`, {
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
  return cachedFromPath(`/logs${qs ? `?${qs}` : ""}`, {
    ttl: 5000,
    refresh: query.refresh,
  })
}

// Utility to force refresh all caches
export function refreshAllCaches() {
  apiCache.clear()
}
