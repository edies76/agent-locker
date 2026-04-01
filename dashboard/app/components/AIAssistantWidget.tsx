"use client"

import { useMemo, useState } from "react"
import { usePathname } from "next/navigation"
import { fetchHealth, fetchMCPDiagnostics } from "@/lib/api"

type Message = {
  role: "user" | "assistant"
  content: string
}

async function buildContext(pathname: string): Promise<string> {
  const chunks: string[] = [`pantalla_actual=${pathname}`]

  try {
    const health = await fetchHealth()
    chunks.push(`backend_health=${JSON.stringify(health)}`)
  } catch {
    chunks.push("backend_health=unavailable")
  }

  try {
    const diag = await fetchMCPDiagnostics({ refresh: true })
    chunks.push(`mcp_diagnostics=${JSON.stringify(diag)}`)
  } catch {
    chunks.push("mcp_diagnostics=unavailable")
  }

  return chunks.join("\n")
}

export default function AIAssistantWidget() {
  const pathname = usePathname()
  const [open, setOpen] = useState(false)
  const [sending, setSending] = useState(false)
  const [input, setInput] = useState("")
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "assistant",
      content:
        "Soy Agent-Lock AI. Te ayudo a detectar por que falla algo (MCP, backend, aprobaciones) y que hacer paso a paso.",
    },
  ])

  const title = useMemo(() => (open ? "Cerrar Agent-Lock AI" : "Abrir Agent-Lock AI"), [open])

  const send = async () => {
    const text = input.trim()
    if (!text || sending) return

    const userMessage: Message = { role: "user", content: text }
    const nextMessages = [...messages, userMessage]
    setMessages(nextMessages)
    setInput("")
    setSending(true)

    try {
      const context = await buildContext(pathname || "/")
      const res = await fetch("/api/agent-lock-ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: nextMessages,
          context,
        }),
      })

      const data = await res.json()
      if (!res.ok) {
        throw new Error(data?.error || "No se pudo consultar Agent-Lock AI")
      }

      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: String(data?.message || "No se recibio respuesta del asistente."),
        },
      ])
    } catch (error) {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content:
            error instanceof Error
              ? `Error del asistente: ${error.message}`
              : "Error inesperado al consultar Agent-Lock AI.",
        },
      ])
    } finally {
      setSending(false)
    }
  }

  return (
    <>
      <button
        type="button"
        title={title}
        onClick={() => setOpen((v) => !v)}
        className="fixed bottom-5 right-5 z-50 rounded-full border border-slate-700/70 bg-slate-950/95 px-3 py-2 text-[11px] font-medium tracking-wide text-slate-200 shadow-lg backdrop-blur hover:border-slate-600 hover:bg-slate-900"
      >
        AI
      </button>

      {open && (
        <div className="fixed bottom-16 right-5 z-50 w-[340px] max-w-[calc(100vw-2rem)] rounded-2xl border border-slate-800 bg-slate-950 shadow-2xl">
          <div className="flex items-center justify-between border-b border-slate-800 px-3 py-2">
            <div>
              <p className="text-[11px] uppercase tracking-[0.16em] text-slate-300">Agent-Lock AI</p>
              <p className="text-[10px] text-slate-500">Diagnostico operativo</p>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded-md border border-slate-700 px-2 py-1 text-[10px] text-slate-300 hover:bg-slate-900"
            >
              Cerrar
            </button>
          </div>

          <div className="max-h-[320px] space-y-2 overflow-y-auto px-3 py-3">
            {messages.map((m, idx) => (
              <div
                key={`${m.role}-${idx}`}
                className={`rounded-lg px-3 py-2 text-sm ${
                  m.role === "user"
                    ? "ml-8 border border-slate-800 bg-slate-900 text-slate-200"
                    : "mr-8 border border-slate-800 bg-[#0d1117] text-slate-200"
                }`}
              >
                {m.content}
              </div>
            ))}
            {sending && (
              <div className="mr-8 rounded-lg border border-slate-800 bg-[#0d1117] px-3 py-2 text-sm text-slate-400">
                Pensando...
              </div>
            )}
          </div>

          <div className="border-t border-slate-800 p-3">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault()
                  void send()
                }
              }}
              placeholder="Describe el problema... (ej: por que vscode MCP sale desconectado?)"
              className="min-h-[44px] w-full resize-none rounded-lg border border-slate-800 bg-[#0b0f15] px-3 py-2 text-[13px] text-slate-200 outline-none placeholder:text-slate-600 focus:border-slate-700"
            />
            <div className="mt-2 flex items-center justify-between">
              <p className="text-[10px] text-slate-600">Enter envia</p>
              <button
                type="button"
                onClick={() => void send()}
                disabled={sending || !input.trim()}
                className="rounded-md border border-slate-700 bg-slate-900 px-3 py-1.5 text-[11px] font-medium text-slate-200 hover:bg-slate-800 disabled:opacity-50"
              >
                Enviar
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
