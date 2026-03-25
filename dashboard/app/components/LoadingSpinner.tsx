interface LoadingSpinnerProps {
  size?: "sm" | "md" | "lg"
  message?: string
}

export default function LoadingSpinner({ size = "md", message }: LoadingSpinnerProps) {
  const sizeClasses = {
    sm: "w-4 h-4 border-2",
    md: "w-8 h-8 border-2",
    lg: "w-12 h-12 border-3",
  }

  return (
    <div className="flex flex-col items-center justify-center gap-3 py-8">
      <div
        className={`${sizeClasses[size]} border-slate-700/50 border-t-sky-400 rounded-full animate-spin`}
      />
      {message && <p className="text-sm text-slate-400">{message}</p>}
    </div>
  )
}
