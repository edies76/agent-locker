import { NextRequest, NextResponse } from "next/server"
import fs from "node:fs"
import path from "node:path"

type ChatMessage = {
  role: "system" | "user" | "assistant"
  content: string
}

type GeminiPart = { text: string }
type GeminiContent = { role: "user" | "model"; parts: GeminiPart[] }

type KeyCandidate = {
  key: string | null
  source: string
}

const AGENT_LOCK_PRIMER = [
  "Agent-Lock has separate integration surfaces:",
  "- MCP Gateway: local mcp_server that proxies MCP tool calls and enforces governance.",
  "- Plugin integrations: separate adapters (for example the plugin bridge).",
  "Do not claim plugin status when only MCP gateway telemetry is available.",
  "If plugin telemetry is missing, explicitly say 'plugin status unavailable' instead of guessing.",
  "Ground all diagnostics in provided context fields (health, mcp_status, mcp_targets, mcp_diagnostics, stats, pending, execution_history_summary).",
  "Use execution_history_summary to answer historical questions (counts by date/tool/hour).",
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
    const candidates = [
      path.resolve(process.cwd(), "..", "backend-agentlock", ".env"),
      path.resolve(process.cwd(), "..", "backend", ".env"),
    ]

    for (const backendEnvPath of candidates) {
      if (!fs.existsSync(backendEnvPath)) continue
      const raw = fs.readFileSync(backendEnvPath, "utf-8")
      for (const line of raw.split(/\r?\n/)) {
        const trimmed = line.trim()
        if (!trimmed || trimmed.startsWith("#")) continue
        const idx = trimmed.indexOf("=")
        if (idx <= 0) continue
        const key = trimmed.slice(0, idx).trim()
        if (key !== "GEMINI_API_KEY") continue
        const value = trimmed.slice(idx + 1).trim().replace(/^"|"$/g, "")
        if (value) return value
      }
    }
    return null
  } catch {
    return null
  }
}

function resolveGeminiKeyCandidates(): KeyCandidate[] {
  const candidates: KeyCandidate[] = []

  if (process.env.GEMINI_API_KEY) {
    candidates.push({ key: process.env.GEMINI_API_KEY, source: "GEMINI_API_KEY" })
  }
  if (process.env.AGENT_LOCK_GEMINI_API_KEY) {
    candidates.push({ key: process.env.AGENT_LOCK_GEMINI_API_KEY, source: "AGENT_LOCK_GEMINI_API_KEY" })
  }
  if (process.env.GOOGLE_API_KEY) {
    candidates.push({ key: process.env.GOOGLE_API_KEY, source: "GOOGLE_API_KEY" })
  }

  const backendKey = readBackendGeminiKeyFromEnvFile()
  if (backendKey) {
    candidates.push({ key: backendKey, source: "backend/.env:GEMINI_API_KEY" })
  }

  const seen = new Set<string>()
  return candidates.filter((candidate) => {
    const value = candidate.key?.trim()
    if (!value) return false
    if (seen.has(value)) return false
    seen.add(value)
    return true
  })
}

function isInvalidGeminiKeyError(parsed: any): boolean {
  const reason = parsed?.error?.details?.[0]?.reason
  return reason === "API_KEY_INVALID" || /API key not valid/i.test(String(parsed?.error?.message || ""))
}

function isRetryableGeminiFailure(parsed: any, statusCode: number): boolean {
  if (statusCode === 429 || statusCode === 503) return true
  const reason = String(parsed?.error?.details?.[0]?.reason || "").toUpperCase()
  const status = String(parsed?.error?.status || "").toUpperCase()
  const message = String(parsed?.error?.message || "").toLowerCase()
  return (
    reason === "RESOURCE_EXHAUSTED" ||
    status === "RESOURCE_EXHAUSTED" ||
    message.includes("quota") ||
    message.includes("rate limit")
  )
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

      const flushEvent = (eventChunk: string) => {
        const lines = eventChunk
          .split(/\r?\n/)
          .map((line) => line.trim())
          .filter(Boolean)

        const payloadLines = lines
          .filter((line) => line.startsWith("data:"))
          .map((line) => line.slice(5).trim())
          .filter(Boolean)

        if (payloadLines.length === 0) return

        const payload = payloadLines.join("\n")
        if (payload === "[DONE]") return

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
            buffer = buffer.replace(/\r\n/g, "\n")

            let separatorIndex = buffer.indexOf("\n\n")
            while (separatorIndex >= 0) {
              const eventChunk = buffer.slice(0, separatorIndex)
              flushEvent(eventChunk)
              buffer = buffer.slice(separatorIndex + 2)
              separatorIndex = buffer.indexOf("\n\n")
            }
          }

          if (buffer.trim()) {
            flushEvent(buffer)
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

    const keyCandidates = resolveGeminiKeyCandidates()
    const model = process.env.AGENT_LOCK_GEMINI_MODEL ?? "gemini-2.5-flash"

    if (keyCandidates.length === 0) {
      return NextResponse.json(
        {
          error:
            "AI assistant not configured. Set AGENT_LOCK_GEMINI_API_KEY (or GEMINI_API_KEY) in dashboard/.env.local and restart Next dev server.",
          key_source: "none",
        },
        { status: 500 }
      )
    }

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

    const retryableFailureSources: string[] = []
    const invalidKeySources: string[] = []

    for (const candidate of keyCandidates) {
      const geminiUrl = buildGeminiUrl(model, candidate.key as string, streamRequested)
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
        if (isInvalidGeminiKeyError(parsed)) {
          invalidKeySources.push(candidate.source)
          continue
        }
        if (isRetryableGeminiFailure(parsed, response.status)) {
          retryableFailureSources.push(candidate.source)
          continue
        }

        return NextResponse.json(
          {
            error: parsed?.error?.message || parsed?.message || "Gemini request failed",
            status: response.status,
            key_source: candidate.source,
          },
          { status: 500 }
        )
      }

      const assistant = extractGeminiText(parsed)
      return NextResponse.json({ message: assistant, key_source: candidate.source })
    }

    const failedSources = [...invalidKeySources, ...retryableFailureSources]
    return NextResponse.json(
      {
        error:
          failedSources.length > 0
            ? `All Gemini keys failed (${failedSources.join(", ")}). Keys may be invalid or quota-limited.`
            : "No working Gemini key is available.",
        status: 500,
      },
      { status: 500 }
    )
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
