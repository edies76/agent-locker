"use client"

import { useEffect, useState, useCallback, useRef } from "react"
import { fetchPending, approveAction } from "@/lib/api"
import { Action } from "@/types"
import { Card, Badge, Button } from "../components/ui"
import { useToast } from "../components/Toast"

function ApprovalCard({
  action,
  onDecision,
  isSelected,
  onSelect,
}: {
  action: Action
  onDecision: (id: string, decision: "YES" | "NO") => Promise<void>
  isSelected: boolean
  onSelect: () => void
}) {
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState<"approved" | "rejected" | null>(null)
  const [showArgs, setShowArgs] = useState(false)
  const cardRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (isSelected && cardRef.current) {
      cardRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }
  }, [isSelected])

  async function handleDecision(decision: "YES" | "NO") {
    setLoading(true)
    try {
      await onDecision(action.action_id, decision)
      setDone(decision === "YES" ? "approved" : "rejected")
    } catch {
      setLoading(false)
    }
  }

  if (done) {
    return (
      <Card 
        className="flex flex-col items-center justify-center min-h-[200px]"
        style={{ borderColor: done === 'approved' ? 'var(--success)' : 'var(--danger)' }}
      >
        <div className="text-4xl mb-2">{done === "approved" ? "✓" : "✕"}</div>
        <p className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>
          {done === "approved" ? "Approved" : "Rejected"}
        </p>
        <p className="text-sm font-mono mt-1" style={{ color: 'var(--text-muted)' }}>{action.tool_name}</p>
      </Card>
    )
  }

  const riskColors: Record<string, string> = {
    LOW: 'var(--success)',
    HIGH: 'var(--warning)',
    CRITICAL: 'var(--danger)'
  }

  const intentScore = action.intent_score ?? 0
  const scoreColor = intentScore > 0.7 ? 'var(--success)' : intentScore > 0.4 ? 'var(--warning)' : 'var(--danger)'

  return (
    <Card
      ref={cardRef}
      onClick={onSelect}
      padding="none"
      className={`cursor-pointer transition-all ${isSelected ? 'ring-2' : ''}`}
      style={{
        borderLeftWidth: '3px',
        borderLeftColor: riskColors[action.risk_level] || 'var(--border-primary)',
        ...(isSelected ? { boxShadow: '0 0 0 2px var(--accent-primary)' } : {})
      }}
    >
      {/* Header */}
      <div className="px-4 py-3" style={{ borderBottom: '1px solid var(--border-primary)' }}>
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="font-semibold font-mono" style={{ color: 'var(--text-primary)' }}>
              {action.tool_name}
            </h3>
            {action.agent_id && (
              <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                from {action.agent_id}
              </p>
            )}
          </div>
          <Badge 
            variant={action.risk_level === 'CRITICAL' ? 'danger' : action.risk_level === 'HIGH' ? 'warning' : 'success'}
          >
            {action.risk_level}
          </Badge>
        </div>
        <p className="text-xs mt-2" style={{ color: 'var(--text-muted)' }}>
          {new Date(action.timestamp).toLocaleString()}
        </p>
      </div>

      {/* Body */}
      <div className="px-4 py-3 space-y-3">
        {action.user_intent && (
          <div>
            <p className="text-xs font-medium mb-1" style={{ color: 'var(--text-tertiary)' }}>User Intent</p>
            <p className="text-sm italic px-3 py-2 rounded" style={{ 
              color: 'var(--text-secondary)', 
              background: 'var(--accent-muted)' 
            }}>
              &ldquo;{action.user_intent}&rdquo;
            </p>
          </div>
        )}

        {action.analysis && (
          <div>
            <p className="text-xs font-medium mb-1" style={{ color: 'var(--text-tertiary)' }}>Analysis</p>
            <p className="text-sm px-3 py-2 rounded" style={{ 
              color: 'var(--text-secondary)', 
              background: 'var(--bg-tertiary)' 
            }}>
              {action.analysis}
            </p>
          </div>
        )}

        {/* Score */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-medium" style={{ color: 'var(--text-tertiary)' }}>Intent Score</span>
            <span className="text-xs font-mono" style={{ color: 'var(--text-secondary)' }}>
              {Math.round(intentScore * 100)}%
            </span>
          </div>
          <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--bg-tertiary)' }}>
            <div 
              className="h-full rounded-full transition-all" 
              style={{ 
                width: `${intentScore * 100}%`, 
                background: scoreColor
              }} 
            />
          </div>
        </div>

        {/* Args toggle */}
        <button
          onClick={(e) => { e.stopPropagation(); setShowArgs(!showArgs); }}
          className="text-xs font-medium flex items-center gap-1 transition-colors"
          style={{ color: 'var(--text-tertiary)' }}
        >
          {showArgs ? '▼' : '▶'} Arguments ({Object.keys(action.args ?? {}).length})
        </button>
        {showArgs && (
          <pre className="text-xs p-3 rounded overflow-auto max-h-32 font-mono" style={{ 
            background: 'var(--bg-tertiary)', 
            color: 'var(--text-secondary)' 
          }}>
            {JSON.stringify(action.args, null, 2)}
          </pre>
        )}
      </div>

      {/* Actions */}
      <div className="px-4 py-3 flex gap-2" style={{ borderTop: '1px solid var(--border-primary)' }}>
        <Button
          variant="success"
          className="flex-1"
          onClick={(e) => { e.stopPropagation(); handleDecision("YES"); }}
          disabled={loading}
          loading={loading}
        >
          Approve
        </Button>
        <Button
          variant="danger"
          className="flex-1"
          onClick={(e) => { e.stopPropagation(); handleDecision("NO"); }}
          disabled={loading}
        >
          Reject
        </Button>
      </div>
    </Card>
  )
}

