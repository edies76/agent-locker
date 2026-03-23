import { useRouter } from "next/navigation"
import Link from "next/link"
import { Action } from "@/types"
import { RiskBadge, StatusBadge } from "./Badge"
import ScoreBar from "./ScoreBar"

interface ActionRowProps {
  action: Action
  index: number
}

export default function ActionRow({ action, index }: ActionRowProps) {
  const router = useRouter()

  const ts = action.timestamp
    ? new Date(action.timestamp).toLocaleString()
    : "—"

  const detailHref = `/activity/${action.action_id}`

  const openDetail = () => {
    router.push(detailHref)
  }

  return (
    <tr
      onClick={openDetail}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault()
          openDetail()
        }
      }}
      tabIndex={0}
      role="button"
      aria-label={`Open details for ${action.tool_name}`}
      className={`
        cursor-pointer border-b border-brand-border
        transition-colors duration-100 focus:outline-none focus:ring-2 focus:ring-indigo-600/70
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
              href={detailHref}
              onClick={(e) => e.stopPropagation()}
              className="text-indigo-400 hover:text-indigo-300 underline"
            >
              Open
            </Link>
            <span>↗</span>
          </div>
        </td>
      </tr>
  )
}
