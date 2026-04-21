"use client"

import Link from "next/link"
import Image from "next/image"
import type { ReactNode } from "react"
import { useEffect, useRef, useCallback } from "react"
import InstallWidget from "../components/InstallWidget"

// ─── Interactive Particle Canvas (Reused) ──────────────────────────────────────
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

    const COUNT = Math.min(Math.floor((W * H) / 12000), 70)
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
        p.x += p.vx
        p.y += p.vy
        p.opacity += p.opDir * 0.003
        if (p.opacity > 0.75 || p.opacity < 0.12) p.opDir *= -1

        if (p.x < 0 || p.x > W) p.vx *= -1
        if (p.y < 0 || p.y > H) p.vy *= -1

        const dx = p.x - mx
        const dy = p.y - my
        const dist = Math.sqrt(dx * dx + dy * dy)
        if (dist < MOUSE_PUSH && dist > 0) {
          const force = (MOUSE_PUSH - dist) / MOUSE_PUSH
          p.x += (dx / dist) * force * 2.2
          p.y += (dy / dist) * force * 2.2
        }

        ctx.beginPath()
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2)
        ctx.fillStyle = p.color
        ctx.globalAlpha = p.opacity
        ctx.fill()
      }

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
      style={{ opacity: 0.35 }}
    />
  )
}

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

