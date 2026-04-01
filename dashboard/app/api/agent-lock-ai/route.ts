import { NextRequest, NextResponse } from "next/server"
import fs from "node:fs"
import path from "node:path"

type ChatMessage = {
  role: "system" | "user" | "assistant"
  content: string
}

type GeminiPart = { text: string }
type GeminiContent = { role: "user" | "model"; parts: GeminiPart[] }

function buildGeminiUrl(model: string, apiKey: string): string {
  const explicitUrl = process.env.AGENT_LOCK_GEMINI_API_URL
  if (explicitUrl) return explicitUrl
  const encodedModel = encodeURIComponent(model)
  const encodedKey = encodeURIComponent(apiKey)
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

  return "No se pudo obtener respuesta del modelo Gemini en un formato esperado."
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

    if (incomingMessages.length === 0) {
      return NextResponse.json({ error: "No messages provided" }, { status: 400 })
    }

    const apiKey =
      process.env.AGENT_LOCK_GEMINI_API_KEY ||
      process.env.GEMINI_API_KEY ||
      process.env.GOOGLE_API_KEY ||
      readBackendGeminiKeyFromEnvFile()

    const model = process.env.AGENT_LOCK_GEMINI_MODEL ?? "gemini-3.0-flash"

    if (!apiKey) {
      return NextResponse.json(
        {
          error:
            "AI assistant not configured. Set AGENT_LOCK_GEMINI_API_KEY (or GEMINI_API_KEY) in dashboard/.env.local and restart Next dev server.",
        },
        { status: 500 }
      )
    }

    const geminiUrl = buildGeminiUrl(model, apiKey)

    const systemPrompt = [
      "Eres Agent-Lock AI, asistente operativo del dashboard.",
      "Tu objetivo es diagnosticar fallos reales y dar pasos concretos accionables.",
      "Responde en espanol claro, directo y breve.",
      "Cuando detectes algo deshabilitado o desconectado, dilo explicitamente.",
      context ? `Contexto del dashboard:\n${context}` : "",
    ]
      .filter(Boolean)
      .join("\n\n")

    const response = await fetch(geminiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        systemInstruction: {
          parts: [{ text: systemPrompt }],
        },
        contents: toGeminiContents(incomingMessages.slice(-14)),
        generationConfig: {
          maxOutputTokens: 700,
        },
      }),
      cache: "no-store",
    })

    const raw = await response.text()
    let parsed: any = null

    try {
      parsed = JSON.parse(raw)
    } catch {
      parsed = { raw }
    }

    if (!response.ok) {
      return NextResponse.json(
        {
          error:
            parsed?.error?.message ||
            parsed?.message ||
            "Gemini request failed",
          status: response.status,
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
