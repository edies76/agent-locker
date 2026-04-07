import Link from "next/link"
import Image from "next/image"

const dashboardRoutes = [
  { href: "/dashboard/overview", title: "Overview", desc: "System health, risk distribution, and approvals at a glance." },
  { href: "/dashboard/activity", title: "Activity", desc: "Execution timeline with decision metadata and outcomes." },
  { href: "/dashboard/approvals", title: "Approvals", desc: "Review and decide sensitive actions before execution." },
  { href: "/dashboard/mcp", title: "MCP", desc: "Gateway connectivity, server states, and diagnostics." },
  { href: "/dashboard/settings", title: "Settings", desc: "Identity scope, integrations, and policy behavior." },
  { href: "/dashboard/logs", title: "Logs", desc: "Audit trail for compliance and incident analysis." },
]

const knowledgeRoutes = [
  { href: "/learn", title: "Knowledge Center", desc: "Central explanation of Agent-Lock and operational model." },
  { href: "/learn/problem", title: "Problem", desc: "Why uncontrolled agent execution is dangerous." },
  { href: "/learn/architecture", title: "Architecture", desc: "Gateway, backend policy engine, and data boundaries." },
  { href: "/learn/setup", title: "Setup", desc: "Install order and first-run validation sequence." },
  { href: "/learn/operations", title: "Operations", desc: "Global vs user-scoped responsibilities." },
  { href: "/learn/troubleshooting", title: "Troubleshooting", desc: "Fast checks for the most common issues." },
]

export default function LandingPage() {
  return (
    <main className="relative min-h-screen overflow-hidden pb-20">
      <div className="fixed inset-0 z-[-2] bg-[#050814]" />
      <div className="fixed inset-0 z-[-1] pointer-events-none">
        <div className="absolute -left-24 top-[-120px] h-[420px] w-[420px] rounded-full bg-blue-500/20 blur-[120px]" />
        <div className="absolute -right-16 top-[120px] h-[380px] w-[380px] rounded-full bg-emerald-500/15 blur-[120px]" />
      </div>

      <div className="relative mx-auto max-w-7xl px-4 pt-6 sm:px-6 lg:px-8">
        <header className="mb-10 flex items-center justify-between rounded-full border border-white/10 bg-white/5 px-4 py-3 backdrop-blur-md">
          <div className="flex items-center gap-3">
            <Image src="/logo.jpeg" alt="Agent-Lock logo" width={40} height={40} className="h-10 w-10 rounded-md border border-white/20 object-cover" />
            <div>
              <p className="text-[10px] uppercase tracking-[0.2em] text-emerald-300/90">Security Middleware</p>
              <p className="text-sm font-semibold text-white">Agent-Lock AI</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="rounded-full border border-emerald-400/30 bg-emerald-500/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-emerald-300">Live</span>
            <Link href="/dashboard/overview" className="rounded-full bg-white px-4 py-2 text-sm font-semibold text-gray-900 hover:bg-gray-100">Open Dashboard</Link>
          </div>
        </header>

        <section className="mb-12 text-center">
          <p className="mb-5 inline-flex items-center rounded-full border border-white/10 bg-white/5 px-4 py-1.5 text-xs font-medium text-gray-300">
            Zero-trust control plane for AI tool execution
          </p>
          <h1 className="mx-auto mb-5 max-w-4xl text-5xl font-extrabold leading-tight text-white sm:text-6xl">
            Put your <span className="bg-gradient-to-r from-blue-300 via-emerald-300 to-indigo-300 bg-clip-text text-transparent">Dashboard first</span> and keep every agent action governed.
          </h1>
          <p className="mx-auto mb-8 max-w-3xl text-lg text-gray-300">
            Agent-Lock intercepts tool calls, classifies risk, pauses high-impact operations for approval, and records every decision with full traceability.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3">
            <Link href="/dashboard/overview" className="rounded-full bg-gradient-to-r from-blue-600 to-emerald-500 px-7 py-3 text-sm font-semibold text-white shadow-[0_0_30px_-12px_rgba(16,185,129,0.7)]">Enter Dashboard</Link>
            <Link href="/dashboard/approvals" className="rounded-full border border-white/20 bg-white/10 px-7 py-3 text-sm font-semibold text-white hover:bg-white/15">Open Approvals</Link>
            <Link href="/learn" className="rounded-full border border-white/20 bg-transparent px-7 py-3 text-sm font-semibold text-gray-200 hover:bg-white/10">Read Knowledge Hub</Link>
          </div>
        </section>

        <section className="mb-12 rounded-3xl border border-white/10 bg-black/35 p-6 backdrop-blur-xl">
          <div className="mb-6 flex items-center justify-between">
            <h2 className="text-2xl font-semibold text-white">Dashboard modules</h2>
            <span className="text-xs uppercase tracking-[0.2em] text-gray-400">Primary navigation</span>
          </div>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {dashboardRoutes.map((route, index) => (
              <Link key={route.href} href={route.href} className="group rounded-2xl border border-white/10 bg-white/5 p-4 transition-all hover:-translate-y-0.5 hover:border-white/25 hover:bg-white/10">
                <div className="mb-2 flex items-center justify-between">
                  <p className="font-semibold text-white">{route.title}</p>
                  <span className="text-xs font-mono text-gray-500">0{index + 1}</span>
                </div>
                <p className="text-sm text-gray-300">{route.desc}</p>
              </Link>
            ))}
          </div>
        </section>

        <section className="rounded-3xl border border-white/10 bg-black/35 p-6 backdrop-blur-xl">
          <div className="mb-6 flex items-center justify-between">
            <h2 className="text-2xl font-semibold text-white">Knowledge routes</h2>
            <span className="text-xs uppercase tracking-[0.2em] text-gray-400">Linked documentation pages</span>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            {knowledgeRoutes.map((route) => (
              <Link key={route.href} href={route.href} className="rounded-2xl border border-white/10 bg-white/5 p-4 transition-all hover:border-white/25 hover:bg-white/10">
                <p className="mb-1 font-semibold text-white">{route.title}</p>
                <p className="text-sm text-gray-300">{route.desc}</p>
              </Link>
            ))}
          </div>
        </section>
      </div>
    </main>
  )
}
