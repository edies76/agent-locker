"use client"

import Link from "next/link"
import type { ReactNode } from "react"
import { Badge } from "./components/ui"

const surfaces = [
  {
    href: "/dashboard/overview",
    title: "Overview",
    desc: "System health, activity, risk distribution, and approval workflows in one place.",
    badge: "Operations",
    icon: "grid",
  },
  {
    href: "/dashboard/approvals",
    title: "Approvals",
    desc: "Review pending actions, inspect arguments, and approve or reject with context.",
    badge: "Human review",
    icon: "shield-check",
  },
  {
    href: "/dashboard/settings",
    title: "Settings",
    desc: "Define what stays automatic, what pauses for approval, and which scopes are active.",
    badge: "Policy",
    icon: "cog",
  },
  {
    href: "/dashboard/mcp",
    title: "MCP",
    desc: "Check connected servers, timings, and diagnostics before shipping changes.",
    badge: "Gateway",
    icon: "server",
  },
  {
    href: "/dashboard/plugin",
    title: "Plugin",
    desc: "Manage pairing, chat, and bridge state for governed execution.",
    badge: "Bridge",
    icon: "puzzle",
  },
  {
    href: "/dashboard/logs",
    title: "Logs",
    desc: "Filter audit events and trace exactly how each action was handled.",
    badge: "Audit",
    icon: "clipboard-list",
  },
]

const controlPoints = [
  {
    title: "Automatic lane",
    text: "Safe, scoped actions move through cleanly without intervention when policy allows it.",
  },
  {
    title: "Approval lane",
    text: "Sensitive operations pause, awaiting human confirmation of intent and arguments.",
  },
  {
    title: "Audit trail",
    text: "Every execution is immutably recorded for complete observability and policy tuning.",
  },
]

// Pure glassmorphic panel with beautiful borders and lighting
function GlassPanel({ children, className = "", noPad = false }: { children: ReactNode; className?: string; noPad?: boolean }) {
  return (
    <div className={`relative overflow-hidden rounded-3xl border border-white/10 bg-white/5 backdrop-blur-xl shadow-2xl ${noPad ? "" : "p-6 md:p-8"} ${className}`}>
      {/* Top subtle highlight */}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent" />
      {children}
    </div>
  )
}

function GridOverlay() {
  return (
    <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI0MCIgaGVpZ2h0PSI0MCI+PHBhdGggZD0iTTAgMGg0MHY0MEgwem0zOSAzOVYxaC0zOHYzOGgzOHoiIGZpbGw9Im5vbmUiIHN0cm9rZT0icmdiYSgyNTUsMjU1LDI1NSwwLjAyKSIvPjwvc3ZnPg==')] [mask-image:radial-gradient(ellipse_at_center,black_40%,transparent_80%)] mix-blend-overlay pointer-events-none" />
  )
}

