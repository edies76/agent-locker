interface EmptyStateProps {
  icon?: string
  title: string
  description: string
  action?: {
    label: string
    onClick: () => void
  }
}

export default function EmptyState({ icon = "📭", title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="w-20 h-20 rounded-full bg-slate-900/40 border border-slate-700/40 flex items-center justify-center text-4xl mb-4">
        {icon}
      </div>
      <h3 className="text-xl font-bold text-white mb-2">{title}</h3>
      <p className="text-slate-400 text-sm max-w-md mb-6">{description}</p>
      {action && (
        <button
          onClick={action.onClick}
          className="bg-sky-700 hover:bg-sky-600 text-white font-semibold text-sm rounded-lg px-5 py-2.5 transition-colors"
        >
          {action.label}
        </button>
      )}
    </div>
  )
}
