interface ScoreBarProps {
  score: number
  compact?: boolean
}

export default function ScoreBar({ score, compact = false }: ScoreBarProps) {
  const pct = Math.round(score * 100)

  const barColor =
    score >= 0.7
      ? "bg-emerald-500"
      : score >= 0.3
      ? "bg-amber-500"
      : "bg-red-500"

  const textColor =
    score >= 0.7
      ? "text-emerald-400"
      : score >= 0.3
      ? "text-amber-400"
      : "text-red-400"

  if (compact) {
    return (
      <div className="flex items-center gap-2 min-w-[100px]">
        <div className="flex-1 h-1.5 bg-slate-700 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-500 ${barColor}`}
            style={{ width: `${pct}%` }}
          />
        </div>
        <span className={`text-xs font-mono font-semibold ${textColor}`}>
          {pct}%
        </span>
      </div>
    )
  }

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <span className="text-xs text-slate-500">Intent Score</span>
        <span className={`text-sm font-bold font-mono ${textColor}`}>
          {pct}%
        </span>
      </div>
      <div className="w-full h-2.5 bg-slate-700/60 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-700 ${barColor}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <div className="flex justify-between text-xs text-slate-600">
        <span>0</span>
        <span>50</span>
        <span>100</span>
      </div>
    </div>
  )
}