export default function LandingPage() {
  return (
    <main className="relative min-h-screen selection:bg-[var(--accent-primary)] selection:text-white pb-20">
      {/* Immersive Dark Background */}
      <div className="fixed inset-0 z-[-2] bg-[#030712]" />
      
      {/* Ambient Orbs */}
      <div className="fixed inset-0 z-[-1] overflow-hidden pointer-events-none opacity-60">
        <div className="absolute left-[10%] top-[-10%] h-[500px] w-[500px] rounded-full bg-emerald-500/20 blur-[120px]" />
        <div className="absolute right-[5%] top-[20%] h-[400px] w-[400px] rounded-full bg-blue-500/15 blur-[100px]" />
        <div className="absolute left-[30%] bottom-[-20%] h-[600px] w-[600px] rounded-full bg-indigo-500/10 blur-[120px]" />
      </div>

      <GridOverlay />

      <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 pt-6">
        
        {/* Navigation Bar */}
        <nav className="flex items-center justify-between rounded-full border border-white/10 bg-white/5 px-5 py-3 backdrop-blur-md">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-tr from-blue-600 to-emerald-400 text-white font-bold shadow-lg shadow-blue-500/20">
              AL
            </div>
            <div className="hidden sm:block">
              <p className="text-[10px] uppercase tracking-widest text-emerald-400/90 font-semibold">Security Middleware</p>
              <p className="text-sm font-semibold tracking-wide text-white">Agent-Lock</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <Badge variant="success" className="bg-emerald-500/10 text-emerald-400 border-emerald-500/20">Live</Badge>
            <Link href="/dashboard/overview" className="rounded-full bg-white text-gray-900 px-5 py-2 text-sm font-medium hover:bg-gray-100 transition-colors shadow-lg">
              Open Dashboard
            </Link>
          </div>
        </nav>

        {/* Hero Section */}
        <section className="relative pt-24 pb-20 text-center flex flex-col items-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-1.5 backdrop-blur-sm mb-8 animate-fade-in translate-y-0">
            <span className="flex h-2 w-2 rounded-full bg-emerald-500 animate-pulse"></span>
            <span className="text-xs font-medium text-gray-300">Zero-Trust Agent Security</span>
          </div>
          
          <h1 className="max-w-4xl text-5xl sm:text-6xl md:text-7xl font-extrabold tracking-tight text-white mb-8 leading-[1.1]">
            Govern AI actions with <br className="hidden md:block"/>
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 via-blue-400 to-indigo-400">real controls.</span>
          </h1>
          
          <p className="max-w-2xl text-lg md:text-xl text-gray-400 leading-relaxed mb-10">
            Agent-Lock sits between AI agents and tools, classifies risk, enforces approvals, and gives operators one clean control plane for policy, gateway health, and execution history.
          </p>
          
          <div className="flex flex-wrap items-center justify-center gap-4">
            <Link href="/dashboard/overview" className="rounded-full bg-gradient-to-r from-blue-600 to-emerald-500 px-8 py-4 text-sm font-semibold text-white shadow-[0_0_40px_-10px_rgba(16,185,129,0.5)] transition-all hover:scale-105 hover:shadow-[0_0_60px_-15px_rgba(16,185,129,0.6)]">
              Enter Dashboard
            </Link>
            <Link href="/dashboard/settings" className="rounded-full border border-white/10 bg-white/5 px-8 py-4 text-sm font-semibold text-white backdrop-blur-md transition-all hover:bg-white/10">
              Review Policies
            </Link>
          </div>
        </section>

        {/* Bento Box Architecture */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-24">
          
          {/* Main "Built for Operators" Card spans 2 columns */}
          <GlassPanel className="md:col-span-2 group min-h-[320px] flex flex-col justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-emerald-400 mb-2">Control Snapshot</p>
              <h2 className="text-3xl font-semibold text-white mb-4">Built for operators</h2>
              <p className="text-gray-400 text-sm leading-relaxed max-w-md">
                Fast, scoped actions move freely through the fast lane. Sensitive tasks automatically pause in the review lane until a human grants explicit confirmation.
              </p>
            </div>
            
            <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 gap-4">
               <div className="rounded-2xl border border-white/5 bg-black/40 p-4">
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <span className="text-xs font-semibold uppercase tracking-widest text-emerald-400">Fast Lane</span>
                    <div className="h-2 w-2 rounded-full bg-emerald-500" />
                  </div>
                  <p className="text-sm text-gray-300">Automatic Tools: Safe actions execute instantly.</p>
               </div>
               <div className="rounded-2xl border border-white/5 bg-black/40 p-4">
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <span className="text-xs font-semibold uppercase tracking-widest text-amber-400">Review Lane</span>
                    <div className="h-2 w-2 rounded-full bg-amber-500" />
                  </div>
                  <p className="text-sm text-gray-300">Approvals Required: sensitive ops pause for you.</p>
               </div>
            </div>
          </GlassPanel>

          {/* Architecture Chart Card spans 1 column */}
          <GlassPanel className="md:col-span-1 min-h-[320px] flex flex-col">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-blue-400 mb-2">Architecture</p>
            <h3 className="text-xl font-semibold text-white mb-4">End-to-End Flow</h3>
            
            <div className="mt-auto flex-1 rounded-2xl border border-white/5 bg-black/40 p-4 flex flex-col items-center justify-center relative overflow-hidden font-mono text-[10px] text-emerald-300/80 w-full">
               <div className="absolute inset-0 bg-gradient-to-b from-transparent via-blue-500/5 to-transparent pointer-events-none" />
               <pre className="text-left w-full overflow-hidden leading-relaxed">
{`AI   -> [ Gateway ]
          |
  [ Risk Engine ]
    /          \\
[Auto]       [Pause]
   |            |
   |         (Approve)
    \\          /
  [ Audited Exec ]`}
               </pre>
            </div>
          </GlassPanel>

          {/* Control Points row */}
          {controlPoints.map((point, i) => (
             <GlassPanel key={i} className="md:col-span-1 group">
               <div className="flex items-center gap-3 mb-4">
                 <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/5 border border-white/10 text-blue-400 group-hover:text-emerald-400 transition-colors">
                   {i === 0 ? "⚡" : i === 1 ? "🛡️" : "📋"}
                 </div>
                 <h3 className="text-lg font-medium text-white">{point.title}</h3>
               </div>
               <p className="text-sm text-gray-400 leading-relaxed">{point.text}</p>
             </GlassPanel>
          ))}
        </div>

        {/* Dashboard Routes Grid */}
        <section className="mb-24">
          <div className="text-center mb-12">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-indigo-400 mb-2">Navigate</p>
            <h2 className="text-3xl font-semibold text-white">Direct routes into the platform</h2>
          </div>
          
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {surfaces.map((surface, index) => (
              <Link href={surface.href} key={index} className="block group">
                <GlassPanel noPad className="h-full flex flex-col transition-all duration-300 hover:border-white/20 hover:bg-white/[0.08] hover:-translate-y-1">
                  {/* Glowing line on hover */}
                  <div className="absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r from-blue-500 via-indigo-400 to-emerald-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                  
                  <div className="p-6 md:p-8 flex-1 flex flex-col">
                    <div className="flex justify-between items-start mb-6">
                      <span className="inline-block px-3 py-1 bg-white/5 border border-white/10 rounded-full text-[10px] font-bold uppercase tracking-wider text-gray-300">
                        {surface.badge}
                      </span>
                      <span className="text-sm font-mono text-gray-600 font-medium">
                        0{index + 1}
                      </span>
                    </div>

                    <h3 className="text-xl font-semibold text-white mb-3 group-hover:text-emerald-300 transition-colors">
                      {surface.title}
                    </h3>
                    
                    <p className="text-sm text-gray-400 leading-relaxed mb-6 flex-1">
                      {surface.desc}
                    </p>

                    <div className="flex items-center text-xs font-medium text-gray-500 group-hover:text-white transition-colors">
                      Open module &rarr;
                    </div>
                  </div>
                </GlassPanel>
              </Link>
            ))}
          </div>
        </section>

        {/* Footer/Bottom CTA */}
        <section className="text-center pb-12 border-t border-white/10 pt-16">
          <h2 className="text-2xl font-semibold text-white mb-6">Ready to secure your agents?</h2>
          <div className="flex justify-center gap-4">
             <Link href="/dashboard/overview" className="rounded-full bg-white px-6 py-3 text-sm font-semibold text-gray-900 transition hover:scale-105">
                Go to Dashboard
             </Link>
             <Link href="/dashboard/logs" className="rounded-full bg-white/10 px-6 py-3 text-sm font-semibold text-white hover:bg-white/20 transition">
                View Audit Logs
             </Link>
          </div>
          <p className="mt-12 text-xs text-gray-500">
            Agent-Lock &copy; {new Date().getFullYear()} – The governance and approval gateway for AI tools.
          </p>
        </section>

      </div>
    </main>
  )
}
