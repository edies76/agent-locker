"use client"

import { Fragment, useEffect, useMemo, useRef, useState } from "react"
import { usePathname } from "next/navigation"
import {
  fetchHealth,
  fetchMCPDiagnostics,
  fetchMCPStatus,
  fetchMCPTargets,
  fetchPending,
  fetchStats,
} from "@/lib/api"

type Message = {
  role: "user" | "assistant"
  content: string
}

const STORAGE_KEY = "agent-lock-ai-single-chat"
const PANEL_STATE_KEY = "agent-lock-ai-panel-state"
const CONTEXT_TTL_MS = 20000
const MAX_STORED_MESSAGES = 120
const EDGE_GAP = 12

type PanelState = {
  docked: boolean
  x: number
  y: number
}

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n))
}

function fitToViewport(x: number, y: number, width: number, height: number): { x: number; y: number } {
  if (typeof window === "undefined") return { x, y }
  const maxX = Math.max(EDGE_GAP, window.innerWidth - width - EDGE_GAP)
  const maxY = Math.max(EDGE_GAP, window.innerHeight - height - EDGE_GAP)
  return {
    x: clamp(x, EDGE_GAP, maxX),
    y: clamp(y, EDGE_GAP, maxY),
  }
}

async function buildLargeContext(pathname: string): Promise<string> {
  const chunks: string[] = [
    `pantalla_actual=${pathname}`,
    `timestamp=${new Date().toISOString()}`,
  ]

  const [health, diag, status, targets, stats, pending] = await Promise.allSettled([
    fetchHealth(),
    fetchMCPDiagnostics({ refresh: true }),
    fetchMCPStatus(),
    fetchMCPTargets(),
    fetchStats({ refresh: true }),
    fetchPending(),
  ])

  const pushSettled = (name: string, result: PromiseSettledResult<unknown>) => {
    if (result.status === "fulfilled") {
      chunks.push(`${name}=${JSON.stringify(result.value)}`)
    } else {
      chunks.push(`${name}=unavailable`)
    }
  }

  pushSettled("backend_health", health)
  pushSettled("mcp_diagnostics", diag)
  pushSettled("mcp_status", status)
  pushSettled("mcp_targets", targets)
  pushSettled("stats", stats)
  pushSettled("pending", pending)

  return chunks.join("\n")
}