export default function LearnPage() {
  return (
    <main className="relative min-h-screen overflow-x-hidden selection:bg-rose-500/30 selection:text-white">
      {/* Background */}
      <div className="fixed inset-0 z-[-3] bg-[#030712]" />
      <ParticleCanvas />
      <div className="fixed inset-0 z-[-1] overflow-hidden pointer-events-none">
        <div className="absolute left-[-5%] top-[-15%] h-[700px] w-[700px] rounded-full bg-rose-700/[0.08] blur-[140px]" />
        <div className="absolute right-[-5%] top-[15%] h-[600px] w-[600px] rounded-full bg-red-700/[0.06] blur-[130px]" />
      </div>

      <div className="relative mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 py-12 md:py-20">
        <Link href="/" className="inline-flex items-center gap-2 text-sm text-rose-400 hover:text-rose-300 mb-12 transition-colors">
          &larr; Back to Home
        </Link>

        <section className="mb-12">
          <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight text-white mb-6">
            Agent-Lock <span className="text-transparent bg-clip-text bg-gradient-to-r from-rose-400 to-red-300">Knowledge Hub</span>
          </h1>
          <p className="text-lg text-gray-400 max-w-2xl leading-relaxed mb-8">
            Welcome to the governance layer. Quick start your installation and learn how to secure your agents.
          </p>
          
          <InstallWidget showDocumentationLink={false} />
        </section>

        <div className="space-y-12">
          <section>
            <div className="flex items-center gap-3 mb-6">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-tr from-rose-600 to-red-400 text-white font-bold shadow-lg shadow-rose-500/30">
                1
              </div>
              <h2 className="text-3xl font-bold text-white tracking-tight">CLI Quickstart</h2>
            </div>
            
            <div className="grid gap-6">
              <GlassPanel>
                <h3 className="text-xl font-bold text-white mb-4">Initial Setup</h3>
                <p className="text-gray-400 mb-4">First, install the CLI globally and attach the plugin to your OpenClaw environment.</p>
                <div className="bg-[#0e0e11] border border-white/5 p-4 rounded-xl font-mono text-sm mb-4">
                  <div className="text-gray-500 mb-1"># Install the package globally via npm</div>
                  <div className="text-rose-400">$ <span className="text-white">npm i -g @agentlock/agent-lock</span></div>
                </div>
                <div className="bg-[#0e0e11] border border-white/5 p-4 rounded-xl font-mono text-sm mb-4">
                  <div className="text-gray-500 mb-1"># Authenticate with the Agent-Lock Identity Hub</div>
                  <div className="text-rose-400">$ <span className="text-white">agent-lock login</span></div>
                </div>
                <div className="bg-[#0e0e11] border border-white/5 p-4 rounded-xl font-mono text-sm">
                  <div className="text-gray-500 mb-1"># Install plugin in OpenClaw and auto-connect to backend</div>
                  <div className="text-rose-400">$ <span className="text-white">agent-lock install</span></div>
                </div>
              </GlassPanel>

              <GlassPanel>
                <h3 className="text-xl font-bold text-white mb-4">Managing Providers & Scopes</h3>
                <p className="text-gray-400 mb-4">Integrate providers directly or manage their active scopes via the CLI logic before OpenClaw operates them.</p>
                <div className="bg-[#0e0e11] border border-white/5 p-4 rounded-xl font-mono text-sm mb-4">
                  <div className="text-gray-500 mb-1"># Connect a provider specific Token Vault (e.g., google, github)</div>
                  <div className="text-rose-400">$ <span className="text-white">agent-lock login google</span></div>
                </div>
                <div className="bg-[#0e0e11] border border-white/5 p-4 rounded-xl font-mono text-sm mb-4">
                  <div className="text-gray-500 mb-1"># Review available vs. permitted scopes per provider</div>
                  <div className="text-rose-400">$ <span className="text-white">agent-lock scopes</span></div>
                </div>
                <div className="bg-[#0e0e11] border border-white/5 p-4 rounded-xl font-mono text-sm">
                  <div className="text-gray-500 mb-1"># Check status of the internal connection</div>
                  <div className="text-rose-400">$ <span className="text-white">agent-lock status</span></div>
                </div>
              </GlassPanel>
            </div>
          </section>

          <section>
            <div className="flex items-center gap-3 mb-6">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-tr from-rose-600 to-red-400 text-white font-bold shadow-lg shadow-rose-500/30">
                2
              </div>
              <h2 className="text-3xl font-bold text-white tracking-tight">Using the Dashboard</h2>
            </div>

            <div className="grid gap-6">
              <GlassPanel>
                <h3 className="text-xl font-bold text-white mb-4">Dashboard & Approvals</h3>
                <p className="text-gray-400 mb-4 leading-relaxed">
                  Navigate to <Link href="/dashboard/overview" className="text-rose-400 hover:text-white underline decoration-rose-900 underline-offset-4">localhost:3000/dashboard</Link> to control the proxy behavior.
                </p>
                <ul className="space-y-3 text-gray-400 list-disc ml-5 marker:text-rose-500">
                  <li><strong>Overview:</strong> High-level view of Risk classification (Low / High / Critical) determined by the semantic validator.</li>
                  <li><strong>Approvals:</strong> See a live queue of tool calls that the agent is attempting. Approve or reject calls.</li>
                  <li><strong>Logs:</strong> Read the immutable append-only JSON audit logs. Essential for tracing what went wrong.</li>
                  <li><strong>Settings:</strong> Map tools to specific policies (e.g., setting `read_file` to *Auto-Approve* and `write_file` to *Require Human*).</li>
                </ul>
              </GlassPanel>
            </div>
          </section>
          <section>
            <div className="flex items-center gap-3 mb-6">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-tr from-rose-600 to-red-400 text-white font-bold shadow-lg shadow-rose-500/30">
                3
              </div>
              <h2 className="text-3xl font-bold text-white tracking-tight">Advanced Concepts</h2>
            </div>
            <div className="grid gap-6">
              <GlassPanel>
                <div className="flex items-center gap-3 mb-4">
                  <Tag color="emerald">Feature</Tag>
                  <h2 className="text-2xl font-bold text-white">Smart Auto-Correction</h2>
                </div>
                <p className="text-gray-400 leading-relaxed mb-6">
                  Instead of just blocking an agent when it makes a mistake, Agent-Lock injects a semantic error directly into the agent's context.
                  If an agent tries to drop a table instead of optimizing it, the agent receives: <br />
                  <code className="mt-2 block bg-black/40 text-rose-300 p-3 rounded-lg text-sm border border-rose-900/50">"Action blocked: Violates data retention policy. Use the optimization tool instead."</code>
                </p>
                <p className="text-sm font-medium text-gray-500 tracking-wide uppercase">Value: Agents auto-correct without human intervention.</p>
              </GlassPanel>

              <GlassPanel>
                <div className="flex items-center gap-3 mb-4">
                  <Tag color="amber">Safety</Tag>
                  <h2 className="text-2xl font-bold text-white">DLP (Data Loss Prevention) Proxy</h2>
                </div>
                <p className="text-gray-400 leading-relaxed mb-6">
                  Agent-Lock acts as an interceptor for the OUTBOUND data going back to the agent.
                  When an agent queries a database, Agent-Lock sanitizes the response, obscuring sensitive PII like credit cards or SSNs before the agent can "read" them.
                </p>
                <p className="text-sm font-medium text-gray-500 tracking-wide uppercase">Value: Instant SOC2 compliance. Zero risk of context leaking.</p>
              </GlassPanel>

              <GlassPanel>
                <div className="flex items-center gap-3 mb-4">
                  <Tag color="blue">Control</Tag>
                  <h2 className="text-2xl font-bold text-white">Loop & Cost Killers</h2>
                </div>
                <p className="text-gray-400 leading-relaxed mb-6">
                  Agents getting stuck in loops is expensive. Agent-Lock tracks tool call patterns per session. If an agent calls the same tool with similar failed arguments 5 times in a row, the execution is terminated to save compute cycles and API costs.
                </p>
                <p className="text-sm font-medium text-gray-500 tracking-wide uppercase">Value: Hard limits on API usage and preventing infinite loops.</p>
              </GlassPanel>
              
              <GlassPanel>
                <div className="flex items-center gap-3 mb-4">
                  <Tag color="purple">Routing</Tag>
                  <h2 className="text-2xl font-bold text-white">Dynamic Multi-Agent Routing</h2>
                </div>
                <p className="text-gray-400 leading-relaxed mb-6">
                  Complex tasks are routed semantically. If an instruction involves AWS, Agent-Lock scopes the AWS temporal tokens only to a specialized agent cluster, blocking any other generalized agent from even seeing the tool availability.
                </p>
                <p className="text-sm font-medium text-gray-500 tracking-wide uppercase">Value: True microservice compartmentalization for AI agents.</p>
              </GlassPanel>
            </div>
          </section>
        </div>
        
        <div className="mt-16 text-center border-t border-white/5 pt-12">
           <Link href="/dashboard/overview" className="rounded-xl bg-gradient-to-r from-rose-700 to-red-600 px-8 py-3 text-sm font-semibold text-white shadow-lg shadow-rose-900/30 hover:shadow-rose-900/50 transition-all">
             Go to Dashboard
           </Link>
        </div>
      </div>
    </main>
  )
}
