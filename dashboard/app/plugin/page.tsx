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
import { resolveBackendEndpoint } from "@/lib/backendEndpoint"
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
  const [socketConnected, setSocketConnected] = useState(false)

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const socketRef = useRef<WebSocket | null>(null)

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
          ? "OpenClaw plugin connected. You can review plugin actions and chat from this panel."
          : "Generate a pairing token, add it to the OpenClaw plugin config, and heartbeat will connect here.",
        timestamp: new Date(),
      },
    ])
  }, [connected])

  useEffect(() => {
    let cancelled = false
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null

    const connect = async () => {
      try {
        const { baseUrl } = await resolveBackendEndpoint(true)
        if (cancelled) return

        const wsUrl = baseUrl.replace(/^http/i, "ws") + "/ws"
        const ws = new WebSocket(wsUrl)
        socketRef.current = ws

        ws.onopen = () => {
          if (cancelled) return
          setSocketConnected(true)
          setMessages((prev) => {
            const exists = prev.some((m) => m.id === "ws-connected")
            if (exists) return prev
            return [
              ...prev,
              {
                id: "ws-connected",
                type: "system",
                content: "Realtime gateway bridge connected.",
                timestamp: new Date(),
              },
            ]
          })
        }

        ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data as string)

            if (data?.type === "error") {
              showToast({
                type: "error",
                title: "Gateway unavailable",
                message: String(data?.message || "Could not deliver message to gateway"),
              })
              return
            }

            const method = String(data?.method || "")
            const params = data?.params || {}
            if (method !== "chat.send") return

            const channel = String(params?.channel || "")
            if (channel && channel !== "agentlock_dashboard") return

            const text = String(params?.text || "").trim()
            if (!text) return

            setMessages((prev) => [
              ...prev,
              {
                id: `assistant-${Date.now()}`,
                type: "assistant",
                content: text,
                timestamp: new Date(),
              },
            ])
          } catch {
            // Ignore malformed WS payloads to keep chat resilient.
          }
        }

        ws.onclose = () => {
          if (cancelled) return
          setSocketConnected(false)
          reconnectTimer = setTimeout(() => {
            void connect()
          }, 2000)
        }

        ws.onerror = () => {
          ws.close()
        }
      } catch {
        if (cancelled) return
        reconnectTimer = setTimeout(() => {
          void connect()
        }, 2000)
      }
    }

    void connect()

    return () => {
      cancelled = true
      if (reconnectTimer) clearTimeout(reconnectTimer)
      if (socketRef.current) {
        socketRef.current.close()
        socketRef.current = null
      }
      setSocketConnected(false)
    }
  }, [showToast])

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
        label: "OpenClaw Plugin",
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

  const buildConfigJson = useCallback(() => {
    return JSON.stringify(
      {
        dashboard_bridge_token: latestToken || "<TOKEN>",
        preferred_channel: preferredChannel,
        available_channels: ["agentlock_dashboard", "whatsapp", "telegram"],
        client_label: "openclaw",
      },
      null,
      2
    )
  }, [latestToken, preferredChannel])

  const copyText = async (text: string, okTitle: string) => {
    try {
      await navigator.clipboard.writeText(text)
      showToast({ type: "success", title: okTitle })
    } catch {
      showToast({ type: "error", title: "Copy failed" })
    }
  }

  const downloadConfig = () => {
    const blob = new Blob([buildConfigJson()], { type: "application/json" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = "agent-lock.config.json"
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
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
        title: "OpenClaw plugin not connected",
        message: "Connect the OpenClaw plugin first to use direct dashboard chat.",
      })
      return
    }

    const userMessage: Message = {
      id: `user-${Date.now()}`,
      type: "user",
      content: text,
      timestamp: new Date(),
    }

    setMessages((prev) => [...prev, userMessage])
    setInput("")
    setSending(true)

    try {
      const socket = socketRef.current
      if (!socket || socket.readyState !== WebSocket.OPEN) {
        throw new Error("Realtime bridge is disconnected")
      }

      socket.send(
        JSON.stringify({
          method: "chat.inject",
          params: {
            channel: "agentlock_dashboard",
            text,
            source: "agent_lock_dashboard",
            timestamp: new Date().toISOString(),
          },
        })
      )
    } catch (error) {
      showToast({
        type: "error",
        title: "Send failed",
        message: error instanceof Error ? error.message : "Unexpected gateway send error",
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
      <Card padding="md" className="border-[var(--border-primary)] bg-[var(--bg-elevated)]">
        <div className="grid gap-4 lg:grid-cols-[1.3fr_0.9fr] lg:items-center">
          <div className="space-y-3">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[var(--text-muted)]">Plugin workflow</p>
            <h1 className="page-title">Plugin Console</h1>
            <p className="page-subtitle">
              Create a pairing token, connect the bridge, and review approvals or chat in one place.
            </p>
          </div>
          <div className="grid gap-2 sm:grid-cols-3">
            {[
              { step: "1", title: "Pair", copy: "Generate a token and connect the bridge." },
              { step: "2", title: "Review", copy: "Approve or reject sensitive actions." },
              { step: "3", title: "Chat", copy: "Talk to the assistant from the same surface." },
            ].map((item) => (
              <div key={item.step} className="rounded-xl border border-[var(--border-primary)] bg-[var(--bg-secondary)] p-3">
                <div className="flex items-center gap-2">
                  <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[var(--accent-primary)] text-xs font-semibold text-white">
                    {item.step}
                  </span>
                  <p className="text-sm font-semibold text-[var(--text-primary)]">{item.title}</p>
                </div>
                <p className="mt-2 text-xs leading-5 text-[var(--text-secondary)]">{item.copy}</p>
              </div>
            ))}
          </div>
        </div>
      </Card>

      <div className="flex items-center justify-between">
        <Link href="/settings" className="inline-flex">
          <Button variant="secondary" size="sm">Advanced Settings</Button>
        </Link>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card padding="md" className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold" style={{ color: "var(--text-primary)" }}>Plugin Status</h3>
            <div className="flex items-center gap-2">
              <Badge variant={pluginStatus?.connected ? "success" : "warning"}>{pluginStatus?.connected ? "Plugin Online" : "Plugin Offline"}</Badge>
              <Badge variant={socketConnected ? "success" : "warning"}>{socketConnected ? "WS Bridge Online" : "WS Bridge Offline"}</Badge>
            </div>
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
            <h3 className="font-semibold" style={{ color: "var(--text-primary)" }}>Create pairing + choose channel</h3>
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
              <option value="agentlock_dashboard">Dashboard control channel</option>
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
            <p className="mb-2" style={{ color: "var(--text-muted)" }}>
              Cloud-first setup: no local backend commands needed for end users.
            </p>
            <p style={{ color: "var(--text-muted)" }}>Connection token for the OpenClaw plugin:</p>
            <p className="mt-1 break-all font-mono" style={{ color: "var(--text-primary)" }}>
              {latestToken || "Generate a token first"}
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              <Button size="sm" variant="secondary" onClick={() => void copyText(latestToken || "", "Token copied")} disabled={!latestToken}>
                Copy Token
              </Button>
              <Button size="sm" variant="secondary" onClick={() => void copyText(buildConfigJson(), "Config copied")}>
                Copy Config JSON
              </Button>
              <Button size="sm" variant="secondary" onClick={downloadConfig}>
                Download Config
              </Button>
            </div>
            <p className="mt-2" style={{ color: "var(--text-muted)" }}>
              agent-lock.config.json snippet:
            </p>
            <pre className="mt-1 overflow-x-auto rounded bg-black/30 p-2 font-mono text-[11px]">
{buildConfigJson()}
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
                placeholder={connected ? "Type your message..." : "Connect the OpenClaw plugin first to chat from this panel"}
                rows={1}
                className="input flex-1 resize-none"
                style={{ minHeight: "42px", maxHeight: "120px" }}
                disabled={!connected}
              />
              <Button variant="primary" onClick={() => void sendMessage()} disabled={!input.trim() || !connected || !socketConnected || sending}>
                Send
              </Button>
            </div>
            <p className="mt-2 text-xs" style={{ color: "var(--text-muted)" }}>
              Enter to send, Shift+Enter for new line · Routed through plugin gateway WS
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
