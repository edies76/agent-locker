interface StatCardProps {
  label: string
  value: number
  color: string
  icon: string
  subtitle?: string
}

export default function StatCard({ label, value, color, icon, subtitle }: StatCardProps) {
  const colorMap: Record<string, string> = {
    indigo: "from-indigo-600/20 to-indigo-900/10 border-indigo-700/40 text-indigo-400",
    blue: "from-blue-600/20 to-blue-900/10 border-blue-700/40 text-blue-400",
    emerald: "from-emerald-600/20 to-emerald-900/10 border-emerald-700/40 text-emerald-400",
    green: "from-green-600/20 to-green-900/10 border-green-700/40 text-green-400",
    red: "from-red-600/20 to-red-900/10 border-red-700/40 text-red-400",
    amber: "from-amber-600/20 to-amber-900/10 border-amber-700/40 text-amber-400",
    yellow: "from-yellow-600/20 to-yellow-900/10 border-yellow-700/40 text-yellow-400",
    slate: "from-slate-600/20 to-slate-900/10 border-slate-700/40 text-slate-400",
    purple: "from-purple-600/20 to-purple-900/10 border-purple-700/40 text-purple-400",
  }

  const classes = colorMap[color] ?? colorMap["slate"]

  return (
    <div
      className={`
        relative rounded-xl border bg-gradient-to-br p-5
        flex flex-col gap-3 overflow-hidden
        transition-transform duration-150 hover:scale-[1.02]
        ${classes}
      `}
    >
      {/* Background glow */}
      <div className="absolute inset-0 opacity-5 pointer-events-none select-none flex items-center justify-end pr-4">
        <span className="text-8xl leading-none">{icon}</span>
      </div>

      {/* Header row */}
      <div className="flex items-center justify-between relative z-10">
        <span className="text-2xl leading-none">{icon}</span>
      </div>

      {/* Value */}
      <div className="relative z-10">
        <p className="text-3xl font-bold text-white tabular-nums leading-none">
          {value.toLocaleString()}
        </p>
        {subtitle && (
          <p className="text-xs mt-1 opacity-70">{subtitle}</p>
        )}
      </div>

      {/* Label */}
      <div className="relative z-10">
        <p className="text-sm font-medium text-slate-300">{label}</p>
      </div>
    </div>
  )
}
