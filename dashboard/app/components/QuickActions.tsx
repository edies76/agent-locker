"use client"

import { useState } from 'react'
import { apiCache } from '@/lib/cache'
import { resolveBackendEndpoint } from '@/lib/backendEndpoint'
import { useToast } from './Toast'

interface QuickAction {
  id: string
  label: string
  icon: string
  description: string
  action: () => Promise<void>
  variant: 'primary' | 'secondary' | 'danger'
}

export default function QuickActions() {
  const [loading, setLoading] = useState<string | null>(null)
  const { showToast } = useToast()

  const actions: QuickAction[] = [
    {
      id: 'clear-cache',
      label: 'Clear Cache',
      icon: '🧹',
      description: 'Clear all cached API responses',
      variant: 'secondary',
      action: async () => {
        setLoading('clear-cache')
        try {
          apiCache.clear()
          showToast({ type: 'success', title: 'Cache cleared successfully', duration: 3000 })
        } catch (error) {
          showToast({ type: 'error', title: 'Failed to clear cache', duration: 3000 })
        } finally {
          setLoading(null)
        }
      },
    },
    {
      id: 'refresh-all',
      label: 'Force Refresh',
      icon: '🔄',
      description: 'Invalidate cache and reload all data',
      variant: 'primary',
      action: async () => {
        setLoading('refresh-all')
        try {
          apiCache.invalidatePattern('.*')
          showToast({ type: 'success', title: 'Data refreshed', duration: 3000 })
          // Trigger page reload after short delay
          setTimeout(() => window.location.reload(), 500)
        } catch (error) {
          showToast({ type: 'error', title: 'Failed to refresh data', duration: 3000 })
        } finally {
          setLoading(null)
        }
      },
    },
    {
      id: 'export-logs',
      label: 'Export Logs',
      icon: '📥',
      description: 'Download audit logs as JSON',
      variant: 'secondary',
      action: async () => {
        setLoading('export-logs')
        try {
          const { baseUrl } = await resolveBackendEndpoint()
          const url = `${baseUrl}/dashboard/activity?limit=1000`
          const response = await fetch(url)
          const data = await response.json()
          
          const blob = new Blob([JSON.stringify(data, null, 2)], {
            type: 'application/json',
          })
          const downloadUrl = URL.createObjectURL(blob)
          const a = document.createElement('a')
          a.href = downloadUrl
          a.download = `agent-lock-logs-${new Date().toISOString()}.json`
          a.click()
          URL.revokeObjectURL(downloadUrl)
          
          showToast({ type: 'success', title: `Exported ${data.length} log entries`, duration: 3000 })
        } catch (error) {
          showToast({ type: 'error', title: 'Failed to export logs', duration: 3000 })
        } finally {
          setLoading(null)
        }
      },
    },
    {
      id: 'test-backend',
      label: 'Test Backend',
      icon: '🔍',
      description: 'Check backend connectivity',
      variant: 'secondary',
      action: async () => {
        setLoading('test-backend')
        try {
          const start = Date.now()
          const { baseUrl } = await resolveBackendEndpoint()
          const url = `${baseUrl}/health`
          const response = await fetch(url)
          const elapsed = Date.now() - start
          
          if (response.ok) {
            showToast({ type: 'success', title: `Backend online (${elapsed}ms)`, duration: 3000 })
          } else {
            showToast({ type: 'error', title: 'Backend returned error', duration: 3000 })
          }
        } catch (error) {
          showToast({ type: 'error', title: 'Backend unreachable', duration: 3000 })
        } finally {
          setLoading(null)
        }
      },
    },
  ]

  return (
    <div className="bg-brand-card border border-brand-border rounded-xl p-5">
      <h2 className="text-base font-semibold text-slate-200 mb-4">Quick Actions</h2>

      <div className="grid grid-cols-2 gap-3">
        {actions.map((action) => {
          const isLoading = loading === action.id
          const buttonClass =
            action.variant === 'primary'
              ? 'bg-indigo-600 hover:bg-indigo-700 text-white'
              : action.variant === 'danger'
              ? 'bg-red-600 hover:bg-red-700 text-white'
              : 'bg-brand-bg border border-brand-border hover:bg-slate-800 text-slate-200'

          return (
            <button
              key={action.id}
              onClick={action.action}
              disabled={isLoading}
              className={`
                ${buttonClass}
                p-4 rounded-lg text-left transition-all
                disabled:opacity-50 disabled:cursor-not-allowed
                group relative overflow-hidden
              `}
            >
              {/* Hover effect */}
              <div className="absolute inset-0 bg-white/5 opacity-0 group-hover:opacity-100 transition-opacity" />

              <div className="relative">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xl">{action.icon}</span>
                  <span className="text-sm font-semibold">
                    {isLoading ? 'Loading...' : action.label}
                  </span>
                </div>
                <p className="text-xs text-slate-400">{action.description}</p>
              </div>

              {isLoading && (
                <div className="absolute top-2 right-2">
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                </div>
              )}
            </button>
          )
        })}
      </div>

      {/* Cache info */}
      <div className="mt-4 p-3 bg-brand-bg rounded-lg border border-brand-border/50">
        <div className="flex items-center justify-between text-xs">
          <span className="text-slate-500">Cache Status</span>
          <span className="text-slate-400 font-mono">
            {apiCache.sizeGetter} entries · {Math.round(apiCache.memoryUsage() / 1024)}KB
          </span>
        </div>
      </div>
    </div>
  )
}
