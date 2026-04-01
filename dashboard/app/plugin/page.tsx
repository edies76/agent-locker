"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import Link from "next/link"
import { Badge, Button, Card } from "../components/ui"
import { useToast } from "../components/Toast"
import {
  approveAction,
  createPluginPairing,
  fetchPending,
  fetchPluginActions,
  fetchPluginPairings,
  fetchPluginStatus,
  setPluginPairingChannel,
} from "@/lib/api"
import { Action, PluginActionsResponse, PluginPairing, PluginPairingsResponse, PluginStatus } from "@/types"

type MessageType = "user" | "assistant" | "system" | "approval"

interface Message {
  id: string
  type: MessageType
  content: string
  timestamp: Date
  approval?: Action
}

type PreferredChannel = "agentlock_dashboard" | "whatsapp" | "telegram"

function formatAgo(seconds: number | null): string {
  if (seconds == null) return "unknown"
  if (seconds < 60) return `${seconds}s ago`
  const m = Math.floor(seconds / 60)
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  return `${h}h ago`
}

function MessageBubble({
  message,
  onApprove,
  onReject,
}: {
  message: Message
  onApprove?: () => void
  onReject?: () => void
}) {
  const isUser = message.type === "user"
  const isSystem = message.type === "system"
  const isApproval = message.type === "approval"

  if (isApproval && message.approval) {
    const action = message.approval
    return (
      <div className="my-4 flex justify-center">
        <Card className="w-full max-w-md" padding="md">
          <div className="mb-3 flex items-center gap-2">
            <Badge variant={action.risk_level === "CRITICAL" ? "danger" : action.risk_level === "HIGH" ? "warning" : "success"}>
              {action.risk_level}
            </Badge>
            <span className="text-xs" style={{ color: "var(--text-muted)" }}>
              Approval Required
            </span>
          </div>

          <h4 className="font-mono text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
            {action.tool_name}
          </h4>

          {action.analysis && (
            <p className="mt-2 text-sm" style={{ color: "var(--text-secondary)" }}>
              {action.analysis}
            </p>
          )}

          <div className="mt-4 flex gap-2">
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
      <div className="my-2 flex justify-center">
        <span
          className="rounded-full px-3 py-1 text-xs"
          style={{ background: "var(--bg-tertiary)", color: "var(--text-muted)" }}
        >
          {message.content}
        </span>
      </div>
    )
  }

  return (
    <div className={`mb-3 flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[78%] rounded-2xl px-4 py-2.5 ${isUser ? "rounded-br-md" : "rounded-bl-md"}`}
        style={{
          background: isUser ? "var(--accent-primary)" : "var(--bg-elevated)",
          color: isUser ? "white" : "var(--text-primary)",
          border: isUser ? "none" : "1px solid var(--border-primary)",
        }}
      >
        <p className="whitespace-pre-wrap text-sm">{message.content}</p>
        <p className={`mt-1 text-xs ${isUser ? "text-white/70" : ""}`} style={{ color: isUser ? undefined : "var(--text-muted)" }}>
          {message.timestamp.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
        </p>
      </div>
    </div>
  )
}

export default function PluginPage() {
  const { showToast } = useToast()

  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState("")
  const [pending, setPending] = useState<Action[]>([])
  const [pluginStatus, setPluginStatus] = useState<PluginStatus | null>(null)
  const [pluginActions, setPluginActions] = useState<Action[]>([])
  const [pairings, setPairings] = useState<PluginPairing[]>([])
  const [loadingState, setLoadingState] = useState(false)
  const [sending, setSending] = useState(false)
  const [creatingToken, setCreatingToken] = useState(false)
  const [preferredChannel, setPreferredChannel] = useState<PreferredChannel>("agentlock_dashboard")
  const [latestToken, setLatestToken] = useState("")

  const messagesEndRef = useRef<HTMLDivElement>(null)

  const connected = useMemo(() => {
    return !!pluginStatus?.connected
  }, [pluginStatus?.connected])

  const loadOperationalData = useCallback(async () => {
    setLoadingState(true)
    try {
      const [statusRes, actionsRes, pendingRes, pairingsRes] = await Promise.all([
        fetchPluginStatus({ refresh: true }) as Promise<PluginStatus>,
        fetchPluginActions(8, { refresh: true }) as Promise<PluginActionsResponse>,
        fetchPending(),
        fetchPluginPairings({ refresh: true }) as Promise<PluginPairingsResponse>,
      ])

      setPluginStatus(statusRes)
      setPluginActions(Array.isArray(actionsRes?.items) ? actionsRes.items : [])
      setPairings(Array.isArray(pairingsRes?.items) ? pairingsRes.items : [])
      if (statusRes?.pairing?.token) {
        setLatestToken(statusRes.pairing.token)
      }

      if (Array.isArray(pendingRes)) {
        setPending(pendingRes)
        pendingRes.forEach((action) => {
          setMessages((prev) => {
            const exists = prev.some((m) => m.type === "approval" && m.approval?.action_id === action.action_id)
            if (exists) return prev
            return [
              ...prev,
              {
                id: `approval-${action.action_id}`,
                type: "approval",
                content: "",
                timestamp: new Date(action.timestamp),
                approval: action,
              },
            ]
          })
        })
      }
    } catch (error) {
      console.error("Failed to load plugin data", error)
    } finally {
      setLoadingState(false)
    }
  }, [])

  useEffect(() => {
    setMessages([
      {
        id: "welcome",
        type: "system",
        content: connected
          ? "OpenClaw paired. You can review plugin actions and chat from this panel."
          : "Generate a pairing token, put it in OpenClaw Agent-Lock config, and heartbeat will connect here.",
        timestamp: new Date(),
      },
    ])
  }, [connected])

  useEffect(() => {
    void loadOperationalData()
    const interval = setInterval(() => {
      void loadOperationalData()
    }, 5000)
    return () => clearInterval(interval)
  }, [loadOperationalData])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" })
  }, [messages, sending])

  const handleCreatePairing = async () => {
    setCreatingToken(true)
    try {
      const res = await createPluginPairing({
        label: "OpenClaw",
        preferred_channel: preferredChannel,
      })
      if (!res?.ok || !res?.pairing?.token) {
        throw new Error(res?.error || "Could not create pairing token")
      }
      setLatestToken(String(res.pairing.token))
      await loadOperationalData()
      showToast({ type: "success", title: "Pairing token created" })
    } catch (error) {
      showToast({
        type: "error",
        title: "Pairing failed",
        message: error instanceof Error ? error.message : "Unknown pairing error",
      })
    } finally {
      setCreatingToken(false)
    }
  }

  const handleSetPreferredChannel = async (pairingId: string, channel: PreferredChannel) => {
    try {
      const res = await setPluginPairingChannel(pairingId, channel)
      if (!res?.ok) {
        throw new Error(res?.error || "Could not update channel")
      }
      await loadOperationalData()
      showToast({ type: "success", title: "Preferred channel updated" })
    } catch (error) {
      showToast({
        type: "error",
        title: "Update failed",
        message: error instanceof Error ? error.message : "Unknown update error",
      })
    }
  }

  async function handleApproval(actionId: string, decision: "YES" | "NO") {
    try {
      await approveAction(actionId, decision)
      setMessages((prev) => prev.filter((m) => !(m.type === "approval" && m.approval?.action_id === actionId)))
      setMessages((prev) => [
        ...prev,
        {
          id: `decision-${actionId}`,
          type: "system",
          content: `Tool call ${decision === "YES" ? "approved" : "rejected"}.`,
          timestamp: new Date(),
        },
      ])
      setPending((prev) => prev.filter((a) => a.action_id !== actionId))
      showToast({ type: decision === "YES" ? "success" : "error", title: "Decision applied" })
    } catch {
      showToast({ type: "error", title: "Approval failed" })
    }
  }

  async function sendMessage() {
    const text = input.trim()
    if (!text || sending) return

    if (!connected) {
      showToast({
        type: "info",
        title: "OpenClaw not connected",
        message: "Connect OpenClaw first to use direct dashboard chat.",
      })
      return
    }

    const userMessage: Message = {
      id: `user-${Date.now()}`,
      type: "user",
      content: text,
      timestamp: new Date(),
    }

    const next = [...messages, userMessage]
    setMessages([...next, {
      id: `assistant-${Date.now()}`,
      type: "assistant",
      content: "Searching Agent-Lock and plugin context...",
      timestamp: new Date(),
    }])
    setInput("")
    setSending(true)

    try {
      const context = JSON.stringify({
        plugin_status: pluginStatus,
        plugin_recent_actions: pluginActions.slice(0, 5).map((a) => ({
          action_id: a.action_id,
          tool_name: a.tool_name,
          decision: a.decision,
          risk_level: a.risk_level,
          timestamp: a.timestamp,
        })),
        pending_count: pending.length,
      })

      const llmMessages = next
        .filter((m) => m.type === "user" || m.type === "assistant")
        .map((m) => ({ role: m.type === "user" ? "user" : "assistant", content: m.content }))

      const res = await fetch("/api/agent-lock-ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: llmMessages.slice(-30),
          context,
          stream: true,
        }),
      })

      if (!res.ok) {
        const ct = res.headers.get("content-type") || ""
        let message = "Agent-Lock AI request failed"
        if (ct.includes("application/json")) {
          const data = await res.json().catch(() => ({}))
          message = String(data?.error || message)
        } else {
          const raw = await res.text().catch(() => "")
          if (raw.trim()) message = raw.trim()
        }
        throw new Error(message)
      }

      if (!res.body) {
        throw new Error("No stream body returned from AI route")
      }

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let assistantText = ""

      while (true) {
        const { value, done } = await reader.read()
        if (done) break
        assistantText += decoder.decode(value, { stream: true })

        setMessages((prev) => {
          const updated = [...prev]
          updated[updated.length - 1] = {
            id: updated[updated.length - 1].id,
            type: "assistant",
            content: assistantText,
            timestamp: updated[updated.length - 1].timestamp,
          }
          return updated
        })
      }

      const tail = decoder.decode()
      if (tail) {
        assistantText += tail
      }

      if (!assistantText.trim()) {
        setMessages((prev) => {
          const updated = [...prev]
          updated[updated.length - 1] = {
            id: updated[updated.length - 1].id,
            type: "assistant",
            content: "No response was returned.",
            timestamp: updated[updated.length - 1].timestamp,
          }
          return updated
        })
      }
    } catch (error) {
      setMessages((prev) => {
        const updated = [...prev]
        updated[updated.length - 1] = {
          id: updated[updated.length - 1].id,
          type: "assistant",
          content: error instanceof Error ? `Assistant error: ${error.message}` : "Unexpected assistant error",
          timestamp: updated[updated.length - 1].timestamp,
        }
        return updated
      })
    } finally {
      setSending(false)
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      void sendMessage()
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="page-title">OpenClaw Plugin Console</h1>
          <p className="page-subtitle">Plugin state, recent plugin actions, approvals, and direct chat</p>
        </div>
        <Link href="/settings" className="inline-flex">
          <Button variant="secondary" size="sm">Advanced Settings</Button>
        </Link>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card padding="md" className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold" style={{ color: "var(--text-primary)" }}>Plugin Status</h3>
            {pluginStatus?.connected ? <Badge variant="success">Connected</Badge> : <Badge variant="warning">Disconnected</Badge>}
          </div>

          <div className="grid grid-cols-2 gap-3 text-sm">
            <div className="rounded-lg p-3" style={{ background: "var(--bg-tertiary)" }}>
              <p style={{ color: "var(--text-muted)" }}>Last seen</p>
              <p style={{ color: "var(--text-primary)" }}>{formatAgo(pluginStatus?.seconds_ago ?? null)}</p>
            </div>
            <div className="rounded-lg p-3" style={{ background: "var(--bg-tertiary)" }}>
              <p style={{ color: "var(--text-muted)" }}>Actions (24h)</p>
              <p style={{ color: "var(--text-primary)" }}>{pluginStatus?.actions_last_24h ?? 0}</p>
            </div>
            <div className="rounded-lg p-3" style={{ background: "var(--bg-tertiary)" }}>
              <p style={{ color: "var(--text-muted)" }}>Pending</p>
              <p style={{ color: "var(--text-primary)" }}>{pluginStatus?.pending ?? 0}</p>
            </div>
            <div className="rounded-lg p-3" style={{ background: "var(--bg-tertiary)" }}>
              <p style={{ color: "var(--text-muted)" }}>Approved / Blocked</p>
              <p style={{ color: "var(--text-primary)" }}>{pluginStatus?.approved ?? 0} / {pluginStatus?.blocked ?? 0}</p>
            </div>
          </div>

          <p className="text-xs" style={{ color: "var(--text-muted)" }}>
            {pluginStatus?.message || "Waiting for plugin telemetry..."}
          </p>
        </Card>

        <Card padding="md" className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold" style={{ color: "var(--text-primary)" }}>Pair OpenClaw + Choose Channel</h3>
            {connected ? <Badge variant="success">Paired</Badge> : <Badge variant="neutral">Not Paired</Badge>}
          </div>

          <div className="space-y-2">
            <p className="text-xs" style={{ color: "var(--text-muted)" }}>
              Preferred control channel
            </p>
            <select
              value={preferredChannel}
              onChange={(e) => setPreferredChannel(e.target.value as PreferredChannel)}
              className="input w-full"
            >
              <option value="agentlock_dashboard">AgentLock Dashboard</option>
              <option value="whatsapp">WhatsApp</option>
              <option value="telegram">Telegram</option>
            </select>
          </div>

          <div className="flex gap-2">
            <Button size="sm" variant="primary" onClick={() => void handleCreatePairing()} loading={creatingToken}>
              Generate Connection Token
            </Button>
          </div>

          <div className="rounded-lg border p-3 text-xs" style={{ borderColor: "var(--border-primary)", background: "var(--bg-tertiary)" }}>
            <p style={{ color: "var(--text-muted)" }}>Connection token (paste into OpenClaw Agent-Lock config):</p>
            <p className="mt-1 break-all font-mono" style={{ color: "var(--text-primary)" }}>
              {latestToken || "Generate a token first"}
            </p>
            <p className="mt-2" style={{ color: "var(--text-muted)" }}>
              agent-lock.config.json snippet:
            </p>
            <pre className="mt-1 overflow-x-auto rounded bg-black/30 p-2 font-mono text-[11px]">
{`{
  "dashboard_bridge_token": "${latestToken || "<TOKEN>"}",
  "preferred_channel": "${preferredChannel}"
}`}
            </pre>
          </div>

          {pairings.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs" style={{ color: "var(--text-muted)" }}>Registered pairings</p>
              {pairings.slice(0, 3).map((pairing) => (
                <div
                  key={pairing.pairing_id}
                  className="rounded-lg border p-2"
                  style={{ borderColor: "var(--border-primary)", background: "var(--bg-tertiary)" }}
                >
                  <div className="mb-2 flex items-center justify-between">
                    <span className="text-xs font-semibold" style={{ color: "var(--text-primary)" }}>{pairing.label}</span>
                    <Badge variant={pairing.connected ? "success" : "warning"}>{pairing.connected ? "online" : "offline"}</Badge>
                  </div>
                  <div className="flex items-center gap-2">
                    <select
                      className="input h-8 flex-1"
                      value={pairing.preferred_channel}
                      onChange={(e) => void handleSetPreferredChannel(pairing.pairing_id, e.target.value as PreferredChannel)}
                    >
                      <option value="agentlock_dashboard">agentlock_dashboard</option>
                      <option value="whatsapp">whatsapp</option>
                      <option value="telegram">telegram</option>
                    </select>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
        <Card className="flex h-[calc(100vh-260px)] flex-col overflow-hidden" padding="none">
          <div className="flex-1 overflow-y-auto p-4">
            {messages.map((message) => (
              <MessageBubble
                key={message.id}
                message={message}
                onApprove={message.approval ? () => handleApproval(message.approval!.action_id, "YES") : undefined}
                onReject={message.approval ? () => handleApproval(message.approval!.action_id, "NO") : undefined}
              />
            ))}
            {sending && (
              <div className="my-2 flex justify-center">
                <span className="rounded-full px-3 py-1 text-xs" style={{ background: "var(--bg-tertiary)", color: "var(--text-muted)" }}>
                  Thinking...
                </span>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          <div className="p-4">
            <div className="flex gap-2">
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={connected ? "Type your message..." : "Connect OpenClaw first to chat from this panel"}
                rows={1}
                className="input flex-1 resize-none"
                style={{ minHeight: "42px", maxHeight: "120px" }}
                disabled={!connected}
              />
              <Button variant="primary" onClick={() => void sendMessage()} disabled={!input.trim() || !connected || sending}>
                Send
              </Button>
            </div>
            <p className="mt-2 text-xs" style={{ color: "var(--text-muted)" }}>
              Enter to send, Shift+Enter for new line
            </p>
          </div>
        </Card>

        <Card padding="md" className="h-[calc(100vh-260px)] overflow-y-auto">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="font-semibold" style={{ color: "var(--text-primary)" }}>Recent Plugin Actions</h3>
            {loadingState && <span className="text-xs" style={{ color: "var(--text-muted)" }}>Refreshing...</span>}
          </div>

          <div className="space-y-2">
            {pluginActions.length === 0 && (
              <p className="text-sm" style={{ color: "var(--text-muted)" }}>
                No plugin actions detected yet.
              </p>
            )}

            {pluginActions.map((item) => (
              <div key={item.action_id} className="rounded-lg border p-3" style={{ borderColor: "var(--border-primary)", background: "var(--bg-tertiary)" }}>
                <div className="mb-2 flex items-center justify-between gap-2">
                  <span className="truncate text-xs font-semibold" style={{ color: "var(--text-primary)" }}>{item.tool_name}</span>
                  <Badge variant={item.risk_level === "CRITICAL" ? "danger" : item.risk_level === "HIGH" ? "warning" : "success"}>
                    {item.risk_level}
                  </Badge>
                </div>
                <p className="text-xs" style={{ color: "var(--text-secondary)" }}>
                  {item.decision} · {new Date(item.timestamp).toLocaleString()}
                </p>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  )
}
