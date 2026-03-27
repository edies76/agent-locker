"use client"

import { useEffect, useState, useRef, useCallback } from "react"
import Link from "next/link"
import { Card, Button, Badge } from "../components/ui"
import { useToast } from "../components/Toast"
import { fetchPending, approveAction } from "@/lib/api"
import { Action } from "@/types"

interface Message {
  id: string
  type: 'user' | 'agent' | 'system' | 'approval'
  content: string
  timestamp: Date
  approval?: Action
}

function MessageBubble({ message, onApprove, onReject }: { 
  message: Message
  onApprove?: () => void
  onReject?: () => void
}) {
  const isUser = message.type === 'user'
  const isSystem = message.type === 'system'
  const isApproval = message.type === 'approval'

  if (isApproval && message.approval) {
    const action = message.approval
    return (
      <div className="flex justify-center my-4">
        <Card className="max-w-md w-full" padding="md">
          <div className="flex items-center gap-2 mb-3">
            <Badge variant={action.risk_level === 'CRITICAL' ? 'danger' : action.risk_level === 'HIGH' ? 'warning' : 'success'}>
              {action.risk_level}
            </Badge>
            <span className="text-xs" style={{ color: 'var(--text-muted)' }}>Approval Required</span>
          </div>
          
          <h4 className="font-semibold font-mono text-sm" style={{ color: 'var(--text-primary)' }}>
            {action.tool_name}
          </h4>
          
          {action.analysis && (
            <p className="text-sm mt-2" style={{ color: 'var(--text-secondary)' }}>
              {action.analysis}
            </p>
          )}
          
          <div className="flex gap-2 mt-4">
            <Button variant="success" size="sm" className="flex-1" onClick={onApprove}>
              Approve
            </Button>
            <Button variant="danger" size="sm" className="flex-1" onClick={onReject}>
              Reject
            </Button>
          </div>
        </Card>
      </div>
    )
  }

  if (isSystem) {
    return (
      <div className="flex justify-center my-2">
        <span className="text-xs px-3 py-1 rounded-full" style={{ 
          background: 'var(--bg-tertiary)', 
          color: 'var(--text-muted)' 
        }}>
          {message.content}
        </span>
      </div>
    )
  }

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'} mb-3`}>
      <div 
        className={`max-w-[70%] px-4 py-2.5 rounded-2xl ${isUser ? 'rounded-br-md' : 'rounded-bl-md'}`}
        style={{ 
          background: isUser ? 'var(--accent-primary)' : 'var(--bg-elevated)',
          color: isUser ? 'white' : 'var(--text-primary)',
          border: isUser ? 'none' : '1px solid var(--border-primary)'
        }}
      >
        <p className="text-sm whitespace-pre-wrap">{message.content}</p>
        <p className={`text-xs mt-1 ${isUser ? 'text-white/70' : ''}`} style={{ color: isUser ? undefined : 'var(--text-muted)' }}>
          {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </p>
      </div>
    </div>
  )
}

