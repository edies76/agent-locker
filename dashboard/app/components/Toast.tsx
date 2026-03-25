"use client"

import { createContext, useContext, useState, useCallback, ReactNode } from "react"

export type ToastType = "success" | "error" | "info" | "warning"

interface Toast {
  id: string
  type: ToastType
  title: string
  message?: string
  duration?: number
}

interface ToastContextValue {
  toasts: Toast[]
  showToast: (toast: Omit<Toast, "id">) => void
  dismissToast: (id: string) => void
}

const ToastContext = createContext<ToastContextValue | undefined>(undefined)

export function useToast() {
  const context = useContext(ToastContext)
  if (!context) {
    throw new Error("useToast must be used within ToastProvider")
  }
  return context
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])

  const showToast = useCallback((toast: Omit<Toast, "id">) => {
    const id = Math.random().toString(36).substring(7)
    const newToast = { ...toast, id }
    
    setToasts((prev) => [...prev, newToast])

    // Auto-dismiss after duration (default 5s)
    const duration = toast.duration ?? 5000
    if (duration > 0) {
      setTimeout(() => {
        dismissToast(id)
      }, duration)
    }
  }, [])

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  return (
    <ToastContext.Provider value={{ toasts, showToast, dismissToast }}>
      {children}
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
    </ToastContext.Provider>
  )
}

function ToastContainer({
  toasts,
  onDismiss,
}: {
  toasts: Toast[]
  onDismiss: (id: string) => void
}) {
  if (toasts.length === 0) return null

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-3 max-w-md">
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} onDismiss={onDismiss} />
      ))}
    </div>
  )
}

function ToastItem({ toast, onDismiss }: { toast: Toast; onDismiss: (id: string) => void }) {
  const iconMap = {
    success: "✅",
    error: "❌",
    warning: "⚠️",
    info: "ℹ️",
  }

  const colorMap = {
    success: "bg-emerald-900/90 border-emerald-700/50 text-emerald-100",
    error: "bg-red-900/90 border-red-700/50 text-red-100",
    warning: "bg-amber-900/90 border-amber-700/50 text-amber-100",
    info: "bg-sky-900/90 border-sky-700/50 text-sky-100",
  }

  return (
    <div
      className={`
        ${colorMap[toast.type]}
        border rounded-lg px-4 py-3 shadow-xl
        backdrop-blur-sm
        animate-slide-in-right
        flex items-start gap-3
      `}
    >
      <span className="text-xl flex-shrink-0">{iconMap[toast.type]}</span>
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-sm">{toast.title}</p>
        {toast.message && <p className="text-xs opacity-90 mt-0.5">{toast.message}</p>}
      </div>
      <button
        onClick={() => onDismiss(toast.id)}
        className="text-lg leading-none opacity-60 hover:opacity-100 transition-opacity flex-shrink-0"
        aria-label="Dismiss"
      >
        ×
      </button>
    </div>
  )
}
