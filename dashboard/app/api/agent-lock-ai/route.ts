import { NextRequest, NextResponse } from "next/server"
import fs from "node:fs"
import path from "node:path"

type ChatMessage = {
  role: "system" | "user" | "assistant"
  content: string
}

type GeminiPart = { text: string }
type GeminiContent = { role: "user" | "model"; parts: GeminiPart[] }

type KeyResolution = {
  key: string | null
  source: string
}

const AGENT_LOCK_PRIMER = [
  "Agent-Lock has separate integration surfaces:",
  "- MCP Gateway: local mcp_server that proxies MCP tool calls and enforces governance.",
  "- Plugin integrations: separate adapters (for example the plugin bridge).",
  "Do not claim plugin status when only MCP gateway telemetry is available.",
  "If plugin telemetry is missing, explicitly say 'plugin status unavailable' instead of guessing.",
  "Ground all diagnostics in provided context fields (health, mcp_status, mcp_targets, mcp_diagnostics, stats, pending).",
  "When evidence is missing, say what is unknown and provide concrete next verification steps.",
].join("\n")

function buildGeminiUrl(model: string, apiKey: string, stream: boolean): string {
  const explicitUrl = process.env.AGENT_LOCK_GEMINI_API_URL
  if (explicitUrl) return explicitUrl
  const encodedModel = encodeURIComponent(model)
  const encodedKey = encodeURIComponent(apiKey)
  if (stream) {
    return `https://generativelanguage.googleapis.com/v1beta/models/${encodedModel}:streamGenerateContent?alt=sse&key=${encodedKey}`
  }
  return `https://generativelanguage.googleapis.com/v1beta/models/${encodedModel}:generateContent?key=${encodedKey}`
}

function readBackendGeminiKeyFromEnvFile(): string | null {
  try {
    const backendEnvPath = path.resolve(process.cwd(), "..", "backend", ".env")
    if (!fs.existsSync(backendEnvPath)) return null

    const raw = fs.readFileSync(backendEnvPath, "utf-8")
    for (const line of raw.split(/\r?\n/)) {
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith("#")) continue
      const idx = trimmed.indexOf("=")
      if (idx <= 0) continue
      const key = trimmed.slice(0, idx).trim()
      if (key !== "GEMINI_API_KEY") continue
      const value = trimmed.slice(idx + 1).trim().replace(/^"|"$/g, "")
      return value || null
    }
    return null
  } catch {
    return null
  }
}

function resolveGeminiKey(): KeyResolution {
  if (process.env.AGENT_LOCK_GEMINI_API_KEY) {
    return { key: process.env.AGENT_LOCK_GEMINI_API_KEY, source: "AGENT_LOCK_GEMINI_API_KEY" }
  }
  if (process.env.GEMINI_API_KEY) {
    return { key: process.env.GEMINI_API_KEY, source: "GEMINI_API_KEY" }
  }
  if (process.env.GOOGLE_API_KEY) {
    return { key: process.env.GOOGLE_API_KEY, source: "GOOGLE_API_KEY" }
  }

  const backendKey = readBackendGeminiKeyFromEnvFile()
  if (backendKey) {
    return { key: backendKey, source: "backend/.env:GEMINI_API_KEY" }
  }

  return { key: null, source: "none" }
}

function toGeminiContents(messages: ChatMessage[]): GeminiContent[] {
  return messages
    .filter((m) => m.role === "user" || m.role === "assistant")
    .map((m) => ({
      role: m.role === "assistant" ? "model" : "user",
      parts: [{ text: m.content }],
    }))
}

function extractGeminiText(payload: any): string {
  const parts = payload?.candidates?.[0]?.content?.parts
  if (Array.isArray(parts)) {
    const text = parts
      .map((p) => (typeof p?.text === "string" ? p.text : ""))
      .join("\n")
      .trim()
    if (text) return text
  }

  return "Could not read a Gemini response in the expected format."
}

