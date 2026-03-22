import { RiskLevel, ActionStatus } from "@/types"

interface RiskBadgeProps {
  level: RiskLevel
  size?: "sm" | "md" | "lg"
}

interface StatusBadgeProps {
  status: ActionStatus
  size?: "sm" | "md" | "lg"
}

const sizeClasses = {
  sm: "text-xs px-2 py-0.5",
  md: "text-sm px-2.5 py-1",
  lg: "text-base px-3 py-1.5",
}

export function RiskBadge({ level, size = "sm" }: RiskBadgeProps) {
  const colorMap: Record<RiskLevel, string> = {
    LOW: "bg-emerald-900/60 text-emerald-300 border border-emerald-700/50",
    HIGH: "bg-amber-900/60 text-amber-300 border border-amber-700/50",
    CRITICAL: "bg-red-900/60 text-red-300 border border-red-700/50",
  }

  const iconMap: Record<RiskLevel, string> = {
    LOW: "🟢",
    HIGH: "🟡",
    CRITICAL: "🔴",
  }

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full font-semibold ${sizeClasses[size]} ${colorMap[level]}`}
    >
      <span className="leading-none" style={{ fontSize: size === "lg" ? "0.8em" : "0.65em" }}>
        {iconMap[level]}
      </span>
      {level}
    </span>
  )
}

export function StatusBadge({ status, size = "sm" }: StatusBadgeProps) {
  const colorMap: Record<ActionStatus, string> = {
    AUTO_APPROVED: "bg-blue-900/60 text-blue-300 border border-blue-700/50",
    APPROVED: "bg-emerald-900/60 text-emerald-300 border border-emerald-700/50",
    PENDING: "bg-amber-900/60 text-amber-300 border border-amber-700/50",
    BLOCKED: "bg-red-900/60 text-red-300 border border-red-700/50",
  }

  const iconMap: Record<ActionStatus, string> = {
    AUTO_APPROVED: "✅",
    APPROVED: "🛡️",
    PENDING: "⏳",
    BLOCKED: "🚫",
  }

  const labelMap: Record<ActionStatus, string> = {
    AUTO_APPROVED: "Auto-Approved",
    APPROVED: "Approved",
    PENDING: "Pending",
    BLOCKED: "Blocked",
  }

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full font-semibold ${sizeClasses[size]} ${colorMap[status]}`}
    >
      <span className="leading-none" style={{ fontSize: size === "lg" ? "0.8em" : "0.7em" }}>
        {iconMap[status]}
      </span>
      {labelMap[status]}
    </span>
  )
}
