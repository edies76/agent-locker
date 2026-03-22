import { useState } from "react"
import Link from "next/link"
import { Action } from "@/types"
import { RiskBadge, StatusBadge } from "./Badge"
import ScoreBar from "./ScoreBar"

interface ActionRowProps {
  action: Action
  index: number
}

export default function ActionRow({ action, index }: ActionRowProps) {
  const [expanded, setExpanded] = useState(false)

  const ts = action.timestamp
    ? new Date(action.timestamp).toLocaleString()
    : "—"

  return (
    <>
      <tr
        onClick={() => setExpanded((v) => !v)}
        className={`
          cursor-pointer border-b border-brand-border
          transition-colors duration-100
          ${index % 2 === 0 ? "bg-brand-card" : "bg-brand-bg"}
          hover:bg-indigo-900/20
        `}
      >
        {/* Time */}
        <td className="px-4 py-3 text-xs text-slate-400 whitespace-nowrap font-mono">
          {ts}
        </td>

        {/* Tool name */}
        <td className="px-4 py-3">
          <span className="text-sm font-semibold text-slate-100 font-mono">
            {action.tool_name}
          </span>
          {action.raw_command && (
            <p className="text-xs text-slate-500 mt-0.5 truncate max-w-[200px]">
              {action.raw_command}
            </p>
          )}
        </td>

        {/* Risk */}
        <td className="px-4 py-3">
          <RiskBadge level={action.risk_level} />
        </td>

        {/* Status */}
        <td className="px-4 py-3">
          <StatusBadge status={action.decision} />
        </td>

        {/* Score */}
        <td className="px-4 py-3 min-w-[120px]">
          <ScoreBar score={action.intent_score} compact />
        </td>

        {/* Agent */}
        <td className="px-4 py-3 text-xs text-slate-500 font-mono">
          {action.agent_id ?? "—"}
        </td>

        {/* Analysis preview */}
        <td className="px-4 py-3 max-w-[260px]">
          <p className="text-xs text-slate-400 truncate" title={action.analysis}>
            {action.analysis || "—"}
          </p>
        </td>

        {/* Expand chevron */}
        <td className="px-3 py-3 text-slate-600 text-xs select-none">
          <div className="flex items-center gap-2">
            <Link
              href={`/activity/${action.action_id}`}
              onClick={(e) => e.stopPropagation()}
              className="text-indigo-400 hover:text-indigo-300 underline"
            >
              View
            </Link>
            <span>{expanded ? "▲" : "▼"}</span>
          </div>
        </td>
      </tr>

      {/* Expanded detail row */}
      {expanded && (
        <tr className="border-b border-brand-border bg-[#0f1120]">
          <td colSpan={8} className="px-6 py-5">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {/* Left: Intent + Analysis */}
              <div className="space-y-4">
                {action.user_intent && (
                  <div>
                    <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-widest mb-1">
                      User Intent
                    </h4>
                    <p className="text-sm text-slate-300 bg-brand-card border border-brand-border rounded-lg px-3 py-2">
                      {action.user_intent}
                    </p>
                  </div>
                )}

                <div>
                  <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-widest mb-1">
                    Analysis
                  </h4>
                  <p className="text-sm text-slate-300 bg-brand-card border border-brand-border rounded-lg px-3 py-2 leading-relaxed">
                    {action.analysis || "No analysis available."}
                  </p>
                </div>

                <div>
                  <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-widest mb-1">
                    Intent Score
                  </h4>
                  <ScoreBar score={action.intent_score} />
                </div>

                <div className="flex flex-wrap gap-3 text-xs text-slate-500">
                  {action.decided_at && (
                    <span>
                      <span className="text-slate-600">Decided: </span>
                      {new Date(action.decided_at).toLocaleString()}
                    </span>
                  )}
                  {action._signature_valid !== undefined && (
                    <span>
                      <span className="text-slate-600">Signature: </span>
                      {action._signature_valid ? (
                        <span className="text-emerald-400">✅ Valid</span>
                      ) : (
                        <span className="text-red-400">❌ Invalid</span>
                      )}
                    </span>
                  )}
                  {action._source && (
                    <span>
                      <span className="text-slate-600">Source: </span>
                      <span className="text-slate-400">{action._source}</span>
                    </span>
                  )}
                </div>
              </div>

              {/* Right: Args JSON */}
              <div>
                <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-widest mb-1">
                  Arguments
                </h4>
                <pre className="text-xs text-emerald-300 bg-brand-card border border-brand-border rounded-lg px-3 py-3 overflow-auto max-h-64 font-mono leading-relaxed">
                  {JSON.stringify(action.args, null, 2)}
                </pre>

                {action.raw_command && (
                  <div className="mt-3">
                    <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-widest mb-1">
                      Raw Command
                    </h4>
                    <pre className="text-xs text-amber-300 bg-brand-card border border-brand-border rounded-lg px-3 py-2 overflow-auto font-mono">
                      {action.raw_command}
                    </pre>
                  </div>
                )}
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  )
}