function createGeminiTextStream(source: ReadableStream<Uint8Array>): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder()
  const decoder = new TextDecoder()

  return new ReadableStream<Uint8Array>({
    start(controller) {
      const reader = source.getReader()
      let buffer = ""
      let emittedText = ""

      const flushLine = (line: string) => {
        const trimmed = line.trim()
        if (!trimmed.startsWith("data:")) return

        const payload = trimmed.slice(5).trim()
        if (!payload || payload === "[DONE]") return

        try {
          const parsed = JSON.parse(payload)
          const fullText = extractGeminiText(parsed)
          if (!fullText || /Could not read a Gemini response in the expected format/i.test(fullText)) {
            return
          }

          if (fullText.startsWith(emittedText)) {
            const delta = fullText.slice(emittedText.length)
            if (delta) {
              controller.enqueue(encoder.encode(delta))
              emittedText = fullText
            }
            return
          }

          controller.enqueue(encoder.encode(fullText))
          emittedText += fullText
        } catch {
          // Ignore malformed SSE payload chunks.
        }
      }

      const pump = async () => {
        try {
          while (true) {
            const { value, done } = await reader.read()
            if (done) break

            buffer += decoder.decode(value, { stream: true })
            let idx = buffer.indexOf("\n")
            while (idx >= 0) {
              const line = buffer.slice(0, idx)
              flushLine(line)
              buffer = buffer.slice(idx + 1)
              idx = buffer.indexOf("\n")
            }
          }

          if (buffer.trim()) {
            flushLine(buffer)
          }
          controller.close()
        } catch (e) {
          controller.error(e)
        } finally {
          reader.releaseLock()
        }
      }

      void pump()
    },
  })
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const incomingMessages = Array.isArray(body?.messages)
      ? (body.messages as ChatMessage[]).filter(
          (m) =>
            m &&
            (m.role === "user" || m.role === "assistant") &&
            typeof m.content === "string" &&
            m.content.trim().length > 0
        )
      : []

    const context = typeof body?.context === "string" ? body.context : ""
  const streamRequested = body?.stream !== false

    if (incomingMessages.length === 0) {
      return NextResponse.json({ error: "No messages provided" }, { status: 400 })
    }

    const keyResolution = resolveGeminiKey()
    const apiKey = keyResolution.key

    const model = process.env.AGENT_LOCK_GEMINI_MODEL ?? "gemini-3.0-flash"

    if (!apiKey) {
      return NextResponse.json(
        {
          error:
            "AI assistant not configured. Set AGENT_LOCK_GEMINI_API_KEY (or GEMINI_API_KEY) in dashboard/.env.local and restart Next dev server.",
          key_source: keyResolution.source,
        },
        { status: 500 }
      )
    }

    const geminiUrl = buildGeminiUrl(model, apiKey, streamRequested)

    const systemPrompt = [
      "You are Agent-Lock AI, the operational assistant for the dashboard.",
      "Default to English, but if the user's latest message is mostly Spanish, reply in Spanish.",
      "Give concrete, evidence-based diagnostics and actionable next steps.",
      "If something is disabled or disconnected, state it explicitly.",
      "Do not invent file paths, statuses, or integrations.",
      AGENT_LOCK_PRIMER,
      context ? `Dashboard context:\n${context}` : "",
    ]
      .filter(Boolean)
      .join("\n\n")

    const requestPayload = {
      systemInstruction: {
        parts: [{ text: systemPrompt }],
      },
      contents: toGeminiContents(incomingMessages.slice(-14)),
      generationConfig: {
        maxOutputTokens: 700,
      },
    }

    const response = await fetch(geminiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(requestPayload),
      cache: "no-store",
    })

    const contentType = response.headers.get("content-type") || ""
    const isSse = /text\/event-stream/i.test(contentType)

    if (streamRequested && response.ok && response.body && isSse) {
      return new Response(createGeminiTextStream(response.body), {
        headers: {
          "Content-Type": "text/plain; charset=utf-8",
          "Cache-Control": "no-store, no-transform",
          Connection: "keep-alive",
        },
      })
    }

    const raw = await response.text()
    let parsed: any = null

    try {
      parsed = JSON.parse(raw)
    } catch {
      parsed = { raw }
    }

    if (!response.ok) {
      const reason = parsed?.error?.details?.[0]?.reason
      const invalidKey = reason === "API_KEY_INVALID" || /API key not valid/i.test(String(parsed?.error?.message || ""))

      return NextResponse.json(
        {
          error: invalidKey
            ? `Invalid Gemini API key (${keyResolution.source}). Rotate/create a valid key in Google AI Studio and set AGENT_LOCK_GEMINI_API_KEY in dashboard/.env.local.`
            : parsed?.error?.message || parsed?.message || "Gemini request failed",
          status: response.status,
          key_source: keyResolution.source,
        },
        { status: 500 }
      )
    }

    const assistant = extractGeminiText(parsed)
    return NextResponse.json({ message: assistant })
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unexpected AI assistant error",
      },
      { status: 500 }
    )
  }
}
