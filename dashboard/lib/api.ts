const BASE = "http://localhost:8000"

export async function fetchHealth() {
  const res = await fetch(`${BASE}/health`, { cache: "no-store" })
  return res.json()
}

export async function fetchStats() {
  const res = await fetch(`${BASE}/dashboard/stats`, { cache: "no-store" })
  return res.json()
}

export async function fetchActivity(limit = 50) {
  const res = await fetch(`${BASE}/dashboard/activity?limit=${limit}`, { cache: "no-store" })
  return res.json()
}

export async function fetchActivityItem(actionId: string) {
  const res = await fetch(`${BASE}/dashboard/activity/${actionId}`, { cache: "no-store" })
  return res.json()
}

export async function fetchPending() {
  const res = await fetch(`${BASE}/dashboard/pending`, { cache: "no-store" })
  return res.json()
}

export async function fetchMCPStatus() {
  const res = await fetch(`${BASE}/dashboard/mcp/status`, { cache: "no-store" })
  return res.json()
}

export async function fetchMCPTargets() {
  const res = await fetch(`${BASE}/dashboard/mcp/targets`, { cache: "no-store" })
  return res.json()
}

export async function fetchSettings() {
  const res = await fetch(`${BASE}/settings`, { cache: "no-store" })
  return res.json()
}

export async function fetchPolicies() {
  const res = await fetch(`${BASE}/settings/policies`, { cache: "no-store" })
  return res.json()
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
  return res.json()
}

export async function fetchLogs(limit = 50) {
  const res = await fetch(`${BASE}/logs?limit=${limit}`, { cache: "no-store" })
  return res.json()
}