export default function ApprovalsPage() {
  const [pending, setPending] = useState<Action[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [recentDecisions, setRecentDecisions] = useState<Record<string, number>>({})
  const { showToast } = useToast()

  const loadPending = useCallback(async () => {
    try {
      const data = await fetchPending()
      if (Array.isArray(data)) {
        const now = Date.now()
        const activeLocks = Object.fromEntries(
          Object.entries(recentDecisions).filter(([, expiresAt]) => expiresAt > now)
        )
        if (Object.keys(activeLocks).length !== Object.keys(recentDecisions).length) {
          setRecentDecisions(activeLocks)
        }

        setPending(data.filter((item) => !activeLocks[item.action_id]))
      }
    } catch (e) {
      console.error('Failed to load pending', e)
    }
    setLoading(false)
  }, [recentDecisions])

  useEffect(() => {
    loadPending()
    const interval = setInterval(loadPending, 3000)
    return () => clearInterval(interval)
  }, [loadPending])

  const handleDecision = useCallback(async (actionId: string, decision: "YES" | "NO") => {
    try {
      await approveAction(actionId, decision)
      showToast({ 
        type: decision === 'YES' ? 'success' : 'error', 
        title: decision === 'YES' ? 'Action approved' : 'Action rejected' 
      })
      setPending(p => p.filter(a => a.action_id !== actionId))
      setRecentDecisions((prev) => ({ ...prev, [actionId]: Date.now() + 15000 }))
      setSelectedIndex(i => Math.min(i, Math.max(0, pending.length - 2)))
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to process decision'
      const isStale = /already processed|not found|409|404/i.test(message)

      if (isStale) {
        setPending((p) => p.filter((a) => a.action_id !== actionId))
        showToast({ type: 'warning', title: 'Request was stale and was removed', message })
      } else {
        showToast({ type: 'error', title: 'Failed to process decision', message })
      }
      throw new Error('Failed')
    }
  }, [showToast, pending.length])

  // Keyboard shortcuts
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return
      
      const current = pending[selectedIndex]
      
      switch (e.key.toLowerCase()) {
        case 'j':
        case 'arrowdown':
          e.preventDefault()
          setSelectedIndex(i => Math.min(i + 1, pending.length - 1))
          break
        case 'k':
        case 'arrowup':
          e.preventDefault()
          setSelectedIndex(i => Math.max(i - 1, 0))
          break
        case 'y':
          if (current) handleDecision(current.action_id, 'YES')
          break
        case 'n':
          if (current) handleDecision(current.action_id, 'NO')
          break
      }
    }
    
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [pending, selectedIndex, handleDecision])

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="page-title">Approvals</h1>
          <p className="page-subtitle">
            {pending.length} pending {pending.length === 1 ? 'request' : 'requests'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs px-2 py-1 rounded" style={{ background: 'var(--bg-tertiary)', color: 'var(--text-muted)' }}>
            ↑↓ Navigate • Y Approve • N Reject
          </span>
          <Button variant="secondary" size="sm" onClick={loadPending}>
            Refresh
          </Button>
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[...Array(3)].map((_, i) => (
            <Card key={i} padding="lg">
              <div className="animate-pulse space-y-4">
                <div className="h-5 rounded" style={{ background: 'var(--bg-tertiary)', width: '60%' }} />
                <div className="h-16 rounded" style={{ background: 'var(--bg-tertiary)' }} />
                <div className="h-8 rounded" style={{ background: 'var(--bg-tertiary)' }} />
              </div>
            </Card>
          ))}
        </div>
      ) : pending.length === 0 ? (
        <Card className="text-center py-16">
          <div className="text-4xl mb-3">✓</div>
          <h3 className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>All caught up</h3>
          <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
            No pending approvals at the moment
          </p>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {pending.map((action, index) => (
            <ApprovalCard
              key={action.action_id}
              action={action}
              onDecision={handleDecision}
              isSelected={index === selectedIndex}
              onSelect={() => setSelectedIndex(index)}
            />
          ))}
        </div>
      )}
    </div>
  )
}
