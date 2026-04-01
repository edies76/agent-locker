const LOCAL_BACKEND_URL =
  process.env.NEXT_PUBLIC_AGENT_LOCK_LOCAL_URL ?? "http://localhost:8000"
const CLOUD_BACKEND_URL =
  process.env.NEXT_PUBLIC_AGENT_LOCK_CLOUD_URL ??
  "https://agent-lock-backend-api-7.azurewebsites.net"

type BackendSource = "local" | "cloud"

export interface BackendResolution {
  baseUrl: string
  source: BackendSource
  reason?: string
  checkedAt: number
}

let lastResolution: BackendResolution | null = null
let pendingResolution: Promise<BackendResolution> | null = null

function createTimeoutSignal(timeoutMs: number): AbortSignal {
  const controller = new AbortController()
  setTimeout(() => controller.abort(), timeoutMs)
  return controller.signal
}

async function isHealthy(baseUrl: string, timeoutMs = 1200): Promise<boolean> {
  try {
    const res = await fetch(`${baseUrl}/health`, {
      cache: "no-store",
      signal: createTimeoutSignal(timeoutMs),
    })
    return res.ok
  } catch {
    return false
  }
}

function ttlFor(resolution: BackendResolution): number {
  // Re-check cloud more frequently so we can switch back to local quickly.
  return resolution.source === "local" ? 15000 : 3000
}

function isFresh(resolution: BackendResolution): boolean {
  return Date.now() - resolution.checkedAt < ttlFor(resolution)
}

function announceResolution(resolution: BackendResolution) {
  if (typeof window === "undefined") return

  window.dispatchEvent(
    new CustomEvent<BackendResolution>("agent-lock-backend-resolution", {
      detail: resolution,
    })
  )
}

export async function resolveBackendEndpoint(force = false): Promise<BackendResolution> {
  if (!force && lastResolution && isFresh(lastResolution)) {
    return lastResolution
  }

  if (pendingResolution) {
    return pendingResolution
  }

  pendingResolution = (async () => {
    const localUp = await isHealthy(LOCAL_BACKEND_URL)

    if (localUp) {
      const resolution: BackendResolution = {
        baseUrl: LOCAL_BACKEND_URL,
        source: "local",
        checkedAt: Date.now(),
      }
      lastResolution = resolution
      announceResolution(resolution)
      return resolution
    }

    const cloudUp = await isHealthy(CLOUD_BACKEND_URL)
    const resolution: BackendResolution = {
      baseUrl: CLOUD_BACKEND_URL,
      source: "cloud",
      reason: cloudUp
        ? `Local backend unavailable (${LOCAL_BACKEND_URL}), using cloud.`
        : `Local and cloud health checks failed. Using cloud endpoint by default.`,
      checkedAt: Date.now(),
    }

    lastResolution = resolution
    announceResolution(resolution)
    return resolution
  })()

  try {
    return await pendingResolution
  } finally {
    pendingResolution = null
  }
}

export function getLastBackendResolution(): BackendResolution | null {
  return lastResolution
}

export function getKnownBackendUrls() {
  return {
    local: LOCAL_BACKEND_URL,
    cloud: CLOUD_BACKEND_URL,
  }
}
