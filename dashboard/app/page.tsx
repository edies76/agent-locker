"use client"

import Link from "next/link"
import Image from "next/image"
import type { ReactNode } from "react"
import { useEffect, useRef, useCallback } from "react"
import InstallWidget from "./components/InstallWidget"

// ─── Interactive Particle Canvas ──────────────────────────────────────────────
function ParticleCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const mouseRef = useRef({ x: -9999, y: -9999 })
  const animRef = useRef<number>(0)

  const init = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext("2d")
    if (!ctx) return

    let W = (canvas.width = window.innerWidth)
    let H = (canvas.height = window.innerHeight)

    const COUNT = Math.min(Math.floor((W * H) / 12000), 90)
    const CONNECT_DIST = 140
    const MOUSE_PUSH = 110
    const COLORS = ["#e11d48", "#be123c", "#f43f5e", "#fb7185", "#9f1239"]

    type Particle = {
      x: number; y: number
      vx: number; vy: number
      r: number; color: string
      opacity: number; opDir: number
    }

    const particles: Particle[] = Array.from({ length: COUNT }, () => ({
      x: Math.random() * W,
      y: Math.random() * H,
      vx: (Math.random() - 0.5) * 0.35,
      vy: (Math.random() - 0.5) * 0.35,
      r: Math.random() * 1.8 + 0.8,
      color: COLORS[Math.floor(Math.random() * COLORS.length)],
      opacity: Math.random() * 0.5 + 0.2,
      opDir: Math.random() > 0.5 ? 1 : -1,
    }))

    function draw() {
      ctx.clearRect(0, 0, W, H)
      const mx = mouseRef.current.x
      const my = mouseRef.current.y

      for (const p of particles) {
        // Move
        p.x += p.vx
        p.y += p.vy
        // Drift opacity
        p.opacity += p.opDir * 0.003
        if (p.opacity > 0.75 || p.opacity < 0.12) p.opDir *= -1

        // Wall bounce
        if (p.x < 0 || p.x > W) p.vx *= -1
        if (p.y < 0 || p.y > H) p.vy *= -1

        // Mouse repulsion
        const dx = p.x - mx
        const dy = p.y - my
        const dist = Math.sqrt(dx * dx + dy * dy)
        if (dist < MOUSE_PUSH && dist > 0) {
          const force = (MOUSE_PUSH - dist) / MOUSE_PUSH
          p.x += (dx / dist) * force * 2.2
          p.y += (dy / dist) * force * 2.2
        }

        // Draw dot
        ctx.beginPath()
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2)
        ctx.fillStyle = p.color
        ctx.globalAlpha = p.opacity
        ctx.fill()
      }

      // Connections
      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const a = particles[i], b = particles[j]
          const dx = a.x - b.x
          const dy = a.y - b.y
          const d = Math.sqrt(dx * dx + dy * dy)
          if (d < CONNECT_DIST) {
            ctx.beginPath()
            ctx.moveTo(a.x, a.y)
            ctx.lineTo(b.x, b.y)
            const alpha = (1 - d / CONNECT_DIST) * 0.12
            ctx.globalAlpha = alpha
            ctx.strokeStyle = "#e11d48"
            ctx.lineWidth = 0.6
            ctx.stroke()
          }
        }
      }

      // Mouse proximity glow on nearest particles
      for (const p of particles) {
        const dx = p.x - mx
        const dy = p.y - my
        const d = Math.sqrt(dx * dx + dy * dy)
        if (d < 80) {
          ctx.beginPath()
          ctx.arc(p.x, p.y, p.r + 2, 0, Math.PI * 2)
          ctx.fillStyle = p.color
          ctx.globalAlpha = (1 - d / 80) * 0.4
          ctx.fill()
        }
      }

      ctx.globalAlpha = 1
      animRef.current = requestAnimationFrame(draw)
    }

    animRef.current = requestAnimationFrame(draw)

    const onResize = () => {
      W = canvas.width = window.innerWidth
      H = canvas.height = window.innerHeight
    }
    window.addEventListener("resize", onResize)
    return () => window.removeEventListener("resize", onResize)
  }, [])

  useEffect(() => {
    const cleanup = init()
    const onMove = (e: MouseEvent) => {
      mouseRef.current = { x: e.clientX, y: e.clientY }
    }
    const onLeave = () => {
      mouseRef.current = { x: -9999, y: -9999 }
    }
    window.addEventListener("mousemove", onMove)
    window.addEventListener("mouseleave", onLeave)
    return () => {
      cancelAnimationFrame(animRef.current)
      window.removeEventListener("mousemove", onMove)
      window.removeEventListener("mouseleave", onLeave)
      cleanup?.()
    }
  }, [init])

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 z-[-1] pointer-events-none"
      style={{ opacity: 0.55 }}
    />
  )
}

