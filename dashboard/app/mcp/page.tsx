"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { fetchActivity, fetchMCPStatus, fetchMCPTargets } from "@/lib/api"
import { Action, MCPStatus, MCPTargetsResponse } from "@/types"

function timeAgo(seconds: number | null): string {
  if (seconds === null) return "Never"
  if (seconds < 60) return `${seconds}s ago`
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`
  return `${Math.floor(seconds / 3600)}h ago`
}

function isRecent(timestamp: string, minutes: number): boolean {
  const ts = new Date(timestamp).getTime()
  if (Number.isNaN(ts)) return false
  const diff = Date.now() - ts
  return diff <= minutes * 60 * 1000
}

export default function MCPMonitorPage() {
  const [status, setStatus] = useState<MCPStatus | null>(null)
  const [targets, setTargets] = useState<MCPTargetsResponse | null>(null)
  const [activity, setActivity] = useState<Action[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      const [statusData, targetsData, activityData] = await Promise.all([
        fetchMCPStatus(),
        fetchMCPTargets(),
        fetchActivity(100),
      ])
      setStatus(statusData)
      setTargets(targetsData)
      setActivity(Array.isArray(activityData) ? activityData : [])
      setError(null)
    } catch {
      setError("Could not load MCP monitor data")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
    const interval = setInterval(load, 5000)
    return () => clearInterval(interval)
  }, [load])

  const intercepted = useMemo(
    () => activity.filter((a: Action) => a.agent_id === "mcp-gateway"),
    [activity]
  )

  const recentIntercepted = useMemo(
    () => intercepted.filter((a: Action) => isRecent(a.timestamp, 5)).length,
    [intercepted]
  )

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-100">MCP Status</h1>
          <p className="text-sm text-slate-500 mt-1">
            Agent-Lock gateway, connected MCP servers, and interception stream
          </p>
        </div>
        <button
          onClick={load}
          className="text-xs px-3 py-2 rounded-lg border border-slate-700 text-slate-300 hover:border-slate-500 transition-colors"
        >
          Refresh
        </button>
      </div>

      {error && (
        <div className="rounded-xl border border-red-900/60 bg-red-950/30 px-4 py-3 text-sm text-red-300">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-4">
          <p className="text-xs uppercase tracking-wider text-slate-500">Agent-Lock</p>
          <p className={`text-lg font-semibold mt-1 ${status?.connected ? "text-slate-100" : "text-red-300"}`}>
            {status?.connected ? "Online" : "Offline"}
          </p>
          <p className="text-xs text-slate-500 mt-1">Last seen {timeAgo(status?.seconds_ago ?? null)}</p>
        </div>

        <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-4">
          <p className="text-xs uppercase tracking-wider text-slate-500">Configured MCPs</p>
          <p className="text-lg font-semibold text-slate-100 mt-1">{targets?.configured_count ?? 0}</p>
        </div>

        <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-4">
          <p className="text-xs uppercase tracking-wider text-slate-500">Connected MCPs</p>
          <p className="text-lg font-semibold text-slate-100 mt-1">{targets?.connected_count ?? 0}</p>
        </div>

        <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-4">
          <p className="text-xs uppercase tracking-wider text-slate-500">Intercepted (5m)</p>
          <p className="text-lg font-semibold text-slate-100 mt-1">{recentIntercepted}</p>
          <p className="text-xs text-slate-500 mt-1">Total {intercepted.length}</p>
        </div>
      </div>

      <div className="rounded-xl border border-slate-800 bg-slate-900/40 overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-800 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-200">MCP Servers via Agent-Lock</h2>
          <span className="text-xs text-slate-500">{targets?.config_path ?? ""}</span>
        </div>

        {loading ? (
          <div className="px-4 py-6 text-sm text-slate-500">Loading...</div>
        ) : !targets || targets.servers.length === 0 ? (
          <div className="px-4 py-6 text-sm text-slate-500">No target servers configured.</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-950/40 border-b border-slate-800 text-xs uppercase tracking-wider text-slate-500">
                <th className="px-4 py-2 text-left">Name</th>
                <th className="px-4 py-2 text-left">Enabled</th>
                <th className="px-4 py-2 text-left">Connected</th>
                <th className="px-4 py-2 text-left">Command</th>
              </tr>
            </thead>
            <tbody>
              {targets.servers.map((server, i) => (
                <tr key={server.name} className={`${i % 2 === 0 ? "bg-slate-900/30" : "bg-slate-950/20"} border-b border-slate-800/70`}>
                  <td className="px-4 py-2 text-slate-200 font-mono">{server.name}</td>
                  <td className="px-4 py-2 text-slate-400">{server.enabled ? "Yes" : "No"}</td>
                  <td className="px-4 py-2">
                    <span className={`text-xs px-2 py-0.5 rounded-full border ${server.connected ? "border-emerald-800 text-emerald-300 bg-emerald-950/30" : "border-slate-700 text-slate-400 bg-slate-900/30"}`}>
                      {server.connected ? "Connected" : "Disconnected"}
                    </span>
                  </td>
                  <td className="px-4 py-2 text-slate-500 font-mono truncate max-w-[420px]">{server.command || "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="rounded-xl border border-slate-800 bg-slate-900/40 overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-800">
          <h2 className="text-sm font-semibold text-slate-200">Recent Intercepted Calls</h2>
        </div>

        {intercepted.length === 0 ? (
          <div className="px-4 py-6 text-sm text-slate-500">No intercepted calls yet.</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-950/40 border-b border-slate-800 text-xs uppercase tracking-wider text-slate-500">
                <th className="px-4 py-2 text-left">Time</th>
                <th className="px-4 py-2 text-left">Tool</th>
                <th className="px-4 py-2 text-left">Risk</th>
                <th className="px-4 py-2 text-left">Decision</th>
              </tr>
            </thead>
            <tbody>
              {intercepted.slice(0, 12).map((action, i) => (
                <tr key={action.action_id} className={`${i % 2 === 0 ? "bg-slate-900/30" : "bg-slate-950/20"} border-b border-slate-800/70`}>
                  <td className="px-4 py-2 text-slate-400">{new Date(action.timestamp).toLocaleString()}</td>
                  <td className="px-4 py-2 text-slate-200 font-mono">{action.tool_name}</td>
                  <td className="px-4 py-2 text-slate-400">{action.risk_level}</td>
                  <td className="px-4 py-2 text-slate-400">{action.decision}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
