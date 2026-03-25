interface ErrorAlertProps {
  title?: string
  message: string
  onRetry?: () => void
  onDismiss?: () => void
}

export default function ErrorAlert({
  title = "Error",
  message,
  onRetry,
  onDismiss,
}: ErrorAlertProps) {
  return (
    <div className="bg-red-900/20 border border-red-700/40 rounded-xl px-5 py-4 flex items-start gap-3">
      <span className="text-2xl">⚠️</span>
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-red-300 text-sm mb-1">{title}</p>
        <p className="text-red-400 text-xs leading-relaxed">{message}</p>
      </div>
      <div className="flex items-center gap-2">
        {onRetry && (
          <button
            onClick={onRetry}
            className="text-xs bg-red-800/40 hover:bg-red-700/40 border border-red-700/40 rounded-lg px-3 py-1.5 transition-colors whitespace-nowrap"
          >
            Retry
          </button>
        )}
        {onDismiss && (
          <button
            onClick={onDismiss}
            className="text-red-400 hover:text-red-300 text-xl leading-none"
            aria-label="Dismiss"
          >
            ×
          </button>
        )}
      </div>
    </div>
  )
}