// ─── Design primitives ────────────────────────────────────────────────────────

function GlassPanel({
  children,
  className = "",
  noPad = false,
}: {
  children: ReactNode
  className?: string
  noPad?: boolean
}) {
  return (
    <div
      className={`relative overflow-hidden rounded-3xl border border-white/10 bg-white/[0.04] backdrop-blur-xl shadow-2xl
        ${noPad ? "" : "p-6 md:p-8"} ${className}`}
    >
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent" />
      {children}
    </div>
  )
}

function Tag({ children, color = "emerald" }: { children: ReactNode; color?: "emerald" | "blue" | "amber" | "indigo" | "purple" }) {
  const map: Record<string, string> = {
    emerald: "bg-rose-500/10 text-rose-400 border-rose-500/20",
    blue: "bg-red-500/10 text-red-400 border-red-500/20",
    amber: "bg-orange-500/10 text-orange-400 border-orange-500/20",
    indigo: "bg-rose-600/10 text-rose-300 border-rose-600/20",
    purple: "bg-pink-600/10 text-pink-400 border-pink-600/20",
  }
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-widest ${map[color]}`}>
      {children}
    </span>
  )
}

function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <p className="mb-3 text-xs font-bold uppercase tracking-[0.2em] text-rose-400">{children}</p>
  )
}

function SectionHeading({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <h2 className={`text-4xl font-semibold text-white tracking-tight leading-tight ${className}`}>
      {children}
    </h2>
  )
}

// ─── Data ─────────────────────────────────────────────────────────────────────

const features = [
  {
    icon: "⚡",
    color: "emerald" as const,
    title: "Automatic Lane",
    desc: "Safe, scoped actions move through cleanly without human intervention when policy allows it. Low-risk ops execute at full agent speed.",
  },
  {
    icon: "🛡️",
    color: "amber" as const,
    title: "Approval Lane",
    desc: "Sensitive operations pause automatically. A Telegram card is sent requesting explicit human confirmation before any action is taken.",
  },
  {
    icon: "📋",
    color: "blue" as const,
    title: "Immutable Audit Trail",
    desc: "Every execution is cryptographically logged in structured JSON. Filter, query, and trace exactly how each action was decided and handled.",
  },
  {
    icon: "🧠",
    color: "purple" as const,
    title: "Intent Validation",
    desc: "Gemini Flash semantically compares the agent's action against the original user instruction. Drift is detected before it becomes a breach.",
  },
  {
    icon: "🔑",
    color: "indigo" as const,
    title: "Ephemeral Token Vault",
    desc: "Auth0-backed M2M tokens are minted at execution time with minimum-required scopes. Long-lived credentials never reach the agent.",
  },
  {
    icon: "⚖️",
    color: "emerald" as const,
    title: "Hybrid Risk Classifier",
    desc: "Static regex rules catch obvious threats instantly. AI escalation layers on top for nuanced semantic risk — without hallucinating false positives.",
  },
]

const surfaces = [
  { href: "/dashboard/overview", title: "Overview", desc: "System health, activity, risk distribution, and approval workflows in one place.", badge: "Operations", n: "01" },
  { href: "/dashboard/approvals", title: "Approvals", desc: "Review pending actions, inspect arguments, and approve or reject with full context.", badge: "Human Review", n: "02" },
  { href: "/dashboard/settings", title: "Settings", desc: "Define what stays automatic, what pauses for approval, and which tool scopes are active.", badge: "Policy", n: "03" },
  { href: "/dashboard/mcp", title: "MCP Gateway", desc: "Monitor connected MCP servers, check timings, and inspect diagnostics live.", badge: "Gateway", n: "04" },
  { href: "/dashboard/plugin", title: "Plugin Bridge", desc: "Manage OpenClaw pairing, chat relay, and bridge state for governed execution.", badge: "Bridge", n: "05" },
  { href: "/dashboard/logs", title: "Audit Logs", desc: "Filter immutable audit events and trace exactly how each action was handled.", badge: "Audit", n: "06" },
]

const testimonials = [
  { author: "yash (@yashns1)", text: "The mental model shift is what makes this interesting. Agents aren't tools you prompt — they're workers operating inside a controlled boundary. That's architecturally correct." },
  { author: "Resolver Vicky (@resolvervicky)", text: "OpenClaw is the employee. Agent-Lock is the compliance department. Finally someone built the layer between the two." },
  { author: "Logan (@logansaether)", text: "When I first started working with autonomous agents, this was the governance vision I had. Nobody else built it this way. This is the right model." },
]

const howItWorks = [
  { step: "01", title: "Agent makes a tool call", body: "The OpenClaw plugin intercepts the call before it touches any external API or system." },
  { step: "02", title: "Context is extracted", body: "The original user instruction is captured via onMessage hook and compared against the agent's attempted action." },
  { step: "03", title: "Risk is classified", body: "Static rules run first. If the action is ambiguous, Gemini Flash performs semantic intent validation." },
  { step: "04", title: "Auto-execute or pause", body: "LOW risk? A scoped token is minted and execution proceeds. HIGH/CRITICAL? The flow pauses and you receive a Telegram approval card." },
  { step: "05", title: "Audit log is written", body: "Every outcome — approved, blocked, or automatic — is appended to the immutable audit log in structured JSON." },
]

const faqs = [
  {
    q: "Which AI agents does Agent-Lock support?",
    a: "Agent-Lock currently ships a first-class plugin for OpenClaw. The backend API contract is agent-agnostic — any agent that makes HTTP tool calls can be intercepted via the /intercept endpoint.",
  },
  {
    q: "What happens when the AI service is unavailable?",
    a: "If Gemini Flash is unreachable, Agent-Lock falls back to keyword-based static rules. No tool call is allowed to proceed without a classification decision.",
  },
  {
    q: "How does the Token Vault keep credentials secure?",
    a: "Agent-Lock integrates with Auth0 using the M2M client_credentials flow or a federated token exchange. Scoped tokens are minted per-execution and are never stored long-term.",
  },
  {
    q: "Can I customise which actions require approval?",
    a: "Yes. The Settings dashboard lets you configure approval thresholds per tool, per scope, and per risk level. Custom business rules are supported via policies.json.",
  },
  {
    q: "Is this open source?",
    a: "The project is open source and self-hosted. Your agents, your infrastructure, your audit logs. No data leaves your environment unless you configure it to.",
  },
]

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function LandingPage() {
  return (
    <main className="relative min-h-screen overflow-x-hidden selection:bg-emerald-500/30 selection:text-white">
      {/* ── Background ─────────────────────────────────────────────────── */}
      <div className="fixed inset-0 z-[-3] bg-[#030712]" />
      <ParticleCanvas />
      <div className="fixed inset-0 z-[-1] overflow-hidden pointer-events-none">
        <div className="absolute left-[-5%] top-[-15%] h-[700px] w-[700px] rounded-full bg-rose-700/[0.08] blur-[140px]" />
        <div className="absolute right-[-5%] top-[15%] h-[600px] w-[600px] rounded-full bg-red-700/[0.06] blur-[130px]" />
        <div className="absolute left-[35%] bottom-[-10%] h-[500px] w-[500px] rounded-full bg-rose-900/[0.07] blur-[120px]" />
      </div>

      <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">

        {/* ── Navigation ─────────────────────────────────────────────────── */}
        <nav className="fixed top-4 left-1/2 -translate-x-1/2 z-50 w-full max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-[#030712]/85 px-5 py-3 backdrop-blur-xl shadow-xl shadow-black/40">
            <div className="flex items-center gap-3">
              <Image src="/logo.jpeg" alt="Agent-Lock" width={36} height={36} className="rounded-xl object-cover shadow-lg shadow-rose-900/40" />
              <div>
                <p className="text-[10px] uppercase tracking-widest text-rose-400 font-semibold leading-none">Security Middleware</p>
                <p className="text-sm font-semibold tracking-wide text-white leading-tight mt-0.5">Agent-Lock</p>
              </div>
            </div>
            <div className="hidden md:flex items-center gap-6">
              <a href="#how-it-works" className="text-sm text-gray-400 hover:text-white transition-colors">How it works</a>
              <a href="#features" className="text-sm text-gray-400 hover:text-white transition-colors">Features</a>
              <a href="#architecture" className="text-sm text-gray-400 hover:text-white transition-colors">Architecture</a>
              <a href="#faq" className="text-sm text-gray-400 hover:text-white transition-colors">FAQ</a>
            </div>
            <div className="flex items-center gap-3">
              <div className="hidden sm:flex items-center gap-1.5 rounded-full border border-rose-500/20 bg-rose-500/10 px-3 py-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-rose-500 animate-pulse" />
                <span className="text-[11px] font-semibold text-rose-400">Live</span>
              </div>
              <Link
                href="/dashboard/overview"
                className="rounded-xl bg-white px-5 py-2 text-sm font-semibold text-gray-900 hover:bg-gray-100 transition-colors shadow-lg"
              >
                Open Dashboard →
              </Link>
            </div>
          </div>
        </nav>

        {/* ── Hero ───────────────────────────────────────────────────────── */}
        <section className="relative pt-36 pb-20 text-center flex flex-col items-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-1.5 backdrop-blur-sm mb-8">
            <span className="h-2 w-2 rounded-full bg-rose-500 animate-pulse" />
            <span className="text-xs font-medium text-gray-300">Zero Trust | Human in the Loop | Open Source</span>
          </div>

          <h1 className="max-w-5xl text-5xl sm:text-6xl md:text-[5.5rem] font-extrabold tracking-tight text-white mb-8 leading-[1.05]">
            The security layer<br className="hidden md:block" />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-rose-400 via-red-400 to-rose-300">
              {" "}AI agents are missing.
            </span>
          </h1>

          <p className="max-w-2xl text-lg text-gray-400 mb-6 leading-relaxed">
            Agent-Lock sits between AI agents and tools. It classifies risk, enforces approval policies, mints ephemeral scoped tokens, and gives operators a single control plane — without slowing down safe operations.
          </p>

          <InstallWidget showDocumentationLink={true} />

          <div className="flex flex-wrap items-center justify-center gap-4 mt-4">
            <Link
              href="/dashboard/overview"
              className="rounded-xl bg-gradient-to-r from-rose-700 to-red-500 px-8 py-4 text-sm font-semibold text-white shadow-[0_0_40px_-12px_rgba(225,29,72,0.5)] transition-all hover:scale-105 hover:shadow-[0_0_60px_-12px_rgba(225,29,72,0.65)]"
            >
              Open Dashboard
            </Link>
            <a
              href="#how-it-works"
              className="rounded-xl border border-white/10 bg-white/5 px-8 py-4 text-sm font-semibold text-white backdrop-blur-md transition-all hover:bg-white/10"
            >
              See how it works ↓
            </a>
          </div>

          {/* Stats row */}
          <div className="mt-20 flex flex-wrap items-center justify-center gap-8 text-center">
            {[
              { value: "< 10ms", label: "Classification overhead" },
              { value: "3-tier", label: "LOW / HIGH / CRITICAL risk" },
              { value: "100%", label: "Audit coverage" },
              { value: "Auth0", label: "Token vault backing" },
            ].map((s) => (
              <div key={s.label} className="flex flex-col items-center">
                <span className="text-3xl font-extrabold text-white tracking-tight">{s.value}</span>
                <span className="text-xs text-gray-500 mt-1 uppercase tracking-wider">{s.label}</span>
              </div>
            ))}
          </div>
        </section>

        {/* ── Social proof ───────────────────────────────────────────────── */}
        <section className="mb-28 overflow-hidden">
          <div className="grid md:grid-cols-3 gap-5">
            {testimonials.map((t, i) => (
              <GlassPanel key={i}>
                <p className="text-gray-300 text-sm leading-relaxed mb-5">&ldquo;{t.text}&rdquo;</p>
                <p className="text-xs text-gray-500 font-medium">{t.author}</p>
              </GlassPanel>
            ))}
          </div>
        </section>

        {/* ── How it works ───────────────────────────────────────────────── */}
        <section id="how-it-works" className="mb-32 scroll-mt-24">
          <div className="text-center mb-16">
            <SectionLabel>How it works</SectionLabel>
            <SectionHeading>Five steps from intent to execution.</SectionHeading>
            <p className="mt-4 text-gray-400 max-w-2xl mx-auto text-base leading-relaxed">
              Every tool call passes through a deterministic pipeline. Nothing executes without a classification decision. Nothing is classified without a risk score.
            </p>
          </div>

          <div className="relative">
            {/* Connecting line */}
            <div className="absolute left-[calc(50%-1px)] top-0 bottom-0 hidden lg:block w-px bg-gradient-to-b from-rose-500/0 via-rose-500/30 to-rose-500/0" />

            <div className="flex flex-col gap-8">
              {howItWorks.map((item, i) => (
                <div
                  key={i}
                  className={`flex flex-col lg:flex-row items-center gap-8 ${i % 2 === 1 ? "lg:flex-row-reverse" : ""}`}
                >
                  <GlassPanel className="flex-1">
                    <div className="flex items-start gap-4">
                      <span className="text-4xl font-black text-white/10 leading-none tabular-nums">{item.step}</span>
                      <div>
                        <h3 className="text-lg font-semibold text-white mb-2">{item.title}</h3>
                        <p className="text-sm text-gray-400 leading-relaxed">{item.body}</p>
                      </div>
                    </div>
                  </GlassPanel>
                  <div className="hidden lg:flex h-10 w-10 items-center justify-center rounded-full border border-rose-500/30 bg-rose-500/10 text-rose-400 text-sm font-bold shrink-0 z-10">
                    {i + 1}
                  </div>
                  <div className="flex-1 hidden lg:block" />
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── Features bento ─────────────────────────────────────────────── */}
        <section id="features" className="mb-32 scroll-mt-24">
          <div className="text-center mb-16">
            <SectionLabel>Core capabilities</SectionLabel>
            <SectionHeading>Everything a governed AI deployment needs.</SectionHeading>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {features.map((f, i) => (
              <GlassPanel key={i} className="group hover:-translate-y-1 transition-transform duration-300">
                <div className="flex items-center gap-3 mb-5">
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-2xl">
                    {f.icon}
                  </div>
                  <Tag color={f.color}>{f.title}</Tag>
                </div>
                <p className="text-sm text-gray-400 leading-relaxed">{f.desc}</p>
              </GlassPanel>
            ))}
          </div>
        </section>

        {/* ── Architecture ───────────────────────────────────────────────── */}
        <section id="architecture" className="mb-32 scroll-mt-24">
          <div className="grid lg:grid-cols-2 gap-8 items-center">
            <div>
              <SectionLabel>Architecture</SectionLabel>
              <SectionHeading className="mb-6">Semantic firewall,<br />not a proxy.</SectionHeading>
              <p className="text-gray-400 leading-relaxed mb-8">
                Agent-Lock is not a plain reverse proxy. The pipeline runs an intent validation check against the user&apos;s original instruction, a hybrid static+AI risk classifier, and an Auth0-backed token vault — all before a single tool is touched.
              </p>

              <div className="space-y-4">
                {[
                  { label: "Intent Validator", detail: "Gemini Flash — semantic drift detection", color: "bg-rose-500" },
                  { label: "Risk Classifier", detail: "Hybrid: static regex rules + AI escalation", color: "bg-red-400" },
                  { label: "Token Vault", detail: "Auth0 M2M — ephemeral, minimum-scope tokens", color: "bg-rose-700" },
                  { label: "HITL Approval", detail: "Telegram bot — real-time approve / block cards", color: "bg-red-500" },
                  { label: "Audit Logger", detail: "Immutable structured JSON — append-only", color: "bg-pink-600" },
                ].map((row) => (
                  <div key={row.label} className="flex items-center gap-4 rounded-2xl border border-white/5 bg-white/[0.03] px-5 py-4">
                    <div className={`h-2.5 w-2.5 rounded-full ${row.color} shrink-0`} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-white">{row.label}</p>
                      <p className="text-xs text-gray-500">{row.detail}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Architecture diagram */}
            <GlassPanel noPad className="overflow-hidden min-h-[420px] flex items-center justify-center">
              <div className="w-full p-6 font-mono text-xs leading-relaxed">
                {/* Inline SVG architecture diagram */}
                <svg viewBox="0 0 380 420" className="w-full h-full" style={{ maxHeight: "420px" }}>
                  {/* Background */}
                  <defs>
                    <linearGradient id="gEmerald" x1="0%" y1="0%" x2="100%" y2="0%">
                      <stop offset="0%" stopColor="#10b981" stopOpacity="0.8" />
                      <stop offset="100%" stopColor="#34d399" stopOpacity="0.8" />
                    </linearGradient>
                    <linearGradient id="gBlue" x1="0%" y1="0%" x2="100%" y2="0%">
                      <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.8" />
                      <stop offset="100%" stopColor="#60a5fa" stopOpacity="0.8" />
                    </linearGradient>
                    <linearGradient id="gAmber" x1="0%" y1="0%" x2="100%" y2="0%">
                      <stop offset="0%" stopColor="#f59e0b" stopOpacity="0.8" />
                      <stop offset="100%" stopColor="#fbbf24" stopOpacity="0.8" />
                    </linearGradient>
                    <linearGradient id="gIndigo" x1="0%" y1="0%" x2="100%" y2="0%">
                      <stop offset="0%" stopColor="#6366f1" stopOpacity="0.8" />
                      <stop offset="100%" stopColor="#818cf8" stopOpacity="0.8" />
                    </linearGradient>
                    <filter id="glow">
                      <feGaussianBlur stdDeviation="2" result="blur" />
                      <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
                    </filter>
                  </defs>

                  {/* AI Agent box */}
                  <rect x="130" y="10" width="120" height="40" rx="8" fill="rgba(255,255,255,0.05)" stroke="rgba(255,255,255,0.15)" strokeWidth="1"/>
                  <text x="190" y="34" textAnchor="middle" fill="#d1d5db" fontSize="11" fontFamily="monospace">🤖  AI Agent</text>

                  {/* Arrow down */}
                  <line x1="190" y1="50" x2="190" y2="78" stroke="rgba(255,255,255,0.2)" strokeWidth="1" strokeDasharray="3,2"/>
                  <polygon points="186,76 190,84 194,76" fill="rgba(255,255,255,0.2)"/>

                  {/* Agent-Lock Gateway */}
                  <rect x="80" y="84" width="220" height="44" rx="10" fill="url(#gBlue)" fillOpacity="0.15" stroke="#3b82f6" strokeWidth="1.5" filter="url(#glow)"/>
                  <text x="190" y="106" textAnchor="middle" fill="#60a5fa" fontSize="12" fontWeight="bold" fontFamily="monospace">Agent-Lock Gateway</text>
                  <text x="190" y="120" textAnchor="middle" fill="#60a5fa" fontSize="9" fontFamily="monospace">/intercept  →  Plugin</text>

                  {/* Arrow down to Risk Engine */}
                  <line x1="190" y1="128" x2="190" y2="156" stroke="rgba(255,255,255,0.2)" strokeWidth="1" strokeDasharray="3,2"/>
                  <polygon points="186,154 190,162 194,154" fill="rgba(255,255,255,0.2)"/>

                  {/* Risk Engine */}
                  <rect x="90" y="162" width="200" height="44" rx="10" fill="rgba(139,92,246,0.15)" stroke="#8b5cf6" strokeWidth="1.5" filter="url(#glow)"/>
                  <text x="190" y="184" textAnchor="middle" fill="#a78bfa" fontSize="12" fontWeight="bold" fontFamily="monospace">Risk Engine</text>
                  <text x="190" y="198" textAnchor="middle" fill="#a78bfa" fontSize="9" fontFamily="monospace">Intent Validator + Classifier</text>

                  {/* Branch lines */}
                  <line x1="190" y1="206" x2="190" y2="226" stroke="rgba(255,255,255,0.2)" strokeWidth="1"/>
                  <line x1="80" y1="226" x2="300" y2="226" stroke="rgba(255,255,255,0.2)" strokeWidth="1"/>
                  <line x1="80" y1="226" x2="80" y2="254" stroke="rgba(255,255,255,0.2)" strokeWidth="1"/>
                  <polygon points="76,252 80,260 84,252" fill="rgba(255,255,255,0.2)"/>
                  <line x1="300" y1="226" x2="300" y2="254" stroke="rgba(255,255,255,0.2)" strokeWidth="1"/>
                  <polygon points="296,252 300,260 304,252" fill="rgba(255,255,255,0.2)"/>

                  {/* LOW box */}
                  <rect x="20" y="260" width="120" height="44" rx="10" fill="url(#gEmerald)" fillOpacity="0.15" stroke="#10b981" strokeWidth="1.5"/>
                  <text x="80" y="282" textAnchor="middle" fill="#34d399" fontSize="11" fontWeight="bold" fontFamily="monospace">AUTO EXECUTE</text>
                  <text x="80" y="296" textAnchor="middle" fill="#34d399" fontSize="9" fontFamily="monospace">LOW risk · Token minted</text>

                  {/* HIGH box */}
                  <rect x="240" y="260" width="120" height="44" rx="10" fill="url(#gAmber)" fillOpacity="0.15" stroke="#f59e0b" strokeWidth="1.5"/>
                  <text x="300" y="282" textAnchor="middle" fill="#fbbf24" fontSize="11" fontWeight="bold" fontFamily="monospace">PAUSE → APPROVE</text>
                  <text x="300" y="296" textAnchor="middle" fill="#fbbf24" fontSize="9" fontFamily="monospace">HIGH/CRIT · Telegram card</text>

                  {/* Merge lines to audit */}
                  <line x1="80" y1="304" x2="80" y2="330" stroke="rgba(255,255,255,0.15)" strokeWidth="1"/>
                  <line x1="300" y1="304" x2="300" y2="330" stroke="rgba(255,255,255,0.15)" strokeWidth="1"/>
                  <line x1="80" y1="330" x2="300" y2="330" stroke="rgba(255,255,255,0.15)" strokeWidth="1"/>
                  <line x1="190" y1="330" x2="190" y2="356" stroke="rgba(255,255,255,0.15)" strokeWidth="1"/>
                  <polygon points="186,354 190,362 194,354" fill="rgba(255,255,255,0.15)"/>

                  {/* Audit log */}
                  <rect x="90" y="362" width="200" height="44" rx="10" fill="url(#gIndigo)" fillOpacity="0.15" stroke="#6366f1" strokeWidth="1.5"/>
                  <text x="190" y="384" textAnchor="middle" fill="#818cf8" fontSize="12" fontWeight="bold" fontFamily="monospace">Immutable Audit Log</text>
                  <text x="190" y="398" textAnchor="middle" fill="#818cf8" fontSize="9" fontFamily="monospace">Structured JSON · append-only</text>
                </svg>
              </div>
            </GlassPanel>
          </div>
        </section>

        {/* ── Before / After comparison ──────────────────────────────────── */}
        <section className="mb-32">
          <div className="text-center mb-16">
            <SectionLabel>Before vs After</SectionLabel>
            <SectionHeading>What changes when agents operate under governance.</SectionHeading>
          </div>

          <div className="overflow-hidden rounded-3xl border border-white/10">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/10">
                  <th className="px-6 py-4 text-left text-xs uppercase tracking-widest text-gray-500 font-semibold bg-white/[0.02] w-[35%]">Scenario</th>
                  <th className="px-6 py-4 text-left text-xs uppercase tracking-widest text-red-400/80 font-semibold bg-red-500/[0.04] w-[32.5%]">Without Agent-Lock</th>
                  <th className="px-6 py-4 text-left text-xs uppercase tracking-widest text-emerald-400/80 font-semibold bg-emerald-500/[0.04] w-[32.5%]">With Agent-Lock</th>
                </tr>
              </thead>
              <tbody>
                {[
                  ["Agent tries to delete files", "Executes immediately with long-lived creds", "Flagged CRITICAL → paused → Telegram alert"],
                  ["Credential management", "Hardcoded API keys passed to agent", "Ephemeral scoped token minted per-call"],
                  ["Safe read operations", "Proceeds, but no visibility", "Classified LOW → proceeds automatically"],
                  ["Agent goes off-script", "No detection, no record", "Intent mismatch caught → escalated"],
                  ["Audit requirements", "Log may or may not exist", "Every action logged in immutable JSON"],
                  ["Custom policies", "Hand-written in agent system prompt", "Declarative policies.json + dashboard UI"],
                ].map(([scenario, before, after], i) => (
                  <tr key={i} className="border-b border-white/5 last:border-0">
                    <td className="px-6 py-4 text-gray-300 font-medium bg-white/[0.01]">{scenario}</td>
                    <td className="px-6 py-4 text-gray-500 bg-red-500/[0.02]">{before}</td>
                    <td className="px-6 py-4 text-emerald-400/90 bg-emerald-500/[0.02]">{after}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* ── Dashboard routes ───────────────────────────────────────────── */}
        <section className="mb-32">
          <div className="text-center mb-16">
            <SectionLabel>Dashboard</SectionLabel>
            <SectionHeading>One control plane for everything.</SectionHeading>
            <p className="mt-4 text-gray-400 max-w-xl mx-auto text-base">
              Every module is built for the operator — not the developer. Clear data, decisive actions, no clutter.
            </p>
          </div>

          <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
            {surfaces.map((surface, index) => (
              <Link href={surface.href} key={index} className="block group">
                <GlassPanel noPad className="h-full flex flex-col transition-all duration-300 hover:border-white/20 hover:bg-white/[0.07] hover:-translate-y-1">
                  <div className="absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r from-rose-700 via-red-500 to-rose-400 opacity-0 group-hover:opacity-100 transition-opacity rounded-t-3xl" />
                  <div className="p-6 md:p-8 flex-1 flex flex-col">
                    <div className="flex justify-between items-start mb-6">
                      <span className="inline-block px-3 py-1 bg-white/5 border border-white/10 rounded-full text-[10px] font-bold uppercase tracking-wider text-gray-400">
                        {surface.badge}
                      </span>
                      <span className="text-sm font-mono text-gray-700 font-semibold">{surface.n}</span>
                    </div>
                    <h3 className="text-xl font-semibold text-white mb-3 group-hover:text-emerald-300 transition-colors">
                      {surface.title}
                    </h3>
                    <p className="text-sm text-gray-400 leading-relaxed mb-6 flex-1">{surface.desc}</p>
                    <div className="flex items-center text-xs font-medium text-gray-600 group-hover:text-white transition-colors">
                      Open module &rarr;
                    </div>
                  </div>
                </GlassPanel>
              </Link>
            ))}
          </div>
        </section>

        {/* ── FAQ ────────────────────────────────────────────────────────── */}
        <section id="faq" className="mb-32 scroll-mt-24">
          <div className="text-center mb-16">
            <SectionLabel>FAQ</SectionLabel>
            <SectionHeading>Frequently asked questions.</SectionHeading>
          </div>

          <div className="max-w-3xl mx-auto space-y-4">
            {faqs.map((faq, i) => (
              <GlassPanel key={i}>
                <p className="text-base font-semibold text-white mb-3">{faq.q}</p>
                <p className="text-sm text-gray-400 leading-relaxed">{faq.a}</p>
              </GlassPanel>
            ))}
          </div>
        </section>

        {/* ── CTA ────────────────────────────────────────────────────────── */}
        <section className="mb-16">
          <GlassPanel className="text-center py-20">
            <div className="absolute inset-0 rounded-3xl bg-gradient-to-br from-rose-700/10 via-transparent to-red-600/10 pointer-events-none" />
            <SectionLabel>Get started</SectionLabel>
            <h2 className="text-4xl md:text-5xl font-extrabold text-white mb-6 tracking-tight">
              Secure your agents.<br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-rose-400 to-red-300">Ship with confidence.</span>
            </h2>
            <p className="text-gray-400 mb-10 max-w-xl mx-auto text-base leading-relaxed">
              Open source, self-hosted, no vendor lock-in. Your agents, your infrastructure, your audit logs.
            </p>
            <div className="flex flex-wrap justify-center gap-4">
              <Link
                href="/dashboard/overview"
                className="rounded-xl bg-gradient-to-r from-rose-700 to-red-500 px-8 py-4 text-sm font-semibold text-white shadow-[0_0_40px_-12px_rgba(225,29,72,0.5)] transition-all hover:scale-105"
              >
                Open Dashboard
              </Link>
              <Link
                href="/dashboard/logs"
                className="rounded-xl border border-white/10 bg-white/5 px-8 py-4 text-sm font-semibold text-white hover:bg-white/10 transition-all"
              >
                View Audit Logs
              </Link>
            </div>
          </GlassPanel>
        </section>

        {/* ── Footer ─────────────────────────────────────────────────────── */}
        <footer className="border-t border-white/10 pt-16 pb-12">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-12">
            <div className="col-span-2 md:col-span-1">
              <div className="flex items-center gap-2 mb-4">
                <Image src="/logo.jpeg" alt="Agent-Lock" width={32} height={32} className="rounded-lg object-cover" />
                <span className="text-sm font-semibold text-white">Agent-Lock</span>
              </div>
              <p className="text-xs text-gray-500 leading-relaxed max-w-[200px]">
                The governance and security layer for AI agent tool calls.
              </p>
            </div>

            {[
              {
                head: "Platform",
                links: [
                  { label: "Overview", href: "/dashboard/overview" },
                  { label: "Approvals", href: "/dashboard/approvals" },
                  { label: "Settings", href: "/dashboard/settings" },
                  { label: "Audit Logs", href: "/dashboard/logs" },
                ],
              },
              {
                head: "Gateway",
                links: [
                  { label: "MCP Status", href: "/dashboard/mcp" },
                  { label: "Plugin Bridge", href: "/dashboard/plugin" },
                ],
              },
              {
                head: "Resources",
                links: [
                  { label: "Architecture", href: "#architecture" },
                  { label: "How it works", href: "#how-it-works" },
                  { label: "FAQ", href: "#faq" },
                ],
              },
            ].map((col) => (
              <div key={col.head}>
                <p className="text-xs font-bold uppercase tracking-widest text-gray-500 mb-4">{col.head}</p>
                <ul className="space-y-2.5">
                  {col.links.map((l) => (
                    <li key={l.label}>
                      <Link href={l.href} className="text-sm text-gray-400 hover:text-white transition-colors">
                        {l.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          <div className="border-t border-white/5 pt-8 flex flex-col sm:flex-row items-center justify-between gap-4">
            <p className="text-xs text-gray-600">
              Agent-Lock &copy; {new Date().getFullYear()} | Open source security middleware for AI agents.
            </p>
            <div className="flex items-center gap-1.5 rounded-full border border-rose-500/20 bg-rose-500/10 px-3 py-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-rose-500 animate-pulse" />
              <span className="text-[11px] font-semibold text-rose-400">System Operational</span>
            </div>
          </div>
        </footer>

      </div>
    </main>
  )
}
