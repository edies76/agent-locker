"use client"

import { useEffect, useState, useCallback } from "react"
import { fetchPending, approveAction } from "@/lib/api"
import { Action } from "@/types"
import { RiskBadge } from "../components/Badge"
import ScoreBar from "../components/ScoreBar"

interface CardState {
  loading: boolean
  done: boolean
  result: "approved" | "rejected" | null
}

function ApprovalCard({
  action,
  onDecision,
}: {
  action: Action
  onDecision: (id: string, decision: "YES" | "NO") => Promise<void>
}) {
  const [state, setState] = useState<CardState>({
    loading: false,
    done: false,
    result: null,
  })
  const [argsExpanded, setArgsExpanded] = useState(false)

  async function handleDecision(decision: "YES" | "NO") {
    setState({ loading: true, done: false, result: null })
    try {
      await onDecision(action.action_id, decision)
      setState({
        loading: false,
        done: true,
        result: decision === "YES" ? "approved" : "rejected",
      })
    } catch {
      setState({ loading: false, done: false, result: null })
    }
  }

  const riskBorderMap = {
    LOW: "border-emerald-700/50",
    HIGH: "border-amber-700/50",
    CRITICAL: "border-red-700/50 shadow-red-900/20 shadow-lg",
  }

  const riskGlowMap = {
    LOW: "",
    HIGH: "ring-1 ring-amber-700/20",
    CRITICAL: "ring-1 ring-red-700/30",
  }

  if (state.done) {
    return (
      <div
        className={`
          bg-brand-card border rounded-xl p-5 flex flex-col items-center justify-center
          min-h-[200px] transition-all duration-500
          ${state.result === "approved"
            ? "border-emerald-700/50 bg-emerald-900/10"
            : "border-red-700/50 bg-red-900/10"
          }
        `}
      >
        <span className="text-4xl mb-2">
          {state.result === "approved" ? "✅" : "🚫"}
        </span>
        <p className="text-lg font-bold text-white">
          {state.result === "approved" ? "Approved" : "Rejected"}
        </p>
        <p className="text-sm text-slate-500 mt-1 font-mono">{action.tool_name}</p>
      </div>
    )
  }

  return (
    <div
      className={`
        bg-brand-card border rounded-xl overflow-hidden
        flex flex-col
        ${riskBorderMap[action.risk_level]}
        ${riskGlowMap[action.risk_level]}
      `}
    >
      {/* Card Header */}
      <div className="px-5 py-4 border-b border-brand-border bg-brand-bg/40">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <p className="text-xs text-slate-500 uppercase tracking-widest mb-1">Tool Request</p>
            <h3 className="text-lg font-bold text-white font-mono truncate">
              {action.tool_name}
            </h3>
            {action.agent_id && (
              <p className="text-xs text-slate-500 mt-0.5">
                from <span className="text-slate-400 font-mono">{action.agent_id}</span>
              </p>
            )}
          </div>
          <RiskBadge level={action.risk_level} size="lg" />
        </div>

        <div className="mt-3 text-xs text-slate-500 flex gap-3">
          <span>
            🕐 {new Date(action.timestamp).toLocaleString()}
          </span>
          {action.action_id && (
            <span className="font-mono text-slate-600 truncate max-w-[140px]">
              #{action.action_id.slice(0, 8)}...
            </span>
          )}
        </div>
      </div>

      {/* Card Body */}
      <div className="px-5 py-4 flex-1 space-y-4">
        {/* User Intent */}
        {action.user_intent && (
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
              You said
            </p>
            <div className="bg-indigo-900/20 border border-indigo-800/30 rounded-lg px-3 py-2.5">
              <p className="text-sm text-indigo-200 italic leading-relaxed">
                &ldquo;{action.user_intent}&rdquo;
              </p>
            </div>
          </div>
        )}

        {/* Analysis */}
        <div>
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
            AI Analysis
          </p>
          <p className="text-sm text-slate-300 leading-relaxed bg-brand-bg/50 border border-brand-border rounded-lg px-3 py-2.5">
            {action.analysis || "No analysis available."}
          </p>
        </div>

        {/* Score bar */}
        <ScoreBar score={action.intent_score} />

        {/* Args (collapsible) */}
        <div>
          <button
            onClick={() => setArgsExpanded((v) => !v)}
            className="flex items-center gap-2 text-xs font-semibold text-slate-500 uppercase tracking-wider hover:text-slate-300 transition-colors w-full"
          >
            <span>{argsExpanded ? "▼" : "▶"}</span>
            <span>Arguments</span>
            <span className="text-slate-700 normal-case tracking-normal font-normal ml-1">
              ({Object.keys(action.args ?? {}).length} keys)
            </span>
          </button>

          {argsExpanded && (
            <div className="mt-2">
              <pre className="text-xs text-emerald-300 bg-brand-bg border border-brand-border rounded-lg px-3 py-3 overflow-auto max-h-48 font-mono leading-relaxed">
                {JSON.stringify(action.args, null, 2)}
              </pre>
            </div>
          )}
        </div>

        {/* Raw command if present */}
        {action.raw_command && (
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
              Raw Command
            </p>
            <pre className="text-xs text-amber-300 bg-brand-bg border border-brand-border rounded-lg px-3 py-2 overflow-auto font-mono">
              {action.raw_command}
            </pre>
          </div>
        )}
      </div>

      {/* Action Buttons */}
      <div className="px-5 py-4 border-t border-brand-border bg-brand-bg/20">
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={() => handleDecision("YES")}
            disabled={state.loading}
            className={`
              flex items-center justify-center gap-2
              bg-emerald-700 hover:bg-emerald-600
              disabled:opacity-60 disabled:cursor-not-allowed
              text-white font-bold text-sm rounded-xl py-3
              border border-emerald-600/50
              transition-all duration-150
              shadow-lg shadow-emerald-900/30
              hover:shadow-emerald-900/50 hover:scale-[1.02]
              active:scale-[0.98]
            `}
          >
            {state.loading ? (
              <>
                <span className="inline-block w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                <span>Processing...</span>
              </>
            ) : (
              <>
                <span>✅</span>
                <span>APPROVE</span>
              </>
            )}
          </button>

          <button
            onClick={() => handleDecision("NO")}
            disabled={state.loading}
            className={`
              flex items-center justify-center gap-2
              bg-red-700 hover:bg-red-600
              disabled:opacity-60 disabled:cursor-not-allowed
              text-white font-bold text-sm rounded-xl py-3
              border border-red-600/50
              transition-all duration-150
              shadow-lg shadow-red-900/30
              hover:shadow-red-900/50 hover:scale-[1.02]
              active:scale-[0.98]
            `}
          >
            {state.loading ? (
              <>
                <span className="inline-block w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                <span>Processing...</span>
              </>
            ) : (
              <>
                <span>❌</span>
                <span>REJECT</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}

export default function ApprovalsPage() {
  const [pending, setPending] = useState<Action[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [decidedIds, setDecidedIds] = useState<Set<string>>(new Set())

  const loadPending = useCallback(async () => {
    try {
      const data = await fetchPending()
      if (Array.isArray(data)) {
        setPending(data)
        setError(false)
      }
    } catch {
      setError(true)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadPending()
    const interval = setInterval(loadPending, 2000)
    return () => clearInterval(interval)
  }, [loadPending])

  const handleDecision = useCallback(
    async (action_id: string, decision: "YES" | "NO") => {
      await approveAction(action_id, decision)
      // After a short delay, mark as decided so it fades out
      setTimeout(() => {
        setDecidedIds((prev) => {
          const next = new Set(prev)
          next.add(action_id)
          return next
        })
        // Remove from list after animation
        setTimeout(() => {
          setPending((prev) => prev.filter((a) => a.action_id !== action_id))
          setDecidedIds((prev) => {
            const next = new Set(prev)
            next.delete(action_id)
            return next
          })
        }, 1200)
      }, 800)
    },
    []
  )

  // Visible (not yet cleaned up) pending actions
  const visible = pending.filter((a) => !decidedIds.has(a.action_id) || true)
  const activeCount = pending.filter(
    (a) => !decidedIds.has(a.action_id)
  ).length

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Approvals</h1>
          <p className="text-slate-500 text-sm mt-0.5">
            Human-in-the-loop decisions for HIGH and CRITICAL risk actions
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 text-xs text-slate-500">
            <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse inline-block" />
            Polling every 2s
          </div>
          <button
            onClick={loadPending}
            className="text-xs text-indigo-400 hover:text-indigo-300 bg-brand-card border border-brand-border rounded-lg px-3 py-2 transition-colors"
          >
            ↻ Refresh
          </button>
        </div>
      </div>

      {/* Error state */}
      {error && (
        <div className="bg-red-900/20 border border-red-700/40 rounded-xl px-5 py-4 text-red-300 text-sm flex items-center gap-3">
          <span className="text-xl">⚠️</span>
          <div>
            <p className="font-semibold">Error loading pending approvals</p>
            <p className="text-red-400 text-xs mt-0.5">
              Make sure the backend is running at http://localhost:8000
            </p>
          </div>
          <button
            onClick={loadPending}
            className="ml-auto text-xs bg-red-800/40 hover:bg-red-700/40 border border-red-700/40 rounded-lg px-3 py-1.5 transition-colors"
          >
            Retry
          </button>
        </div>
      )}

      {/* Loading skeleton */}
      {loading && !error && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {Array.from({ length: 3 }).map((_, i) => (
            <div
              key={i}
              className="bg-brand-card border border-brand-border rounded-xl p-5 space-y-4 animate-pulse"
            >
              <div className="flex justify-between">
                <div className="space-y-2">
                  <div className="h-3 w-20 bg-slate-700/60 rounded" />
                  <div className="h-5 w-40 bg-slate-700/60 rounded" />
                </div>
                <div className="h-6 w-20 bg-slate-700/60 rounded-full" />
              </div>
              <div className="h-16 bg-slate-700/40 rounded-lg" />
              <div className="h-10 bg-slate-700/40 rounded-lg" />
              <div className="h-2.5 bg-slate-700/40 rounded-full" />
              <div className="grid grid-cols-2 gap-3">
                <div className="h-12 bg-slate-700/40 rounded-xl" />
                <div className="h-12 bg-slate-700/40 rounded-xl" />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* All clear state */}
      {!loading && !error && activeCount === 0 && pending.length === 0 && (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <div className="w-24 h-24 rounded-full bg-emerald-900/20 border border-emerald-700/30 flex items-center justify-center text-5xl mb-6">
            🎉
          </div>
          <h2 className="text-2xl font-bold text-white mb-2">All clear!</h2>
          <p className="text-slate-400 text-base max-w-sm">
            Nothing pending for approval. All intercepted actions have been resolved.
          </p>
          <div className="mt-6 flex items-center gap-2 text-xs text-slate-600">
            <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse inline-block" />
            Monitoring for new requests...
          </div>
        </div>
      )}

      {/* Pending count banner */}
      {!loading && !error && activeCount > 0 && (
        <div className="bg-amber-900/20 border border-amber-700/40 rounded-xl px-5 py-3 flex items-center gap-3">
          <span className="text-xl">⏳</span>
          <p className="text-amber-200 text-sm font-medium">
            <span className="text-amber-300 font-bold text-base">{activeCount}</span>{" "}
            {activeCount === 1 ? "action is" : "actions are"} waiting for your approval
          </p>
          <div className="ml-auto flex items-center gap-1.5 text-xs text-amber-600">
            <span className="w-1.5 h-1.5 bg-amber-500 rounded-full animate-pulse inline-block" />
            Live
          </div>
        </div>
      )}

      {/* Approval cards grid */}
      {!loading && !error && visible.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {visible.map((action) => (
            <div
              key={action.action_id}
              className={`transition-all duration-500 ${
                decidedIds.has(action.action_id)
                  ? "opacity-40 scale-95 pointer-events-none"
                  : "opacity-100 scale-100"
              }`}
            >
              <ApprovalCard action={action} onDecision={handleDecision} />
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
