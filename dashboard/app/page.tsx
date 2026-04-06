"use client"

import Link from "next/link"
import type { ReactNode } from "react"
import { Badge, Card } from "./components/ui"

const surfaces = [
  {
    href: "/dashboard/overview",
    title: "Dashboard",
    desc: "System health, activity, risk distribution, and approval flow in one place.",
    badge: "Operations",
  },
  {
    href: "/dashboard/approvals",
    title: "Approvals",
    desc: "Review pending actions, inspect arguments, and approve or reject with context.",
    badge: "Human review",
  },
  {
    href: "/dashboard/settings",
    title: "Settings",
    desc: "Define what stays automatic, what pauses for approval, and which scopes are active.",
    badge: "Policy",
  },
  {
    href: "/dashboard/mcp",
    title: "MCP",
    desc: "Check connected servers, timings, and diagnostics before shipping changes.",
    badge: "Gateway",
  },
  {
    href: "/dashboard/plugin",
    title: "Plugin",
    desc: "Manage pairing, chat, and bridge state for governed execution.",
    badge: "Bridge",
  },
  {
    href: "/dashboard/logs",
    title: "Logs",
    desc: "Filter audit events and trace exactly how each action was handled.",
    badge: "Audit",
  },
]

const controlPoints = [
  {
    title: "Automatic lane",
    text: "Safe, low-risk calls move through cleanly when policy allows it.",
  },
  {
    title: "Approval lane",
    text: "Sensitive actions pause with enough context for a human decision.",
  },
  {
    title: "Audit trail",
    text: "Every decision is recorded for later review and policy tuning.",
  },
]

const starterSteps = [
  {
    step: "01",
    title: "Open the dashboard",
    text: "Start with the overview to see health, pending approvals, and recent activity.",
    href: "/dashboard/overview",
  },
  {
    step: "02",
    title: "Set the policy",
    text: "Use Settings to define what stays automatic and what requires approval.",
    href: "/dashboard/settings",
  },
  {
    step: "03",
    title: "Review the queue",
    text: "Check approvals and logs when the system pauses a sensitive request.",
    href: "/dashboard/approvals",
  },
]

function GlassPanel({
  children,
  className = "",
}: {
  children: ReactNode
  className?: string
}) {
  return (
    <div
      className={`rounded-[32px] border border-white/10 bg-white/[0.05] shadow-[0_24px_70px_rgba(0,0,0,0.35)] backdrop-blur-2xl ${className}`}
    >
      {children}
    </div>
  )
}

function SectionTitle({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow: string
  title: string
  description: string
  action?: ReactNode
}) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div className="max-w-3xl space-y-2">
        <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[var(--text-tertiary)]">
          {eyebrow}
        </p>
        <h2 className="text-2xl font-semibold tracking-tight text-[var(--text-primary)] md:text-3xl">{title}</h2>
        <p className="max-w-2xl text-sm leading-6 text-[var(--text-secondary)] md:text-base">{description}</p>
      </div>
      {action}
    </div>
  )
}

