"use client"

import { useEffect, useState, useCallback } from "react"
import { fetchSettings, fetchPolicies, updatePolicies, testTelegram, fetchTokenVaultStatus } from "@/lib/api"
import { Settings, PoliciesResponse } from "@/types"
import Card, { CardHeader, CardContent } from "@/app/components/ui/Card"
import Button from "@/app/components/ui/Button"
import Input from "@/app/components/ui/Input"
import Badge from "@/app/components/ui/Badge"
import { useToast } from "../components/Toast"

function Skeleton({ className }: { className?: string }) {
  return <div className={`animate-pulse bg-[var(--bg-tertiary)] rounded-lg ${className ?? ""}`} />
}

// ─── OpenClaw Section ──────────────────────────────────────────────────────────
interface OpenClawConfig {
  telegramBotToken: string
  telegramPhone: string
  isConfigured: boolean
  isConnected: boolean
  lastConnection?: string
}

function OpenClawSection() {
  const [config, setConfig] = useState<OpenClawConfig>({
    telegramBotToken: "",
    telegramPhone: "",
    isConfigured: false,
    isConnected: false,
  })
  const [isLoading, setIsLoading] = useState(false)
  const [isTesting, setIsTesting] = useState(false)
  const { showToast } = useToast()

  useEffect(() => {
    const saved = localStorage.getItem("openclaw_config")
    if (saved) {
      try {
        setConfig(JSON.parse(saved))
      } catch (e) {
        console.error("Failed to parse config:", e)
      }
    }
  }, [])

  const handleSave = async () => {
    if (!config.telegramBotToken || !config.telegramPhone) {
      showToast({
        type: "error",
        title: "Missing configuration",
        message: "Please fill in all fields",
      })
      return
    }

    setIsLoading(true)
    try {
      const newConfig = {
        ...config,
        isConfigured: true,
      }
      localStorage.setItem("openclaw_config", JSON.stringify(newConfig))
      setConfig(newConfig)
      
      window.dispatchEvent(new Event("openclaw_config_changed"))
      
      showToast({
        type: "success",
        title: "Configuration saved",
        message: "OpenClaw settings have been saved",
      })
    } catch (error) {
      showToast({
        type: "error",
        title: "Save failed",
        message: String(error),
      })
    } finally {
      setIsLoading(false)
    }
  }

  const handleTestConnection = async () => {
    if (!config.telegramBotToken || !config.telegramPhone) {
      showToast({
        type: "error",
        title: "Missing configuration",
        message: "Please save your configuration first",
      })
      return
    }

    setIsTesting(true)
    try {
      const res = await testTelegram()
      if (!res?.ok) {
        throw new Error(res?.message ?? "Telegram test failed")
      }
      
      const newConfig = {
        ...config,
        isConnected: true,
        lastConnection: new Date().toISOString(),
      }
      localStorage.setItem("openclaw_config", JSON.stringify(newConfig))
      setConfig(newConfig)
      
      window.dispatchEvent(new Event("openclaw_config_changed"))
      
      showToast({
        type: "success",
        title: "Connection successful",
        message: "OpenClaw is now connected - Chat page is now available",
      })
    } catch (error) {
      showToast({
        type: "error",
        title: "Connection failed",
        message: String(error),
      })
    } finally {
      setIsTesting(false)
    }
  }

  const handleDisconnect = () => {
    const newConfig = {
      ...config,
      isConnected: false,
    }
    localStorage.setItem("openclaw_config", JSON.stringify(newConfig))
    setConfig(newConfig)
    
    window.dispatchEvent(new Event("openclaw_config_changed"))
    
    showToast({
      type: "info",
      title: "Disconnected",
      message: "OpenClaw has been disconnected",
    })
  }

  return (
    <Card>
      <CardHeader
        title="🤖 OpenClaw Agent"
        subtitle="Configure and connect to your OpenClaw agent via Telegram"
        action={
          config.isConnected ? (
            <Badge variant="success" dot>Connected</Badge>
          ) : config.isConfigured ? (
            <Badge variant="warning" dot>Configured</Badge>
          ) : (
            <Badge variant="neutral" dot>Not Configured</Badge>
          )
        }
      />
      <CardContent className="space-y-6">
        {/* Connection Status */}
        <div className="bg-[var(--bg-tertiary)] border border-[var(--border-color)] rounded-lg p-4 space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-[var(--text-secondary)]">Status:</span>
            <span className="text-[var(--text-primary)] font-medium">
              {config.isConnected ? "Connected & Ready" : config.isConfigured ? "Configured, Not Connected" : "Not Configured"}
            </span>
          </div>
          {config.lastConnection && (
            <div className="flex justify-between text-sm">
              <span className="text-[var(--text-secondary)]">Last Connection:</span>
              <span className="text-[var(--text-primary)]">
                {new Date(config.lastConnection).toLocaleString()}
              </span>
            </div>
          )}
          
          <div className="flex gap-3 pt-3">
            <Button
              onClick={handleTestConnection}
              loading={isTesting}
              disabled={!config.isConfigured || config.isConnected}
              size="sm"
            >
              Test Connection
            </Button>
            {config.isConnected && (
              <Button onClick={handleDisconnect} variant="danger" size="sm">
                Disconnect
              </Button>
            )}
          </div>
        </div>

        {/* Configuration Form */}
        <div className="space-y-4">
          <Input
            label="Telegram Bot Token"
            type="password"
            placeholder="1234567890:ABCdefGHIjklMNOpqrsTUVwxyz"
            value={config.telegramBotToken}
            onChange={(e) => setConfig({ ...config, telegramBotToken: e.target.value })}
            hint="Get your bot token from @BotFather on Telegram"
            disabled={config.isConnected}
          />

          <Input
            label="Telegram Phone Number"
            type="tel"
            placeholder="+1234567890"
            value={config.telegramPhone}
            onChange={(e) => setConfig({ ...config, telegramPhone: e.target.value })}
            hint="Your phone number registered with Telegram (with country code)"
            disabled={config.isConnected}
          />

          <div className="pt-2">
            <Button onClick={handleSave} loading={isLoading} disabled={config.isConnected}>
              Save Configuration
            </Button>
          </div>
        </div>

        {/* Instructions */}
        <details className="bg-[var(--bg-tertiary)] border border-[var(--border-color)] rounded-lg overflow-hidden">
          <summary className="px-4 py-3 cursor-pointer hover:bg-[var(--bg-hover)] transition-colors text-sm text-[var(--text-secondary)] font-medium">
            📖 How to Configure OpenClaw
          </summary>
          <div className="px-4 py-4 border-t border-[var(--border-color)]">
            <ol className="list-decimal list-inside space-y-2 text-sm text-[var(--text-secondary)]">
              <li>Open Telegram and search for <strong>@BotFather</strong></li>
              <li>Send <code className="px-1.5 py-0.5 rounded bg-[var(--bg-secondary)] text-[var(--text-primary)]">/newbot</code> to create a new bot</li>
              <li>Follow the instructions and copy your bot token</li>
              <li>Paste the token in the field above</li>
              <li>Enter your Telegram phone number (with country code, e.g., +1234567890)</li>
              <li>Click "Save Configuration" to store your settings</li>
              <li>Click "Test Connection" to verify OpenClaw can connect</li>
              <li>Once connected, the Chat page will appear in the sidebar</li>
            </ol>
          </div>
        </details>
      </CardContent>
    </Card>
  )
}

