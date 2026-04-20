"use client"

import Link from "next/link"
import { useCallback, useEffect, useMemo, useState } from "react"
import { useParams } from "next/navigation"
import { fetchActivityItem, fetchMCPTargets } from "@/lib/api"
import { Action, MCPTargetsResponse } from "@/types"

export const dynamic = 'force-dynamic'

export default function ActivityDetailPage() {
  const params = useParams<{ actionId: string }>()
  const actionId = params?.actionId ?? ""

  const [item, setItem] = useState<Action | null>(null)
  const [targets, setTargets] = useState<MCPTargetsResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!actionId) return
    try {
      const [detail, mcpTargets] = await Promise.all([
        fetchActivityItem(actionId),
        fetchMCPTargets(),
      ])

      if ((detail as any)?.error) {
        setError((detail as any).error)
        setItem(null)
      } else {
        setItem(detail as Action)
        setError(null)
      }

      setTargets(mcpTargets as MCPTargetsResponse)
    } catch {
      setError("Could not load event details")
    } finally {
      setLoading(false)
    }
  }, [actionId])

  useEffect(() => {
    load()
  }, [load])

  const connectedNames = useMemo(() => {
    if (!targets) return []
    return targets.servers.filter((s) => s.connected).map((s) => s.name)
  }, [targets])

  const timings = item?.execution?.timings_ms
  const benchmark = item?.execution?.benchmark

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-100">Event Details</h1>
          <p className="text-sm text-slate-500 mt-1">Action ID: <span className="font-mono">{actionId}</span></p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href="/activity"
            className="text-xs px-3 py-2 rounded-lg border border-slate-700 text-slate-300 hover:border-slate-500 transition-colors"
          >
            Back to Activity
          </Link>
          <button
            onClick={load}
            className="text-xs px-3 py-2 rounded-lg border border-slate-700 text-slate-300 hover:border-slate-500 transition-colors"
          >
            Refresh
          </button>
        </div>
      </div>

      {loading ? (
        <div className="rounded-xl border border-slate-800 bg-slate-900/30 px-4 py-5 text-slate-500">Loading...</div>
      ) : error ? (
        <div className="rounded-xl border border-red-900/60 bg-red-950/30 px-4 py-5 text-red-300">{error}</div>
      ) : item ? (
        <>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-4">
              <p className="text-xs uppercase tracking-wider text-slate-500">Tool</p>
              <p className="text-sm font-mono text-slate-200 mt-1 break-all">{item.tool_name}</p>
            </div>
            <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-4">
              <p className="text-xs uppercase tracking-wider text-slate-500">Risk</p>
              <p className="text-sm text-slate-200 mt-1">{item.risk_level}</p>
            </div>
            <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-4">
              <p className="text-xs uppercase tracking-wider text-slate-500">Decision</p>
              <p className="text-sm text-slate-200 mt-1">{item.decision}</p>
            </div>
            <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-4">
              <p className="text-xs uppercase tracking-wider text-slate-500">Agent</p>
              <p className="text-sm text-slate-200 mt-1">{item.agent_id ?? "-"}</p>
            </div>
          </div>

          <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-4">
            <h2 className="text-sm font-semibold text-slate-200 mb-3">MCP Context</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-slate-500 text-xs uppercase tracking-wider mb-1">Target MCP</p>
                <p className="font-mono text-slate-200">{item.execution?.server_name ?? "unknown"}</p>
              </div>
              <div>
                <p className="text-slate-500 text-xs uppercase tracking-wider mb-1">Execution</p>
                <p className="text-slate-200">{item.execution?.success ? "Success" : "Failed/Not reported"}</p>
              </div>
              <div className="md:col-span-2">
                <p className="text-slate-500 text-xs uppercase tracking-wider mb-1">Connected MCP Servers Now</p>
                <p className="text-slate-300">{connectedNames.length > 0 ? connectedNames.join(", ") : "None"}</p>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-4">
            <h2 className="text-sm font-semibold text-slate-200 mb-3">Timing Breakdown</h2>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-sm">
              <div>
                <p className="text-slate-500 text-xs uppercase tracking-wider mb-1">Gateway total</p>
                <p className="font-mono text-slate-200">
                  {typeof timings?.total_gateway_ms === "number" ? `${timings.total_gateway_ms.toFixed(1)} ms` : "N/A"}
                </p>
              </div>
              <div>
                <p className="text-slate-500 text-xs uppercase tracking-wider mb-1">Validation wait</p>
                <p className="font-mono text-slate-200">
                  {typeof timings?.validation_wait_ms === "number" ? `${timings.validation_wait_ms.toFixed(1)} ms` : "N/A"}
                </p>
              </div>
              <div>
                <p className="text-slate-500 text-xs uppercase tracking-wider mb-1">Target execute</p>
                <p className="font-mono text-slate-200">
                  {typeof timings?.target_exec_ms === "number" ? `${timings.target_exec_ms.toFixed(1)} ms` : "N/A"}
                </p>
              </div>
              <div>
                <p className="text-slate-500 text-xs uppercase tracking-wider mb-1">Direct baseline</p>
                <p className="font-mono text-slate-200">
                  {typeof timings?.baseline_direct_ms === "number" ? `${timings.baseline_direct_ms.toFixed(1)} ms` : "N/A"}
                </p>
              </div>
            </div>

            <div className="mt-4 border-t border-slate-800 pt-3 text-sm">
              <p className="text-slate-500 text-xs uppercase tracking-wider mb-1">Agent-Lock overhead estimate</p>
              <p className="font-mono text-slate-200">
                {typeof timings?.agent_lock_overhead_ms === "number" ? `${timings.agent_lock_overhead_ms.toFixed(1)} ms` : "N/A"}
              </p>
              <p className="text-xs text-slate-500 mt-2">
                {benchmark?.note ?? "No benchmark note"}
              </p>
            </div>
          </div>

          <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-4">
            <h2 className="text-sm font-semibold text-slate-200 mb-3">Request</h2>
            <pre className="text-xs text-emerald-300 bg-slate-950/40 border border-slate-800 rounded-lg px-3 py-3 overflow-auto max-h-72 font-mono">
{JSON.stringify(item.execution?.request_args ?? item.args ?? {}, null, 2)}
            </pre>
          </div>

          <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-4">
            <h2 className="text-sm font-semibold text-slate-200 mb-3">Response</h2>
            {item.execution?.error ? (
              <pre className="text-xs text-red-300 bg-slate-950/40 border border-slate-800 rounded-lg px-3 py-3 overflow-auto max-h-72 font-mono">
{item.execution.error}
              </pre>
            ) : (
              <pre className="text-xs text-slate-300 bg-slate-950/40 border border-slate-800 rounded-lg px-3 py-3 overflow-auto max-h-72 font-mono">
{item.execution?.response_summary ?? "No response summary captured"}
              </pre>
            )}
          </div>

          <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-4">
            <h2 className="text-sm font-semibold text-slate-200 mb-3">Analysis</h2>
            <p className="text-sm text-slate-300 leading-relaxed">{item.analysis || "-"}</p>
          </div>

          {item.decision === "AUTH_REQUIRED" && (
            <div className="rounded-xl border border-purple-800 bg-purple-950/30 p-4">
              <h2 className="text-sm font-semibold text-purple-200 mb-3">Authentication Required</h2>
              <p className="text-sm text-purple-100">
                This action is waiting for user login before execution can continue.
              </p>
              <div className="mt-3 space-y-1 text-xs text-purple-200/90">
                <p>
                  <span className="font-semibold">Login URL:</span>{" "}
                  {item.login_url ? (
                    <a href={item.login_url} target="_blank" rel="noreferrer" className="underline">
                      {item.login_url}
                    </a>
                  ) : (
                    "N/A"
                  )}
                </p>
                <p>
                  <span className="font-semibold">Auth timeout:</span>{" "}
                  {item.auth_expires_at ? new Date(item.auth_expires_at).toLocaleString() : "N/A"}
                </p>
              </div>
            </div>
          )}

          {item.status_history && item.status_history.length > 0 && (
            <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-4">
              <h2 className="text-sm font-semibold text-slate-200 mb-3">Status History</h2>
              <div className="space-y-2">
                {item.status_history.map((entry, idx) => (
                  <div key={`${entry.timestamp}-${idx}`} className="text-xs text-slate-300 border border-slate-800 rounded px-3 py-2">
                    <p>
                      <span className="font-semibold">{entry.status}</span> — {new Date(entry.timestamp).toLocaleString()}
                    </p>
                    {entry.reason && <p className="text-slate-400 mt-1">{entry.reason}</p>}
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      ) : null}
    </div>
  )
}