export default function LandingPage() {
  return (
    <main className="relative min-h-screen overflow-hidden px-4 py-6 md:px-6 lg:px-8">
      <div className="pointer-events-none absolute inset-0 bg-[#05070c]" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_18%_18%,rgba(16,185,129,0.12),transparent_22%),radial-gradient(circle_at_82%_12%,rgba(59,130,246,0.14),transparent_24%),radial-gradient(circle_at_50%_92%,rgba(245,158,11,0.08),transparent_28%)]" />
      <div className="pointer-events-none absolute left-0 top-24 h-[68vh] w-24 bg-gradient-to-r from-emerald-500/10 to-transparent blur-3xl" />
      <div className="pointer-events-none absolute right-0 top-24 h-[68vh] w-24 bg-gradient-to-l from-amber-500/10 to-transparent blur-3xl" />
      <div className="pointer-events-none absolute -left-16 top-0 h-72 w-72 rounded-full bg-emerald-500/10 blur-3xl" />
      <div className="pointer-events-none absolute -right-16 top-20 h-80 w-80 rounded-full bg-cyan-500/10 blur-3xl" />

      <div className="relative mx-auto flex max-w-7xl flex-col gap-7">
        <header className="flex flex-wrap items-center justify-between gap-3 rounded-full border border-white/10 bg-white/[0.05] px-4 py-3 backdrop-blur-2xl">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[var(--accent-primary)] text-sm font-bold text-white shadow-md shadow-black/20">
              A
            </div>
            <div>
              <p className="text-[11px] uppercase tracking-[0.2em] text-[var(--text-tertiary)]">
                Production AI security middleware
              </p>
              <p className="text-sm font-semibold text-[var(--text-primary)]">Agent-Lock</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Badge variant="success">Live</Badge>
            <Link href="/dashboard/overview" className="btn btn-primary rounded-full px-4 py-2 text-sm font-semibold">
              Open Dashboard
            </Link>
          </div>
        </header>

        <section className="grid gap-6 lg:grid-cols-[minmax(0,1.12fr)_minmax(0,0.88fr)] lg:items-stretch">
          <GlassPanel className="relative overflow-hidden p-6 md:p-8 lg:p-10">
            <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/40 to-transparent" />
            <div className="pointer-events-none absolute right-0 top-0 h-40 w-40 rounded-full bg-emerald-500/10 blur-3xl" />
            <div className="pointer-events-none absolute bottom-0 left-0 h-40 w-40 rounded-full bg-amber-500/10 blur-3xl" />

            <div className="relative flex h-full flex-col justify-between gap-8">
              <div className="space-y-5">
                <Badge variant="accent">Govern AI actions with real controls</Badge>
                <div className="space-y-5">
                  <h1 className="max-w-3xl text-4xl font-extrabold tracking-tight text-[var(--text-primary)] md:text-6xl">
                    Govern AI actions with real controls.
                  </h1>
                  <p className="max-w-2xl text-base leading-7 text-[var(--text-secondary)] md:text-lg">
                    Agent-Lock sits between AI agents and tools, classifies risk, enforces approvals, and gives
                    operators one clean control plane for policy, gateway health, and execution history.
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap gap-3">
                <Link href="/dashboard/overview" className="btn btn-primary rounded-full px-5 py-3 text-sm font-semibold">
                  Open Dashboard
                </Link>
                <Link
                  href="/dashboard/settings"
                  className="btn btn-secondary rounded-full px-5 py-3 text-sm font-semibold"
                >
                  Review Settings
                </Link>
              </div>

              <div className="flex flex-wrap gap-2">
                <Badge variant="success">Automatic + approval lanes</Badge>
                <Badge variant="warning">Risk-based controls</Badge>
                <Badge variant="accent">Central audit trail</Badge>
              </div>
            </div>
          </GlassPanel>

          <GlassPanel className="overflow-hidden p-0">
            <div className="border-b border-white/10 bg-white/[0.04] px-6 py-5 md:px-7">
              <div className="flex items-start justify-between gap-4">
                <div className="space-y-2">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--text-tertiary)]">
                    Control snapshot
                  </p>
                  <h2 className="text-2xl font-semibold tracking-tight text-[var(--text-primary)]">
                    Built for operators
                  </h2>
                  <p className="max-w-md text-sm leading-6 text-[var(--text-secondary)]">
                    The homepage is arranged like a product landing page, with the control story first and the route
                    map below it.
                  </p>
                </div>
                <Badge variant="success">Ready</Badge>
              </div>
            </div>

            <div className="grid gap-3 p-6 md:p-7">
              <div className="grid gap-3 md:grid-cols-2">
                <div className="rounded-[24px] border border-white/10 bg-white/[0.04] p-4">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--text-tertiary)]">
                      Automatic tools
                    </p>
                    <span className="rounded-full border border-white/10 bg-white/[0.03] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--text-tertiary)]">
                      Fast lane
                    </span>
                  </div>
                  <p className="mt-2 text-sm leading-6 text-[var(--text-secondary)]">
                    Safe, scoped actions can move through without human intervention when policy allows it.
                  </p>
                </div>
                <div className="rounded-[24px] border border-white/10 bg-white/[0.04] p-4">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--text-tertiary)]">
                      Approval-required tools
                    </p>
                    <span className="rounded-full border border-white/10 bg-white/[0.03] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--text-tertiary)]">
                      Review lane
                    </span>
                  </div>
                  <p className="mt-2 text-sm leading-6 text-[var(--text-secondary)]">
                    Sensitive actions pause until a reviewer confirms the intent, arguments, and risk.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--text-tertiary)]">
                    Policy
                  </p>
                  <p className="mt-1 text-sm font-semibold text-[var(--text-primary)]">Enforced</p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--text-tertiary)]">
                    Approvals
                  </p>
                  <p className="mt-1 text-sm font-semibold text-[var(--text-primary)]">Realtime</p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--text-tertiary)]">
                    Audit
                  </p>
                  <p className="mt-1 text-sm font-semibold text-[var(--text-primary)]">Complete</p>
                </div>
              </div>
            </div>
          </GlassPanel>
        </section>

        <section className="grid gap-4 md:grid-cols-3">
          {controlPoints.map((item) => (
            <Card key={item.title} className="h-full border-white/10 bg-white/[0.04]" padding="lg">
              <div className="flex h-full flex-col gap-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.03] text-sm font-bold text-[var(--text-primary)]">
                    •
                  </div>
                  <h2 className="text-base font-semibold text-[var(--text-primary)]">{item.title}</h2>
                </div>
                <p className="text-sm leading-6 text-[var(--text-secondary)]">{item.text}</p>
              </div>
            </Card>
          ))}
        </section>

        <section>
          <SectionTitle
            eyebrow="Where it lives"
            title="Direct routes into the product"
            description="The homepage uses a wide, even three-column grid for the primary entry points so the cards read clearly across the page."
            action={<Badge variant="neutral">Functional entry points</Badge>}
          />

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {surfaces.map((surface, index) => (
              <Link key={surface.href} href={surface.href} className="group block h-full">
                <Card
                  variant="interactive"
                  padding="lg"
                  className="relative h-full overflow-hidden border-white/10 bg-white/[0.045]"
                >
                  <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-emerald-400 via-cyan-400 to-amber-300 opacity-90" />
                  <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.05),transparent_40%)]" />

                  <div className="relative flex h-full flex-col justify-between gap-5">
                    <div className="space-y-4">
                      <div className="flex items-start justify-between gap-3">
                        <span className="inline-flex rounded-full border border-white/10 bg-white/[0.03] px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--text-tertiary)]">
                          {surface.badge}
                        </span>
                        <span className="text-xs font-mono text-[var(--text-muted)]">0{index + 1}</span>
                      </div>

                      <div className="space-y-2">
                        <h3 className="text-xl font-semibold tracking-tight text-[var(--text-primary)]">
                          {surface.title}
                        </h3>
                        <p className="text-sm leading-6 text-[var(--text-secondary)]">{surface.desc}</p>
                      </div>
                    </div>

                    <div className="flex items-center justify-between border-t border-white/10 pt-4">
                      <span className="text-sm font-medium text-[var(--accent-primary)] transition group-hover:translate-x-1">
                        Open {surface.title}
                      </span>
                      <span className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--text-tertiary)]">
                        View
                      </span>
                    </div>
                  </div>
                </Card>
              </Link>
            ))}
          </div>
        </section>

        <section className="grid gap-4 lg:grid-cols-[minmax(0,1.12fr)_minmax(0,0.88fr)]">
          <GlassPanel className="relative overflow-hidden p-6 md:p-8">
            <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/35 to-transparent" />
            <div className="space-y-4">
              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--text-tertiary)]">
                  Architecture snapshot
                </p>
                <h2 className="text-2xl font-semibold tracking-tight text-[var(--text-primary)]">
                  One flow from request to audited execution
                </h2>
                <p className="max-w-2xl text-sm leading-6 text-[var(--text-secondary)]">
                  The flow is kept simple and readable, just like the reference style: the product does the explanation,
                  not a lot of extra chrome.
                </p>
              </div>

              <div className="overflow-x-auto rounded-[24px] border border-white/10 bg-black/20 p-4">
                <pre className="min-w-[560px] text-xs leading-6 text-[var(--text-secondary)]">
{`AI Client
   |
   v
Agent-Lock policy gate
   |
   +--> Low risk -> automatic lane
   |
   +--> High risk -> approval queue
   |
   v
Scoped execution + audit trail`}
                </pre>
              </div>
            </div>
          </GlassPanel>

          <GlassPanel className="relative overflow-hidden p-6 md:p-8">
            <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/35 to-transparent" />
            <div className="space-y-4">
              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--text-tertiary)]">
                  Start here
                </p>
                <h2 className="text-2xl font-semibold tracking-tight text-[var(--text-primary)]">
                  A smoother path from visit to setup.
                </h2>
              </div>

              <div className="space-y-3">
                {starterSteps.map((step) => (
                  <div key={step.title} className="rounded-[24px] border border-white/10 bg-white/[0.04] p-4">
                    <div className="flex items-center gap-3">
                      <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.03] text-sm font-bold text-[var(--accent-primary)]">
                        {step.step}
                      </div>
                      <div className="min-w-0">
                        <h3 className="text-base font-semibold text-[var(--text-primary)]">{step.title}</h3>
                        <p className="text-sm leading-6 text-[var(--text-secondary)]">{step.text}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex flex-wrap gap-3 pt-1">
                <Link href="/dashboard/overview" className="btn btn-primary rounded-full px-5 py-3 text-sm font-semibold">
                  Start with Overview
                </Link>
                <Link href="/dashboard/logs" className="btn btn-secondary rounded-full px-5 py-3 text-sm font-semibold">
                  View Logs
                </Link>
              </div>
            </div>
          </GlassPanel>
        </section>

        <footer className="pb-2 pt-1 text-sm text-[var(--text-tertiary)]">
          Agent-Lock | Governance and approvals for AI tool execution
        </footer>
      </div>
    </main>
  )
}