function SectionCard({
  title,
  children,
}: {
  title: string
  children: React.ReactNode
}) {
  return (
    <Card>
      <CardHeader title={title} />
      <CardContent className="space-y-4">{children}</CardContent>
    </Card>
  )
}

function ConfigRow({
  label,
  value,
  mono = false,
}: {
  label: string
  value: string | null | undefined
  mono?: boolean
}) {
  return (
    <div className="flex items-center justify-between py-1.5 border-b border-brand-border/50 last:border-0">
      <span className="text-xs text-slate-500 uppercase tracking-wider">{label}</span>
      <span
        className={`text-sm text-slate-300 ${mono ? "font-mono" : ""} max-w-[280px] truncate text-right`}
      >
        {value ?? <span className="text-slate-600 italic">Not set</span>}
      </span>
    </div>
  )
}

function StatusPill({ configured }: { configured: boolean }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full border ${
        configured
          ? "bg-emerald-900/50 text-emerald-300 border-emerald-700/50"
          : "bg-amber-900/50 text-amber-300 border-amber-700/50"
      }`}
    >
      <span className="text-[0.6rem]">{configured ? "●" : "○"}</span>
      {configured ? "Configured" : "Not configured"}
    </span>
  )
}

function InstructionBox({
  title,
  steps,
}: {
  title?: string
  steps: (string | React.ReactNode)[]
}) {
  const [open, setOpen] = useState(false)
  return (
    <div className="border border-brand-border rounded-lg overflow-hidden">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-3 bg-brand-bg/40 hover:bg-brand-bg/70 transition-colors text-sm text-slate-400 hover:text-slate-200"
      >
        <span className="flex items-center gap-2">
          <span>📖</span>
          <span>{title ?? "Setup Instructions"}</span>
        </span>
        <span className="text-xs text-slate-600">{open ? "▲ Hide" : "▼ Show"}</span>
      </button>
      {open && (
        <div className="px-4 py-4 bg-brand-bg/20 border-t border-brand-border">
          <ol className="space-y-2">
            {steps.map((step, i) => (
              <li key={i} className="flex items-start gap-3 text-sm text-slate-400">
                <span className="flex-shrink-0 w-5 h-5 rounded-full bg-indigo-900/60 border border-indigo-700/50 text-indigo-300 text-xs font-bold flex items-center justify-center mt-0.5">
                  {i + 1}
                </span>
                <span className="leading-relaxed">{step}</span>
              </li>
            ))}
          </ol>
        </div>
      )}
    </div>
  )
}

// ─── Telegram Section ──────────────────────────────────────────────────────────
function TelegramSection({ settings }: { settings: Settings | null }) {
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null)

  async function handleTest() {
    setTesting(true)
    setTestResult(null)
    try {
      const res = await testTelegram()
      setTestResult(res)
    } catch {
      setTestResult({ ok: false, message: "Network error — could not reach backend" })
    } finally {
      setTesting(false)
    }
  }

  const tg = settings?.telegram

  return (
    <SectionCard title="📱 Telegram Notifications">
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-400">
          Receive approval requests directly in your Telegram chat
        </p>
        {tg ? <StatusPill configured={tg.configured} /> : <Skeleton className="h-6 w-28" />}
      </div>

      {tg ? (
        <div className="space-y-1">
          <ConfigRow label="Bot Token" value={tg.bot_token_preview} mono />
          <ConfigRow label="Chat ID" value={tg.chat_id} mono />
        </div>
      ) : (
        <Skeleton className="h-16" />
      )}

      {/* Test button */}
      <div className="flex items-center gap-3">
        <button
          onClick={handleTest}
          disabled={testing || !tg?.configured}
          className={`
            flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium
            border transition-all duration-150
            ${
              tg?.configured
                ? "bg-indigo-700 hover:bg-indigo-600 text-white border-indigo-600/50 shadow-lg shadow-indigo-900/30"
                : "bg-slate-800 text-slate-600 border-slate-700 cursor-not-allowed"
            }
            disabled:opacity-60
          `}
        >
          {testing ? (
            <>
              <span className="inline-block w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              Sending...
            </>
          ) : (
            <>📨 Send Test Message</>
          )}
        </button>

        {!tg?.configured && (
          <span className="text-xs text-slate-600 italic">Configure Telegram first</span>
        )}
      </div>

      {/* Test result */}
      {testResult && (
        <div
          className={`flex items-start gap-2 px-4 py-3 rounded-lg border text-sm ${
            testResult.ok
              ? "bg-emerald-900/20 border-emerald-700/40 text-emerald-300"
              : "bg-red-900/20 border-red-700/40 text-red-300"
          }`}
        >
          <span>{testResult.ok ? "✅" : "❌"}</span>
          <span>{testResult.message}</span>
        </div>
      )}

      <InstructionBox
        steps={[
          "Open Telegram and search for @BotFather",
          'Send /newbot and follow the instructions to create your bot',
          <span key="3">
            Copy the bot token and add it to{" "}
            <code className="bg-brand-bg text-emerald-300 px-1.5 py-0.5 rounded font-mono text-xs">
              backend/.env
            </code>{" "}
            as{" "}
            <code className="bg-brand-bg text-emerald-300 px-1.5 py-0.5 rounded font-mono text-xs">
              TELEGRAM_BOT_TOKEN=your_token
            </code>
          </span>,
          "Start a chat with your newly created bot and send any message",
          <span key="5">
            Visit{" "}
            <code className="bg-brand-bg text-blue-300 px-1.5 py-0.5 rounded font-mono text-xs">
              https://api.telegram.org/bot{"TOKEN"}/getUpdates
            </code>{" "}
            (replace TOKEN) to find your chat_id in the response
          </span>,
          <span key="6">
            Add it to{" "}
            <code className="bg-brand-bg text-emerald-300 px-1.5 py-0.5 rounded font-mono text-xs">
              .env
            </code>{" "}
            as{" "}
            <code className="bg-brand-bg text-emerald-300 px-1.5 py-0.5 rounded font-mono text-xs">
              TELEGRAM_CHAT_ID=your_chat_id
            </code>
          </span>,
          "Restart the backend server for changes to take effect",
        ]}
      />
    </SectionCard>
  )
}

// ─── Gemini Section ────────────────────────────────────────────────────────────
function GeminiSection({ settings }: { settings: Settings | null }) {
  const gm = settings?.gemini

  return (
    <SectionCard title="🧠 Gemini AI Analysis">
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-400">
          Powers the risk classification engine using Gemini 2.0 Flash
        </p>
        {gm ? <StatusPill configured={gm.configured} /> : <Skeleton className="h-6 w-28" />}
      </div>

      {gm ? (
        <ConfigRow label="API Key" value={gm.key_preview} mono />
      ) : (
        <Skeleton className="h-10" />
      )}

      <div className="bg-brand-bg/40 border border-brand-border rounded-lg px-4 py-3 text-sm text-slate-400 leading-relaxed">
        <p>
          Gemini analyzes tool calls that pass static rule checks and are classified as{" "}
          <span className="text-amber-300 font-medium">HIGH</span> or{" "}
          <span className="text-red-300 font-medium">CRITICAL</span> risk. It evaluates intent,
          potential impact, and assigns a confidence score before routing for human approval.
        </p>
      </div>

      <InstructionBox
        steps={[
          <span key="1">
            Go to{" "}
            <a
              href="https://aistudio.google.com/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-400 hover:text-blue-300 underline"
            >
              https://aistudio.google.com/
            </a>
          </span>,
          'Click "Get API Key" in the left sidebar',
          "Create a new API key for your project",
          <span key="4">
            Copy the key and add it to{" "}
            <code className="bg-brand-bg text-emerald-300 px-1.5 py-0.5 rounded font-mono text-xs">
              backend/.env
            </code>{" "}
            as{" "}
            <code className="bg-brand-bg text-emerald-300 px-1.5 py-0.5 rounded font-mono text-xs">
              GEMINI_API_KEY=your_key
            </code>
          </span>,
          "Restart the backend server",
        ]}
      />
    </SectionCard>
  )
}

// ─── Auth0 Section ─────────────────────────────────────────────────────────────
function Auth0Section({ settings }: { settings: Settings | null }) {
  const au = settings?.auth0
  const [vault, setVault] = useState<{
    enabled?: boolean
    auth0_configured?: boolean
    authenticated?: boolean
    login_url?: string
  } | null>(null)

  useEffect(() => {
    let mounted = true
    ;(async () => {
      try {
        const data = await fetchTokenVaultStatus()
        if (mounted) setVault(data)
      } catch {
        if (mounted) setVault(null)
      }
    })()
    return () => {
      mounted = false
    }
  }, [])

  return (
    <SectionCard title="🔐 Auth0 Token Vault">
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-400">
          Issues short-lived, scoped tokens for each approved tool call
        </p>
        {au ? <StatusPill configured={au.configured} /> : <Skeleton className="h-6 w-28" />}
      </div>

      {au ? (
        <div className="space-y-1">
          <ConfigRow label="Domain" value={au.domain} mono />
          <ConfigRow label="Audience" value={au.audience} mono />
          <ConfigRow label="Client ID" value={au.client_id_preview} mono />
          <ConfigRow label="Callback URL" value={au.callback_url} mono />
          <ConfigRow label="Scope" value={au.scope} mono />
          <ConfigRow label="Token Vault Enabled" value={au.token_vault_enabled ? "Yes" : "No"} />
          <ConfigRow label="Google Connection" value={au.google_connection_name} mono />
          <ConfigRow label="Google Audience" value={au.google_audience} mono />
          <ConfigRow label="Google Scopes" value={au.google_scopes} mono />
          <ConfigRow label="GitHub Connection" value={au.github_connection_name} mono />
          <ConfigRow label="Slack Connection" value={au.slack_connection_name} mono />
        </div>
      ) : (
        <Skeleton className="h-32" />
      )}

      {vault && (
        <div className="bg-brand-bg/40 border border-brand-border rounded-lg px-4 py-3 text-xs text-slate-300 space-y-1">
          <p>
            Vault runtime:{" "}
            <span className={vault.enabled ? "text-emerald-300" : "text-red-300"}>
              {vault.enabled ? "enabled" : "disabled"}
            </span>
          </p>
          <p>
            User session for connected accounts:{" "}
            <span className={vault.authenticated ? "text-emerald-300" : "text-amber-300"}>
              {vault.authenticated ? "authenticated" : "missing"}
            </span>
          </p>
          {!vault.authenticated && vault.login_url && (
            <a
              href={vault.login_url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-400 hover:text-blue-300 underline"
            >
              Connect account (Auth0 login)
            </a>
          )}
        </div>
      )}

      {/* Explanation box */}
      <div className="bg-indigo-900/20 border border-indigo-800/40 rounded-xl p-4 space-y-3">
        <p className="text-sm font-semibold text-indigo-300">🛡️ Why Auth0 Token Vault?</p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="bg-red-900/20 border border-red-800/30 rounded-lg px-3 py-3">
            <p className="text-xs font-bold text-red-400 mb-2">❌ Before Agent-Lock</p>
            <p className="text-xs text-slate-400 leading-relaxed">
              The AI agent holds your real API keys and credentials permanently. Any compromised
              agent or prompt injection can exfiltrate them and access all your services.
            </p>
          </div>
          <div className="bg-emerald-900/20 border border-emerald-800/30 rounded-lg px-3 py-3">
            <p className="text-xs font-bold text-emerald-400 mb-2">✅ After Agent-Lock</p>
            <p className="text-xs text-slate-400 leading-relaxed">
              For connected providers (Google/GitHub/Slack), Agent-Lock now uses Auth0 Token Vault
              token exchange and can broker API calls server-side so the agent does not need to
              hold provider tokens.
            </p>
          </div>
        </div>
      </div>

      <InstructionBox
        steps={[
          <span key="1">
            Create a free account at{" "}
            <a
              href="https://auth0.com"
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-400 hover:text-blue-300 underline"
            >
              auth0.com
            </a>
          </span>,
          <span key="2">
            Create an <strong className="text-slate-300">API</strong> with audience{" "}
            <code className="bg-brand-bg text-blue-300 px-1.5 py-0.5 rounded font-mono text-xs">
              https://agent-lock-api
            </code>
          </span>,
          "Create a Machine-to-Machine application and authorize it against your API",
          "Enable Token Vault and configure Connected Accounts for your provider connection (for demo: google-oauth2)",
          <span key="4">
            Copy the <strong className="text-slate-300">Domain</strong>,{" "}
            <strong className="text-slate-300">Client ID</strong>, and{" "}
            <strong className="text-slate-300">Client Secret</strong> into{" "}
            <code className="bg-brand-bg text-emerald-300 px-1.5 py-0.5 rounded font-mono text-xs">
              backend/.env
            </code>{" "}
            as{" "}
            <code className="bg-brand-bg text-emerald-300 px-1.5 py-0.5 rounded font-mono text-xs">
              AUTH0_DOMAIN
            </code>
            ,{" "}
            <code className="bg-brand-bg text-emerald-300 px-1.5 py-0.5 rounded font-mono text-xs">
              AUTH0_CLIENT_ID
            </code>
            ,{" "}
            <code className="bg-brand-bg text-emerald-300 px-1.5 py-0.5 rounded font-mono text-xs">
              AUTH0_CLIENT_SECRET
            </code>
          </span>,
          "Restart the backend server",
          "For brokered Gmail demo, call POST /vault/google/gmail/send after authenticating with /auth/login?connection=google-oauth2",
        ]}
      />
    </SectionCard>
  )
}

// ─── Policies Section ──────────────────────────────────────────────────────────
function PoliciesSection() {
  const [policies, setPolicies] = useState<PoliciesResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [editing, setEditing] = useState(false)
  const [jsonText, setJsonText] = useState("")
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "success" | "error">("idle")
  const [saveMessage, setSaveMessage] = useState("")

  const loadPolicies = useCallback(async () => {
    try {
      const data = await fetchPolicies()
      setPolicies(data as PoliciesResponse)
      setJsonText(JSON.stringify(data, null, 2))
      setError(false)
    } catch {
      setError(true)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadPolicies()
  }, [loadPolicies])

  async function handleSave() {
    setSaveStatus("saving")
    setSaveMessage("")
    try {
      const parsed = JSON.parse(jsonText)
      await updatePolicies(parsed)
      setSaveStatus("success")
      setSaveMessage("Policies saved successfully!")
      setEditing(false)
      await loadPolicies()
    } catch (e) {
      setSaveStatus("error")
      setSaveMessage(
        e instanceof SyntaxError
          ? "Invalid JSON — please check your syntax"
          : "Failed to save policies — check backend connection"
      )
    }
    setTimeout(() => setSaveStatus("idle"), 4000)
  }

  const actionColor: Record<string, string> = {
    APPROVE: "bg-emerald-900/50 text-emerald-300 border-emerald-700/50",
    BLOCK: "bg-red-900/50 text-red-300 border-red-700/50",
    REQUIRE_APPROVAL: "bg-amber-900/50 text-amber-300 border-amber-700/50",
    MONITOR: "bg-blue-900/50 text-blue-300 border-blue-700/50",
  }

  return (
    <SectionCard title="📋 Security Policies">
      <p className="text-sm text-slate-400">
        Rules that govern how tool calls are classified and handled. Evaluated before AI analysis.
      </p>

      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-12" />
          ))}
        </div>
      ) : error ? (
        <div className="text-center py-6">
          <p className="text-red-400 text-sm">⚠️ Error loading policies</p>
          <button
            onClick={loadPolicies}
            className="mt-2 text-xs text-indigo-400 hover:text-indigo-300 underline"
          >
            Retry
          </button>
        </div>
      ) : !editing ? (
        <>
          {/* Policy list */}
          {policies?.policies && policies.policies.length > 0 ? (
            <div className="space-y-2">
              {policies.policies.map((p) => (
                <div
                  key={p.id}
                  className="flex items-start justify-between gap-3 bg-brand-bg/40 border border-brand-border rounded-lg px-4 py-3"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <code className="text-xs text-indigo-300 font-mono bg-indigo-900/30 px-1.5 py-0.5 rounded">
                        {p.id}
                      </code>
                      <code className="text-xs text-slate-400 font-mono truncate max-w-[180px]">
                        {p.tool_pattern}
                      </code>
                    </div>
                    {p.description && (
                      <p className="text-xs text-slate-500 mt-0.5">{p.description}</p>
                    )}
                  </div>
                  <span
                    className={`flex-shrink-0 text-xs font-semibold px-2.5 py-1 rounded-full border ${
                      actionColor[p.action] ?? "bg-slate-800 text-slate-400 border-slate-700"
                    }`}
                  >
                    {p.action}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div className="py-6 text-center text-slate-600 text-sm">
              No policies configured yet
            </div>
          )}

          <button
            onClick={() => {
              setEditing(true)
              setSaveStatus("idle")
            }}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-brand-bg border border-brand-border text-slate-300 hover:text-white hover:border-slate-500 transition-all"
          >
            ✏️ Edit as JSON
          </button>
        </>
      ) : (
        <>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-500 uppercase tracking-wider">
                Edit Policies JSON
              </span>
              <span className="text-xs text-slate-600">
                PUT /settings/policies
              </span>
            </div>
            <textarea
              value={jsonText}
              onChange={(e) => setJsonText(e.target.value)}
              rows={18}
              className="w-full bg-brand-bg border border-brand-border rounded-lg px-3 py-3 text-xs text-emerald-300 font-mono focus:outline-none focus:border-indigo-600 transition-colors resize-y leading-relaxed"
              spellCheck={false}
            />
          </div>

          {saveStatus !== "idle" && (
            <div
              className={`flex items-center gap-2 px-4 py-3 rounded-lg border text-sm ${
                saveStatus === "success"
                  ? "bg-emerald-900/20 border-emerald-700/40 text-emerald-300"
                  : saveStatus === "error"
                  ? "bg-red-900/20 border-red-700/40 text-red-300"
                  : "bg-brand-bg border-brand-border text-slate-400"
              }`}
            >
              {saveStatus === "saving" && (
                <span className="inline-block w-3.5 h-3.5 border-2 border-slate-400/30 border-t-slate-300 rounded-full animate-spin" />
              )}
              <span>
                {saveStatus === "saving" ? "Saving policies..." : saveMessage}
              </span>
            </div>
          )}

          <div className="flex items-center gap-3">
            <button
              onClick={handleSave}
              disabled={saveStatus === "saving"}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-indigo-700 hover:bg-indigo-600 text-white border border-indigo-600/50 disabled:opacity-60 transition-all shadow-lg shadow-indigo-900/30"
            >
              {saveStatus === "saving" ? (
                <>
                  <span className="inline-block w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Saving...
                </>
              ) : (
                "💾 Save Policies"
              )}
            </button>
            <button
              onClick={() => {
                setEditing(false)
                setJsonText(JSON.stringify(policies, null, 2))
                setSaveStatus("idle")
              }}
              className="px-4 py-2 rounded-lg text-sm text-slate-400 hover:text-slate-200 bg-brand-bg border border-brand-border transition-all"
            >
              Cancel
            </button>
          </div>
        </>
      )}
    </SectionCard>
  )
}

// ─── Server Info Section ───────────────────────────────────────────────────────
function ServerSection({ settings }: { settings: Settings | null }) {
  const sv = settings?.server
  const sec = settings?.security

  return (
    <SectionCard title="🖥️ Server Configuration">
      {sv ? (
        <div className="space-y-1">
          <ConfigRow label="Backend URL" value={sv.backend_url} mono />
          <ConfigRow label="Port" value={String(sv.port)} mono />
          <ConfigRow label="Audit Log" value={sv.audit_log_path} mono />
        </div>
      ) : (
        <Skeleton className="h-24" />
      )}

      {sec?.secret_key_is_default && (
        <div className="bg-red-900/20 border border-red-700/40 rounded-lg px-4 py-3 flex items-start gap-3">
          <span className="text-red-400 text-lg flex-shrink-0">⚠️</span>
          <div>
            <p className="text-sm font-semibold text-red-300">Default secret key detected</p>
            <p className="text-xs text-red-400 mt-0.5">
              You are using the default HMAC secret key. Set a strong random{" "}
              <code className="font-mono bg-red-900/40 px-1 rounded">SECRET_KEY</code> in your{" "}
              <code className="font-mono bg-red-900/40 px-1 rounded">backend/.env</code> before
              going to production.
            </p>
          </div>
        </div>
      )}
    </SectionCard>
  )
}

// ─── Main Page ─────────────────────────────────────────────────────────────────
export default function SettingsPage() {
  const [settings, setSettings] = useState<Settings | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  const loadSettings = useCallback(async () => {
    try {
      const data = await fetchSettings()
      setSettings(data as Settings)
      setError(false)
    } catch {
      setError(true)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadSettings()
  }, [loadSettings])

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Settings</h1>
          <p className="text-slate-500 text-sm mt-0.5">
            Configure integrations, policies, and server options
          </p>
        </div>
        <button
          onClick={loadSettings}
          className="text-xs text-indigo-400 hover:text-indigo-300 bg-brand-card border border-brand-border rounded-lg px-3 py-2 transition-colors"
        >
          ↻ Refresh
        </button>
      </div>

      {/* Global error */}
      {error && !loading && (
        <div className="bg-red-900/20 border border-red-700/40 rounded-xl px-5 py-4 flex items-center gap-3 text-red-300 text-sm">
          <span className="text-xl">⚠️</span>
          <div>
            <p className="font-semibold">Error loading settings</p>
            <p className="text-red-400 text-xs mt-0.5">
              Make sure the backend is running at http://localhost:8000
            </p>
          </div>
          <button
            onClick={loadSettings}
            className="ml-auto text-xs bg-red-800/40 hover:bg-red-700/40 border border-red-700/40 rounded-lg px-3 py-1.5 transition-colors"
          >
            Retry
          </button>
        </div>
      )}

      {/* Loading skeleton for entire settings */}
      {loading && (
        <div className="space-y-6">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-48 rounded-xl" />
          ))}
        </div>
      )}

      {/* Settings sections */}
      {!loading && (
        <div className="space-y-6">
          <OpenClawSection />
          <TelegramSection settings={settings} />
          <GeminiSection settings={settings} />
          <Auth0Section settings={settings} />
          <PoliciesSection />
          <ServerSection settings={settings} />
        </div>
      )}
    </div>
  )
}