function renderInlineMarkdown(text: string): React.ReactNode[] {
  const parts = text.split(/(`[^`]+`|\*\*[^*]+\*\*|\[[^\]]+\]\((https?:\/\/[^\s)]+)\))/g)
  return parts.filter(Boolean).map((part, idx) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return (
        <strong key={idx} className="font-semibold text-slate-100">
          {part.slice(2, -2)}
        </strong>
      )
    }

    if (part.startsWith("`") && part.endsWith("`")) {
      return (
        <code key={idx} className="rounded bg-zinc-800 px-1 py-0.5 font-mono text-[12px] text-zinc-200">
          {part.slice(1, -1)}
        </code>
      )
    }

    const linkMatch = part.match(/^\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)$/)
    if (linkMatch) {
      return (
        <a
          key={idx}
          href={linkMatch[2]}
          target="_blank"
          rel="noreferrer"
          className="text-slate-300 underline decoration-slate-500 hover:text-slate-100"
        >
          {linkMatch[1]}
        </a>
      )
    }

    return <Fragment key={idx}>{part}</Fragment>
  })
}

function renderMarkdown(text: string): React.ReactNode {
  const lines = text.split(/\r?\n/)
  const blocks: React.ReactNode[] = []
  let listItems: string[] = []

  const flushList = () => {
    if (listItems.length === 0) return
    blocks.push(
      <ul key={`ul-${blocks.length}`} className="my-2 list-disc space-y-1 pl-5 text-[13px] text-slate-300">
        {listItems.map((item, i) => (
          <li key={i}>{renderInlineMarkdown(item)}</li>
        ))}
      </ul>
    )
    listItems = []
  }

  for (const line of lines) {
    const trimmed = line.trim()

    if (!trimmed) {
      flushList()
      blocks.push(<div key={`sp-${blocks.length}`} className="h-1" />)
      continue
    }

    if (trimmed.startsWith("- ")) {
      listItems.push(trimmed.slice(2))
      continue
    }

    flushList()

    if (trimmed.startsWith("### ")) {
      blocks.push(
        <h3 key={`h3-${blocks.length}`} className="mt-2 text-[13px] font-semibold text-slate-100">
          {renderInlineMarkdown(trimmed.slice(4))}
        </h3>
      )
      continue
    }

    if (trimmed.startsWith("## ")) {
      blocks.push(
        <h2 key={`h2-${blocks.length}`} className="mt-2 text-[14px] font-semibold text-slate-100">
          {renderInlineMarkdown(trimmed.slice(3))}
        </h2>
      )
      continue
    }

    blocks.push(
      <p key={`p-${blocks.length}`} className="text-[13px] leading-6 text-slate-300">
        {renderInlineMarkdown(trimmed)}
      </p>
    )
  }

  flushList()

  return <div className="space-y-1">{blocks}</div>
}

export default function AIAssistantWidget() {
  const pathname = usePathname()
  const contextCacheRef = useRef<{ at: number; text: string } | null>(null)
  const panelRef = useRef<HTMLDivElement | null>(null)
  const dragRef = useRef<{ active: boolean; dx: number; dy: number }>({ active: false, dx: 0, dy: 0 })
  const listEndRef = useRef<HTMLDivElement | null>(null)
  const [open, setOpen] = useState(false)
  const [sending, setSending] = useState(false)
  const [input, setInput] = useState("")
  const [docked, setDocked] = useState(true)
  const [panelPos, setPanelPos] = useState({ x: 0, y: 0 })
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "assistant",
      content:
        "I am Agent-Lock AI. I help you diagnose MCP, backend, approval, and policy issues with concrete next steps.",
    },
  ])

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (!raw) return
      const parsed = JSON.parse(raw)
      if (!Array.isArray(parsed)) return
      const valid = parsed.filter(
        (m: any) => (m?.role === "user" || m?.role === "assistant") && typeof m?.content === "string"
      ) as Message[]
      if (valid.length > 0) {
        setMessages(valid.slice(-MAX_STORED_MESSAGES))
      }
    } catch {
      // ignore localStorage corruption
    }
  }, [])

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(messages.slice(-MAX_STORED_MESSAGES)))
    } catch {
      // ignore storage quota errors
    }
  }, [messages])

  useEffect(() => {
    try {
      const raw = localStorage.getItem(PANEL_STATE_KEY)
      if (!raw) return
      const parsed = JSON.parse(raw) as Partial<PanelState>
      if (typeof parsed?.docked === "boolean") {
        setDocked(parsed.docked)
      }
      if (typeof parsed?.x === "number" && typeof parsed?.y === "number") {
        setPanelPos({ x: parsed.x, y: parsed.y })
      }
    } catch {
      // ignore localStorage corruption
    }
  }, [])

  useEffect(() => {
    try {
      const payload: PanelState = {
        docked,
        x: panelPos.x,
        y: panelPos.y,
      }
      localStorage.setItem(PANEL_STATE_KEY, JSON.stringify(payload))
    } catch {
      // ignore storage quota errors
    }
  }, [docked, panelPos.x, panelPos.y])

  useEffect(() => {
    if (!open || docked) return

    const handleResize = () => {
      const panel = panelRef.current
      if (!panel) return
      const fitted = fitToViewport(panelPos.x, panelPos.y, panel.offsetWidth, panel.offsetHeight)
      if (fitted.x !== panelPos.x || fitted.y !== panelPos.y) {
        setPanelPos(fitted)
      }
    }

    window.addEventListener("resize", handleResize)
    handleResize()
    return () => window.removeEventListener("resize", handleResize)
  }, [open, docked, panelPos.x, panelPos.y])

  useEffect(() => {
    listEndRef.current?.scrollIntoView({ block: "end" })
  }, [messages, sending])

  const title = useMemo(() => (open ? "Close Agent-Lock AI" : "Open Agent-Lock AI"), [open])

  const getContext = async (): Promise<string> => {
    const now = Date.now()
    const cached = contextCacheRef.current
    if (cached && now - cached.at < CONTEXT_TTL_MS) {
      return cached.text
    }

    const text = await buildLargeContext(pathname || "/")
    contextCacheRef.current = { at: now, text }
    return text
  }

  const send = async () => {
    const text = input.trim()
    if (!text || sending) return

    const userMessage: Message = { role: "user", content: text }
    const nextMessages = [...messages, userMessage]
    setMessages([
      ...nextMessages,
      { role: "assistant", content: "Searching Agent-Lock context..." },
    ])
    setInput("")
    setSending(true)

    try {
      setMessages((prev) => {
        if (prev.length === 0) return prev
        const next = [...prev]
        next[next.length - 1] = {
          role: "assistant",
          content: "Searching Agent-Lock context...",
        }
        return next
      })

      const context = await getContext()

      setMessages((prev) => {
        if (prev.length === 0) return prev
        const next = [...prev]
        next[next.length - 1] = {
          role: "assistant",
          content: "Context loaded. Contacting Agent-Lock AI...",
        }
        return next
      })

      const res = await fetch("/api/agent-lock-ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: nextMessages.slice(-40),
          context,
          stream: true,
        }),
      })

      if (!res.ok) {
        const ct = res.headers.get("content-type") || ""
        let message = "Failed to query Agent-Lock AI"
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
        const ct = res.headers.get("content-type") || ""
        let fallbackText = "No response was received from the assistant."
        if (ct.includes("application/json")) {
          const data = await res.json().catch(() => ({}))
          fallbackText = String(data?.message || fallbackText)
        } else {
          const raw = await res.text().catch(() => "")
          if (raw.trim()) fallbackText = raw
        }
        setMessages((prev) => {
          const next = [...prev]
          next[next.length - 1] = { role: "assistant", content: fallbackText }
          return next
        })
        return
      }

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let assistantText = ""
      let firstChunk = true

      while (true) {
        const { value, done } = await reader.read()
        if (done) break

        assistantText += decoder.decode(value, { stream: true })
        setMessages((prev) => {
          if (prev.length === 0) return prev
          const next = [...prev]
          if (firstChunk) {
            firstChunk = false
          }
          next[next.length - 1] = {
            role: "assistant",
            content: assistantText,
          }
          return next
        })
      }

      const tail = decoder.decode()
      if (tail) {
        assistantText += tail
      }

      if (!assistantText.trim()) {
        setMessages((prev) => {
          if (prev.length === 0) return prev
          const next = [...prev]
          next[next.length - 1] = {
            role: "assistant",
            content: "No response was received from the assistant.",
          }
          return next
        })
      }
    } catch (error) {
      setMessages((prev) => [
        ...prev.slice(0, -1),
        {
          role: "assistant",
          content:
            error instanceof Error
              ? `Assistant error: ${error.message}`
              : "Unexpected error while querying Agent-Lock AI.",
        },
      ])
    } finally {
      setSending(false)
    }
  }

  const startDrag = (e: React.PointerEvent<HTMLDivElement>) => {
    const panel = panelRef.current
    if (!panel) return

    const rect = panel.getBoundingClientRect()
    if (docked) {
      const fitted = fitToViewport(rect.left, rect.top, panel.offsetWidth, panel.offsetHeight)
      setPanelPos(fitted)
      setDocked(false)
    }

    dragRef.current = {
      active: true,
      dx: e.clientX - rect.left,
      dy: e.clientY - rect.top,
    }

    const onMove = (ev: PointerEvent) => {
      if (!dragRef.current.active) return
      const fitted = fitToViewport(
        ev.clientX - dragRef.current.dx,
        ev.clientY - dragRef.current.dy,
        panel.offsetWidth,
        panel.offsetHeight
      )
      setPanelPos(fitted)
    }

    const onUp = () => {
      dragRef.current.active = false
      window.removeEventListener("pointermove", onMove)
      window.removeEventListener("pointerup", onUp)
    }

    window.addEventListener("pointermove", onMove)
    window.addEventListener("pointerup", onUp)
  }

  const toggleDock = () => {
    const panel = panelRef.current
    if (!panel) {
      setDocked((v) => !v)
      return
    }

    if (docked) {
      const rect = panel.getBoundingClientRect()
      const fitted = fitToViewport(rect.left, rect.top, panel.offsetWidth, panel.offsetHeight)
      setPanelPos(fitted)
      setDocked(false)
      return
    }

    setDocked(true)
  }

  const panelPositionClass = docked ? "bottom-16 right-5" : ""
  const panelPositionStyle = docked
    ? undefined
    : ({ left: `${panelPos.x}px`, top: `${panelPos.y}px` } as React.CSSProperties)

  return (
    <>
      <button
        type="button"
        title={title}
        onClick={() => setOpen((v) => !v)}
        className="fixed bottom-5 right-5 z-50 rounded-full border border-zinc-700 bg-zinc-900 px-3 py-2 text-[11px] font-medium tracking-wide text-zinc-100 shadow-lg hover:border-zinc-500 hover:bg-zinc-800"
      >
        AI
      </button>

      {open && (
        <div
          ref={panelRef}
          style={panelPositionStyle}
          className={`fixed z-50 flex h-[min(760px,calc(100vh-6rem))] w-[520px] max-w-[calc(100vw-1rem)] flex-col overflow-hidden rounded-2xl border border-zinc-700 bg-zinc-900 shadow-2xl ${panelPositionClass}`}
        >
          <div
            onPointerDown={startDrag}
            className="flex cursor-move items-center justify-between border-b border-zinc-700 px-4 py-3"
          >
            <div>
              <p className="text-[11px] uppercase tracking-[0.16em] text-zinc-300">Agent-Lock AI</p>
              <p className="text-[10px] text-zinc-500">Streaming enabled · Persistent single chat</p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={toggleDock}
                className="rounded-md border border-zinc-600 px-2 py-1 text-[10px] text-zinc-200 hover:bg-zinc-800"
              >
                {docked ? "Float" : "Dock"}
              </button>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-md border border-zinc-600 px-2 py-1 text-[10px] text-zinc-200 hover:bg-zinc-800"
              >
                Close
              </button>
            </div>
          </div>

          <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-4">
            {messages.map((m, idx) => (
              m.role === "user" ? (
                <div
                  key={`${m.role}-${idx}`}
                  className="ml-12 rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-[13px] text-zinc-100"
                >
                  {m.content}
                </div>
              ) : (
                <div key={`${m.role}-${idx}`} className="text-[13px] text-zinc-200">
                  {renderMarkdown(m.content)}
                </div>
              )
            ))}
            {sending && (
              <div className="text-[13px] text-zinc-400">
                Thinking...
              </div>
            )}
            <div ref={listEndRef} />
          </div>

          <div className="p-4">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault()
                  void send()
                }
              }}
              placeholder="Describe the issue... (e.g. why is vscode MCP shown as disconnected?)"
              className="min-h-[52px] w-full resize-none rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-[13px] text-zinc-100 outline-none placeholder:text-zinc-500 focus:border-zinc-500"
            />
            <div className="mt-2 flex items-center justify-between">
              <p className="text-[10px] text-zinc-500">Enter sends · Shift+Enter newline</p>
              <button
                type="button"
                onClick={() => void send()}
                disabled={sending || !input.trim()}
                className="rounded-md border border-zinc-600 bg-zinc-800 px-3 py-1.5 text-[11px] font-medium text-zinc-100 hover:bg-zinc-700 disabled:opacity-50"
              >
                Send
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
