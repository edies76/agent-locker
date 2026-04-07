import Link from "next/link"
import Image from "next/image"
const dashboardRoutes = [
  { href: "/dashboard/overview", title: "Overview", desc: "Health, decisions, risk distribution, and approval queue." },
  { href: "/dashboard/activity", title: "Activity", desc: "Action timeline with decisions, actors, and audit metadata." },
  { href: "/dashboard/approvals", title: "Approvals", desc: "Review and resolve sensitive actions in real time." },
  { href: "/dashboard/mcp", title: "MCP Monitor", desc: "Gateway/server connectivity, timings, and diagnostics." },
  { href: "/dashboard/settings", title: "Settings", desc: "Global and user-scoped controls, Auth, and integrations." },
  { href: "/dashboard/logs", title: "Logs", desc: "Structured audit stream for governance and compliance checks." },
]

const knowledgeRoutes = [
  { href: "/learn/problem", title: "Problem", desc: "Why agent execution needs fail-closed governance." },
  { href: "/learn/architecture", title: "Architecture", desc: "Gateway, backend policy engine, and audited execution path." },
  { href: "/learn/setup", title: "Setup", desc: "Install order, prerequisites, and first successful run." },
  { href: "/learn/operations", title: "Operations", desc: "Runtime checks, identity scoping, and production controls." },
  { href: "/learn/troubleshooting", title: "Troubleshooting", desc: "Known failures and what to check first." },
]

export default function LandingPage() {
  return (
    <main className="min-h-screen bg-[var(--bg-secondary)] text-[var(--text-primary)]">
      <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:px-8">
        <header className="card mb-8 flex flex-wrap items-center justify-between gap-4 p-4 sm:p-5">
          <div className="flex items-center gap-3">
            <Image src="/logo.jpeg" alt="Agent-Lock logo" width={40} height={40} className="h-10 w-10 rounded-md border border-[var(--border-primary)] object-cover" />
            <div>
              <p className="text-xs uppercase tracking-[0.18em] text-[var(--text-tertiary)]">Agent security middleware</p>
              <h1 className="text-lg font-semibold">Agent-Lock AI</h1>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href="/learn" className="btn btn-secondary">Knowledge Hub</Link>
            <Link href="/dashboard/overview" className="btn btn-primary">Open Dashboard</Link>
          </div>
        </header>

        <section className="card mb-8 p-5 sm:p-6">
          <p className="mb-2 text-xs uppercase tracking-[0.18em] text-[var(--text-tertiary)]">What Agent-Lock does</p>
          <h2 className="mb-3 text-3xl font-semibold">Control AI tool execution with human-backed policy.</h2>
          <p className="max-w-3xl text-[var(--text-secondary)]">
            Agent-Lock sits between agents and tools, classifies risk, enforces approvals for high-impact operations, and keeps a complete audit trail across MCP and plugin execution paths.
          </p>
        </section>

        <section className="mb-8 grid gap-4 md:grid-cols-3">
          <article className="card p-4">
            <p className="mb-2 text-xs uppercase tracking-[0.16em] text-[var(--text-tertiary)]">Automatic lane</p>
            <p className="text-sm text-[var(--text-secondary)]">Low-risk scoped actions run automatically when policy allows them.</p>
          </article>
          <article className="card p-4">
            <p className="mb-2 text-xs uppercase tracking-[0.16em] text-[var(--text-tertiary)]">Approval lane</p>
            <p className="text-sm text-[var(--text-secondary)]">High and critical actions pause until an explicit human decision is received.</p>
          </article>
          <article className="card p-4">
            <p className="mb-2 text-xs uppercase tracking-[0.16em] text-[var(--text-tertiary)]">Audit lane</p>
            <p className="text-sm text-[var(--text-secondary)]">Every request, decision, and outcome is captured for traceability.</p>
          </article>
        </section>

        <section className="mb-8">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-xl font-semibold">Dashboard surfaces</h3>
            <Link href="/dashboard/overview" className="text-sm font-medium text-[var(--accent-primary)] hover:underline">Go to operations view</Link>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            {dashboardRoutes.map((route) => (
              <Link key={route.href} href={route.href} className="card card-interactive block p-4">
                <p className="mb-1 font-medium">{route.title}</p>
                <p className="text-sm text-[var(--text-secondary)]">{route.desc}</p>
              </Link>
            ))}
          </div>
        </section>

        <section className="mb-8">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-xl font-semibold">Knowledge routes</h3>
            <Link href="/learn" className="text-sm font-medium text-[var(--accent-primary)] hover:underline">Read full guide</Link>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            {knowledgeRoutes.map((route) => (
              <Link key={route.href} href={route.href} className="card card-interactive block p-4">
                <p className="mb-1 font-medium">{route.title}</p>
                <p className="text-sm text-[var(--text-secondary)]">{route.desc}</p>
              </Link>
            ))}
          </div>
        </section>
      </div>
    </main>
  )
}
