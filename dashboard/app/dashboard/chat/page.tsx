"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { Badge, Button, Card } from "../../components/ui"
import { useToast } from "../../components/Toast"
import { fetchPluginStatus } from "@/lib/api"
import { resolveBackendEndpoint } from "@/lib/backendEndpoint"
import type { PluginStatus } from "@/types"

interface ChatMessage {
  id: string
  role: "user" | "assistant" | "system"
  text: string
  ts: Date
}

export default function ChatPage() {
  const { showToast } = useToast()
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState("")
  const [socketConnected, setSocketConnected] = useState(false)
  const [sending, setSending] = useState(false)
  const [pluginStatus, setPluginStatus] = useState<PluginStatus | null>(null)

  const socketRef = useRef<WebSocket | null>(null)
  const endRef = useRef<HTMLDivElement>(null)

  const pluginConnected = useMemo(() => Boolean(pluginStatus?.connected), [pluginStatus?.connected])
  const quickPrompts = [
    "List my pending approvals and explain risk levels.",
    "Run a safe status check and summarize the result.",
    "Prepare a high-risk action so I can approve it manually.",
  ]

  useEffect(() => {
    let mounted = true
    ;(async () => {
      try {
        const status = (await fetchPluginStatus({ refresh: true })) as PluginStatus
        if (mounted) setPluginStatus(status)
      } catch {
        if (mounted) setPluginStatus(null)
      }
    })()
    return () => {
      mounted = false
    }
  }, [])

  useEffect(() => {
    setMessages([
      {
        id: "welcome",
        role: "system",
        text: "Dashboard channel chat is ready. Messages are routed to OpenClaw via plugin bridge.",
        ts: new Date(),
      },
    ])
  }, [])

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
            if (prev.some((m) => m.id === "ws-open")) return prev
            return [...prev, { id: "ws-open", role: "system", text: "Realtime bridge connected.", ts: new Date() }]
          })
        }

        ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data as string)
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
                role: "assistant",
                text,
                ts: new Date(),
              },
            ])
          } catch {
            // Ignore malformed payloads.
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
  }, [])

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" })
  }, [messages, sending])

  const sendMessage = async () => {
    const text = input.trim()
    if (!text || sending) return

    if (!pluginConnected) {
      showToast({
        type: "warning",
        title: "Plugin not connected",
        message: "Connect plugin bridge first to use dashboard channel chat.",
      })
      return
    }

    const ws = socketRef.current
    if (!ws || ws.readyState !== WebSocket.OPEN) {
      showToast({
        type: "error",
        title: "Realtime bridge offline",
        message: "WebSocket bridge is disconnected. Wait for reconnect and retry.",
      })
      return
    }

    setSending(true)
    setMessages((prev) => [
      ...prev,
      {
        id: `user-${Date.now()}`,
        role: "user",
        text,
        ts: new Date(),
      },
    ])
    setInput("")

    try {
      ws.send(
        JSON.stringify({
          method: "chat.inject",
          params: {
            channel: "agentlock_dashboard",
            text,
            source: "agent_lock_dashboard_chat",
            timestamp: new Date().toISOString(),
          },
        })
      )
    } catch (error) {
      showToast({
        type: "error",
        title: "Send failed",
        message: error instanceof Error ? error.message : "Unexpected send error",
      })
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="page-title">Channel Chat</h1>
          <p className="page-subtitle">Talk to OpenClaw directly from dashboard channel.</p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant={pluginConnected ? "success" : "warning"}>{pluginConnected ? "Plugin Online" : "Plugin Offline"}</Badge>
          <Badge variant={socketConnected ? "success" : "warning"}>{socketConnected ? "WS Online" : "WS Offline"}</Badge>
        </div>
      </div>

      {!pluginConnected && (
        <div className="rounded-lg border border-amber-700/40 bg-amber-900/20 px-4 py-3 text-sm text-amber-200">
          Plugin bridge is offline. Go to Settings or Plugin page to connect account + pairing, then return here.
        </div>
      )}

      <Card className="flex min-h-[56vh] md:h-[calc(100vh-230px)] flex-col overflow-hidden" padding="none">
        <div className="flex-1 overflow-y-auto p-4">
          {messages.map((m) => (
            <div key={m.id} className={`mb-3 flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
              <div
                className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm ${m.role === "system" ? "mx-auto" : ""}`}
                style={{
                  background:
                    m.role === "user"
                      ? "var(--accent-primary)"
                      : m.role === "system"
                      ? "var(--bg-tertiary)"
                      : "var(--bg-elevated)",
                  color: m.role === "user" ? "white" : "var(--text-primary)",
                  border: m.role === "assistant" ? "1px solid var(--border-primary)" : "none",
                }}
              >
                <p className="whitespace-pre-wrap">{m.text}</p>
                <p className="mt-1 text-xs" style={{ color: m.role === "user" ? "rgba(255,255,255,0.75)" : "var(--text-muted)" }}>
                  {m.ts.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                </p>
              </div>
            </div>
          ))}
          {sending && (
            <div className="my-2 flex justify-center">
              <span className="rounded-full px-3 py-1 text-xs" style={{ background: "var(--bg-tertiary)", color: "var(--text-muted)" }}>
                Sending...
              </span>
            </div>
          )}
          <div ref={endRef} />
        </div>

        <div className="p-4" style={{ borderTop: "1px solid var(--border-primary)" }}>
          <div className="mb-2 flex flex-wrap gap-2">
            {quickPrompts.map((prompt) => (
              <button
                key={prompt}
                type="button"
                className="rounded-full border border-[var(--border-primary)] bg-[var(--bg-secondary)] px-3 py-1 text-xs text-[var(--text-secondary)] hover:border-[var(--accent-primary)]"
                onClick={() => setInput(prompt)}
              >
                {prompt}
              </button>
            ))}
          </div>
          <div className="flex gap-2">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault()
                  void sendMessage()
                }
              }}
              rows={1}
              className="input flex-1 resize-none"
              style={{ minHeight: "42px", maxHeight: "120px" }}
              placeholder={pluginConnected ? "Type your message..." : "Connect plugin bridge first to chat"}
              disabled={!pluginConnected || !socketConnected}
            />
            <Button onClick={() => void sendMessage()} disabled={!input.trim() || !pluginConnected || !socketConnected || sending}>
              Send
            </Button>
          </div>
          <p className="mt-2 text-xs" style={{ color: "var(--text-muted)" }}>
            Enter to send, Shift+Enter for a new line. Routed via channel agentlock_dashboard.
          </p>
        </div>
      </Card>
    </div>
  )
}
