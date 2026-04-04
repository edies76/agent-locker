"use client"

import Link from "next/link"
import { useParams } from "next/navigation"
import { useCallback, useEffect, useState } from "react"
import { fetchMCPTargetDetail } from "@/lib/api"
import { MCPTargetDetailResponse } from "@/types"

export default function MCPTargetDetailPage() {
  const params = useParams<{ serverName: string }>()
  const serverName = decodeURIComponent(params?.serverName || "")

  const [data, setData] = useState<MCPTargetDetailResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!serverName) {
      setError("Invalid target name")
      setLoading(false)
      return
    }

    try {
      const result = (await fetchMCPTargetDetail(serverName)) as MCPTargetDetailResponse
      setData(result)
      setError(result?.ok ? null : result?.error || "Could not load the target detail")
    } catch {
      setError("Could not load the MCP target detail")
    } finally {
      setLoading(false)
    }
  }, [serverName])

  useEffect(() => {
    load()
    const iv = setInterval(load, 5000)
    return () => clearInterval(iv)
  }, [load])

  const target = data?.target

  return (
    <div className="space-y-6">
      <section className="glass-panel rounded-2xl border px-4 py-4 md:px-6 md:py-5">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-[0.18em] text-cyan-300">MCP target</p>
            <h1 className="text-2xl md:text-3xl font-semibold text-white mt-1">Detail: {serverName || "N/A"}</h1>
            <p className="text-sm text-slate-300/85 mt-1">
              Dedicated target diagnostics with endpoint and startup verification.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Link href="/mcp" className="rounded-lg border border-slate-600/50 px-4 py-2 text-sm text-slate-100 hover:bg-slate-800/60">
              Back to monitor
            </Link>
            <button onClick={load} className="btn-glow rounded-lg px-4 py-2 text-sm font-semibold">
              Refresh
            </button>
          </div>
        </div>
      </section>

      {loading && <div className="glass-panel rounded-xl border px-4 py-4 text-sm text-slate-300">Loading details...</div>}
      {error && <div className="glass-panel rounded-xl border px-4 py-4 text-sm text-rose-300">{error}</div>}

      {!loading && !error && target && (
        <>
          <section className="glass-panel rounded-xl border p-4">
            <p className="text-xs uppercase tracking-wider text-slate-500">Exact cause</p>
            <p className="text-sm font-mono text-cyan-200 mt-2">{target.connection_reason_code || "UNKNOWN"}</p>
            <p className="text-sm text-slate-100 mt-1">
              {target.connection_reason || "Could not determine the exact cause."}
            </p>
          </section>

          <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="glass-panel rounded-xl border p-4">
              <p className="text-xs uppercase tracking-wider text-slate-400">Connection status</p>
              <p className={`text-2xl font-semibold mt-1 ${target.connected ? "text-emerald-300" : "text-rose-300"}`}>
                {target.connected ? "Connected" : "Disconnected"}
              </p>
            </div>
            <div className="glass-panel rounded-xl border p-4">
              <p className="text-xs uppercase tracking-wider text-slate-400">Enabled</p>
              <p className={`text-2xl font-semibold mt-1 ${target.enabled ? "text-emerald-300" : "text-slate-400"}`}>
                {target.enabled ? "Yes" : "No"}
              </p>
            </div>
            <div className="glass-panel rounded-xl border p-4">
              <p className="text-xs uppercase tracking-wider text-slate-400">Resolved command</p>
              <p className={`text-2xl font-semibold mt-1 ${target.command_found ? "text-emerald-300" : "text-amber-300"}`}>
                {target.command_found ? "Found" : "Not found"}
              </p>
            </div>
          </section>

          <section className="glass-panel rounded-xl border p-4 space-y-3">
            <p className="text-xs uppercase tracking-wider text-slate-500">Process</p>
            <p className="text-sm text-slate-100">Command: <span className="font-mono text-cyan-200">{target.command || "N/A"}</span></p>
            <p className="text-sm text-slate-100">Args: <span className="font-mono text-cyan-200">{target.args?.length ? JSON.stringify(target.args) : "[]"}</span></p>
            <p className="text-sm text-slate-100">Resolved path: <span className="font-mono text-cyan-200">{target.resolved_command || "Not found in PATH"}</span></p>
            <p className="text-sm text-slate-100">Startup hint: <span className="text-amber-200">{target.startup_hint || "N/A"}</span></p>
          </section>

          <section className="glass-panel rounded-xl border p-4 space-y-3">
            <p className="text-xs uppercase tracking-wider text-slate-500">Remote endpoint</p>
            {target.endpoint ? (
              <>
                <p className="text-sm text-slate-100">Configured endpoint: <span className="font-mono text-cyan-200">{target.endpoint}</span></p>
                <p className={`text-sm ${target.endpoint_reachable ? "text-emerald-300" : "text-rose-300"}`}>
                  {target.endpoint_reachable
                    ? "A service was detected on the endpoint."
                    : `No service was detected at ${target.endpoint}.`}
                </p>
                {target.endpoint_status && (
                  <p className="text-xs text-slate-400">{target.endpoint_status}</p>
                )}
              </>
            ) : (
              <p className="text-sm text-slate-300">This target does not use a remote HTTP endpoint (stdio/local).</p>
            )}
          </section>

          <section className="glass-panel rounded-xl border p-4 space-y-2">
            <p className="text-xs uppercase tracking-wider text-slate-500">Operational notes</p>
            {data?.restart_required_after_toggle && (
              <p className="text-sm text-amber-200">Enable/disable changes require an Agent-Lock MCP restart to take effect.</p>
            )}
            {data?.warning && <p className="text-sm text-amber-200">{data.warning}</p>}
            {data?.config_path && <p className="text-xs text-slate-400">Config: {data.config_path}</p>}
          </section>
        </>
      )}
    </div>
  )
}