export default function ChatPage() {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState("")
  const [connected, setConnected] = useState(false)
  const [openClawReady, setOpenClawReady] = useState(false)
  const [pending, setPending] = useState<Action[]>([])
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const { showToast } = useToast()

  // Load pending approvals and add them as messages
  const loadPending = useCallback(async () => {
    try {
      const data = await fetchPending()
      if (Array.isArray(data)) {
        setPending(data)
        // Add new approvals as messages
        data.forEach(action => {
          setMessages(prev => {
            const exists = prev.some(m => m.type === 'approval' && m.approval?.action_id === action.action_id)
            if (!exists) {
              return [...prev, {
                id: `approval-${action.action_id}`,
                type: 'approval' as const,
                content: '',
                timestamp: new Date(action.timestamp),
                approval: action
              }]
            }
            return prev
          })
        })
      }
    } catch (e) {
      console.error('Failed to load pending', e)
    }
  }, [])

  useEffect(() => {
    try {
      const raw = localStorage.getItem("openclaw_config")
      if (!raw) {
        setOpenClawReady(false)
        return
      }
      const cfg = JSON.parse(raw)
      setOpenClawReady(cfg?.isConnected === true)
    } catch {
      setOpenClawReady(false)
    }
  }, [])

  useEffect(() => {
    if (!openClawReady) return
    // Initial welcome message
    setMessages([
      {
        id: 'welcome',
        type: 'system',
        content: 'OpenClaw connected. Pending approvals are available here.',
        timestamp: new Date()
      }
    ])
    
    setConnected(true)
    loadPending()
    
    const interval = setInterval(loadPending, 3000)
    return () => clearInterval(interval)
  }, [loadPending, openClawReady])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  async function handleApproval(actionId: string, decision: "YES" | "NO") {
    try {
      await approveAction(actionId, decision)
      showToast({ 
        type: decision === 'YES' ? 'success' : 'error', 
        title: decision === 'YES' ? 'Action approved' : 'Action rejected' 
      })
      
      // Remove approval message
      setMessages(prev => prev.filter(m => !(m.type === 'approval' && m.approval?.action_id === actionId)))
      
      // Add system message
      setMessages(prev => [...prev, {
        id: `decision-${actionId}`,
        type: 'system',
        content: `Tool call ${decision === 'YES' ? 'approved' : 'rejected'}`,
        timestamp: new Date()
      }])
      
      setPending(p => p.filter(a => a.action_id !== actionId))
    } catch {
      showToast({ type: 'error', title: 'Failed to process decision' })
    }
  }

  function sendMessage() {
    if (!input.trim()) return
    showToast({
      type: "info",
      title: "Messaging backend pending",
      message: "Connect your OpenClaw transport in backend to enable real-time chat.",
    })
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  if (!openClawReady) {
    return (
      <div className="max-w-3xl space-y-4">
        <h1 className="page-title">Chat with OpenClaw</h1>
        <Card>
          <div className="space-y-3">
            <Badge variant="warning">Setup required</Badge>
            <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
              Before using chat, configure and connect OpenClaw from Settings.
            </p>
            <Link href="/settings" className="inline-flex">
              <Button variant="primary" size="sm">Go to Settings</Button>
            </Link>
          </div>
        </Card>
      </div>
    )
  }

  return (
    <div className="h-[calc(100vh-120px)] flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="page-title">Chat with OpenClaw</h1>
          <p className="page-subtitle">Communicate and approve actions directly</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-md" style={{ background: 'var(--bg-tertiary)' }}>
            <span className={`status-dot ${connected ? 'status-dot-success status-pulse' : 'status-dot-danger'}`} />
            <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>
              {connected ? 'Connected' : 'Disconnected'}
            </span>
          </div>
          {pending.length > 0 && (
            <Badge variant="warning">{pending.length} pending</Badge>
          )}
        </div>
      </div>

      {/* Messages */}
      <Card className="flex-1 flex flex-col overflow-hidden" padding="none">
        <div className="flex-1 overflow-y-auto p-4">
          {messages.map(message => (
            <MessageBubble 
              key={message.id} 
              message={message}
              onApprove={message.approval ? () => handleApproval(message.approval!.action_id, 'YES') : undefined}
              onReject={message.approval ? () => handleApproval(message.approval!.action_id, 'NO') : undefined}
            />
          ))}
          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div className="p-4" style={{ borderTop: '1px solid var(--border-primary)' }}>
          <div className="flex gap-2">
            <textarea
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Type a message..."
              rows={1}
              className="input flex-1 resize-none"
              style={{ minHeight: '42px', maxHeight: '120px' }}
            />
            <Button 
              variant="primary" 
              onClick={sendMessage}
              disabled={!input.trim()}
            >
              Send
            </Button>
          </div>
          <p className="text-xs mt-2" style={{ color: 'var(--text-muted)' }}>
            Press Enter to send, Shift+Enter for new line
          </p>
        </div>
      </Card>
    </div>
  )
}
