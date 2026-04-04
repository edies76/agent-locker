import Link from "next/link"
import Card from "../components/ui/Card"

const entryPoints = [
  {
    href: "/dashboard/overview",
    title: "Dashboard",
    description:
      "Start here to see health, risk, approvals, and recent activity in one operational view.",
    bullets: ["Live stats", "Recent actions", "Risk breakdown"],
    accent: "from-sky-500/20 via-cyan-500/10 to-transparent",
  },
  {
    href: "/dashboard/plugin",
    title: "Plugin",
    description:
      "Use the plugin surface to review approvals, pair a client, and talk to the agent in context.",
    bullets: ["Pairing", "Approvals", "Direct chat"],
    accent: "from-emerald-500/20 via-lime-500/10 to-transparent",
  },
  {
    href: "/dashboard/mcp",
    title: "MCP",
    description:
      "Inspect the gateway, connected servers, timings, and diagnostics before rolling out changes.",
    bullets: ["Topology", "Latency", "Diagnostics"],
    accent: "from-amber-500/20 via-orange-500/10 to-transparent",
  },
]

const quickLinks = [
  { href: "/dashboard/activity", label: "Activity" },
  { href: "/dashboard/approvals", label: "Approvals" },
  { href: "/dashboard/logs", label: "Logs" },
  { href: "/dashboard/settings", label: "Settings" },
]

export default function Home() {
  return (
    <main className="min-h-screen px-4 pb-10 pt-6 md:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl space-y-8">
        <section className="relative overflow-hidden rounded-3xl border border-[var(--border-primary)] bg-[var(--bg-elevated)] p-6 shadow-[0_24px_80px_rgba(0,0,0,0.12)] md:p-8">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(56,189,248,0.16),transparent_40%),radial-gradient(circle_at_bottom_left,rgba(34,197,94,0.12),transparent_35%)]" />
          <div className="relative grid gap-6 lg:grid-cols-[1.3fr_0.8fr] lg:items-end">
            <div className="space-y-4">
              <p className="text-xs font-semibold uppercase tracking-[0.28em] text-sky-500">
                Agent-Lock production workspace
              </p>
              <div className="space-y-3">
                <h1 className="text-3xl font-semibold tracking-tight text-[var(--text-primary)] md:text-4xl">
                  One clear path to the dashboard, plugin, and MCP gateway.
                </h1>
                <p className="max-w-2xl text-sm leading-6 text-[var(--text-secondary)] md:text-base">
                  Use the dashboard to monitor the system, the plugin to handle approvals and chat, and MCP to
                  manage connected servers and gateway health.
                </p>
              </div>
            </div>

            <div className="grid gap-3 rounded-2xl border border-[var(--border-primary)] bg-[var(--bg-primary)]/70 p-4 backdrop-blur-sm">
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[var(--text-tertiary)]">
                Quick start
              </p>
              <div className="grid grid-cols-2 gap-2">
                {quickLinks.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    className="rounded-xl border border-[var(--border-primary)] bg-[var(--bg-elevated)] px-3 py-2 text-sm font-medium text-[var(--text-primary)] transition hover:-translate-y-0.5 hover:border-[var(--accent-primary)] hover:shadow-md"
                  >
                    {item.label}
                  </Link>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="grid gap-4 lg:grid-cols-3">
          {entryPoints.map((entry) => (
            <Link key={entry.href} href={entry.href} className="group block h-full">
              <Card
                variant="interactive"
                padding="lg"
                className={`relative h-full overflow-hidden border-[var(--border-primary)] bg-gradient-to-br ${entry.accent}`}
              >
                <div className="flex h-full flex-col justify-between gap-5">
                  <div className="space-y-4">
                    <div className="flex items-center justify-between gap-3">
                      <h2 className="text-2xl font-semibold tracking-tight text-[var(--text-primary)]">
                        {entry.title}
                      </h2>
                      <span className="rounded-full border border-[var(--border-primary)] px-3 py-1 text-xs font-medium uppercase tracking-[0.2em] text-[var(--text-tertiary)]">
                        Open
                      </span>
                    </div>
                    <p className="text-sm leading-6 text-[var(--text-secondary)]">{entry.description}</p>
                  </div>

                  <div className="space-y-3">
                    <div className="flex flex-wrap gap-2">
                      {entry.bullets.map((bullet) => (
                        <span
                          key={bullet}
                          className="rounded-full border border-[var(--border-primary)] bg-[var(--bg-secondary)] px-3 py-1 text-xs font-medium text-[var(--text-secondary)]"
                        >
                          {bullet}
                        </span>
                      ))}
                    </div>
                    <div className="flex items-center gap-2 text-sm font-medium text-[var(--accent-primary)] transition group-hover:translate-x-1">
                      <span>Go to {entry.title}</span>
                      <span aria-hidden="true">-&gt;</span>
                    </div>
                  </div>
                </div>
              </Card>
            </Link>
          ))}
        </section>
      </div>
    </main>
  )
}
