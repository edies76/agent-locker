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

const capabilities = [
  {
    title: "Policy at the center",
    text: "One control plane defines which tools are automatic, which are paused, and which need human review.",
  },
  {
    title: "Automatic lane",
    text: "Safe, low-risk calls can move through automatically when policy allows it.",
  },
  {
    title: "Approval lane",
    text: "Higher-risk actions pause until a human reviews the context and decides.",
  },
  {
    title: "Audit trail",
    text: "Every decision is recorded so operators can debug, review, and tune policies later.",
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

function Panel({
  children,
  className = "",
}: {
  children: ReactNode
  className?: string
}) {
  return (
    <div
      className={`rounded-[28px] border border-[var(--border-primary)] bg-[var(--bg-elevated)]/78 shadow-[0_18px_44px_rgba(0,0,0,0.12)] backdrop-blur-xl ${className}`}
    >
      {children}
    </div>
  )
}

function MiniMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-[var(--border-primary)] bg-[var(--bg-secondary)] px-4 py-3">
      <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--text-tertiary)]">{label}</p>
      <p className="mt-1 text-sm font-semibold text-[var(--text-primary)]">{value}</p>
    </div>
  )
}

export default function LandingPage() {
  return (
    <main className="relative min-h-screen overflow-hidden px-4 pb-12 pt-6 md:px-6 lg:px-8">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(16,185,129,0.08),transparent_28%),radial-gradient(circle_at_bottom_left,rgba(245,158,11,0.06),transparent_24%),linear-gradient(90deg,rgba(16,185,129,0.05),transparent_18%,transparent_82%,rgba(245,158,11,0.05))]" />
      <div className="pointer-events-none absolute -left-16 top-0 h-72 w-72 rounded-full bg-emerald-500/8 blur-3xl" />
      <div className="pointer-events-none absolute -right-16 top-20 h-80 w-80 rounded-full bg-amber-500/8 blur-3xl" />
      <div className="pointer-events-none absolute left-0 top-24 h-[70vh] w-24 bg-gradient-to-r from-emerald-500/8 to-transparent blur-3xl" />
      <div className="pointer-events-none absolute right-0 top-24 h-[70vh] w-24 bg-gradient-to-l from-amber-500/8 to-transparent blur-3xl" />

      <div className="relative mx-auto flex max-w-7xl flex-col gap-7">
        <header className="flex flex-wrap items-center justify-between gap-3 rounded-full border border-[var(--border-primary)] bg-[var(--bg-elevated)]/80 px-4 py-3 backdrop-blur-sm">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[var(--accent-primary)] text-sm font-bold text-white shadow-md">
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

        <section className="grid gap-6 lg:grid-cols-[minmax(0,1.15fr)_minmax(320px,0.85fr)] lg:items-stretch">
          <Panel className="relative overflow-hidden p-6 md:p-8 lg:p-10">
            <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[var(--accent-primary)]/60 to-transparent" />
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
                <Link href="/dashboard/settings" className="btn btn-secondary rounded-full px-5 py-3 text-sm font-semibold">
                  Review Settings
                </Link>
              </div>

              <div className="grid gap-3 sm:grid-cols-3">
                {[
                  {
                    title: "Automatic lane",
                    text: "Low-risk actions move through cleanly when policy allows it.",
                  },
                  {
                    title: "Approval lane",
                    text: "Sensitive actions pause with enough context for a human decision.",
                  },
                  {
                    title: "Audit trail",
                    text: "Every decision is recorded for later review and policy tuning.",
                  },
                ].map((item, index) => (
                  <div
                    key={item.title}
                    className="rounded-[24px] border border-[var(--border-primary)] bg-[var(--bg-secondary)]/88 p-4 backdrop-blur-sm"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--text-tertiary)]">
                        0{index + 1}
                      </p>
                      <span className="h-2.5 w-2.5 rounded-full bg-[var(--accent-primary)]/60" />
                    </div>
                    <p className="mt-3 text-sm font-semibold text-[var(--text-primary)]">{item.title}</p>
                    <p className="mt-1 text-sm leading-6 text-[var(--text-secondary)]">{item.text}</p>
                  </div>
                ))}
              </div>
            </div>
          </Panel>

          <Panel className="overflow-hidden p-0">
            <div className="border-b border-[var(--border-primary)] bg-[var(--bg-secondary)]/72 px-6 py-5 md:px-7">
              <div className="flex items-start justify-between gap-4">
                <div className="space-y-2">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--text-tertiary)]">
                    Control snapshot
                  </p>
                  <h2 className="text-2xl font-semibold tracking-tight text-[var(--text-primary)]">
                    Built for operators
                  </h2>
                  <p className="max-w-md text-sm leading-6 text-[var(--text-secondary)]">
                    The rules are visually grouped so automatic and approval-based flows are clearly distinct at a glance.
                  </p>
                </div>
                <Badge variant="success">Ready</Badge>
              </div>
            </div>

            <div className="grid gap-3 p-6 md:p-7">
              <div className="rounded-[24px] border border-[var(--border-primary)] bg-[var(--bg-secondary)]/85 p-4 backdrop-blur-sm">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--text-tertiary)]">
                    Automatic tools
                  </p>
                  <span className="rounded-full border border-[var(--border-primary)] bg-[var(--bg-elevated)] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--text-tertiary)]">
                    Fast lane
                  </span>
                </div>
                <p className="mt-2 text-sm leading-6 text-[var(--text-secondary)]">
                  Safe, scoped actions can move through without human intervention when policy allows it.
                </p>
              </div>
              <div className="rounded-[24px] border border-[var(--border-primary)] bg-[var(--bg-secondary)]/85 p-4 backdrop-blur-sm">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--text-tertiary)]">
                    Approval-required tools
                  </p>
                  <span className="rounded-full border border-[var(--border-primary)] bg-[var(--bg-elevated)] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--text-tertiary)]">
                    Review lane
                  </span>
                </div>
                <p className="mt-2 text-sm leading-6 text-[var(--text-secondary)]">
                  Sensitive actions pause until a reviewer confirms the intent, arguments, and risk.
                </p>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <MiniMetric label="Policy" value="Enforced" />
                <MiniMetric label="Approvals" value="Realtime" />
                <MiniMetric label="Audit" value="Complete" />
              </div>
            </div>
          </Panel>
        </section>

        <section className="grid gap-4 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)]">
          <Card className="relative h-full overflow-hidden border-[var(--border-primary)] bg-[var(--bg-elevated)]/82 backdrop-blur-xl" padding="lg">
            <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(135deg,rgba(59,130,246,0.08),transparent_32%,rgba(16,185,129,0.05))]" />
            <div className="relative flex h-full flex-col justify-between gap-5">
              <div className="space-y-4">
                <div className="inline-flex rounded-full border border-[var(--border-primary)] bg-[var(--bg-secondary)] px-3 py-1 text-[11px] font-semibold tracking-[0.18em] text-[var(--text-tertiary)]">
                  Operational model
                </div>
                <div className="space-y-3">
                  <h2 className="text-2xl font-semibold tracking-tight text-[var(--text-primary)]">
                    Policy, approval, and audit stay visible in one flow.
                  </h2>
                  <p className="max-w-xl text-sm leading-6 text-[var(--text-secondary)]">
                    The homepage is arranged to tell the governance story first, then surface the routes into the
                    product, and finally show the execution model. That makes each box easier to distinguish.
                  </p>
                </div>
              </div>
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="rounded-[22px] border border-[var(--border-primary)] bg-[var(--bg-secondary)]/85 p-4 backdrop-blur-sm">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--text-tertiary)]">
                    Top layer
                  </p>
                  <p className="mt-2 text-sm font-semibold text-[var(--text-primary)]">Operator view</p>
                </div>
                <div className="rounded-[22px] border border-[var(--border-primary)] bg-[var(--bg-secondary)]/85 p-4 backdrop-blur-sm">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--text-tertiary)]">
                    Middle layer
                  </p>
                  <p className="mt-2 text-sm font-semibold text-[var(--text-primary)]">Policy rules</p>
                </div>
                <div className="rounded-[22px] border border-[var(--border-primary)] bg-[var(--bg-secondary)]/85 p-4 backdrop-blur-sm">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--text-tertiary)]">
                    Bottom layer
                  </p>
                  <p className="mt-2 text-sm font-semibold text-[var(--text-primary)]">Audited actions</p>
                </div>
              </div>
            </div>
          </Card>

          <div className="grid gap-4 sm:grid-cols-3 lg:grid-cols-1">
            {capabilities.slice(1).map((item, index) => (
              <Card
                key={item.title}
                className="relative h-full overflow-hidden border-[var(--border-primary)] bg-[var(--bg-elevated)]"
                padding="lg"
              >
                <div className="pointer-events-none absolute right-0 top-0 h-24 w-24 rounded-full bg-[var(--accent-primary)]/8 blur-2xl" />
                <div className="relative flex h-full flex-col gap-4">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[var(--accent-muted)] text-sm font-bold text-[var(--accent-primary)]">
                      0{index + 1}
                    </div>
                    <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--text-tertiary)]">
                      Control
                    </span>
                  </div>
                  <h2 className="text-base font-semibold text-[var(--text-primary)]">{item.title}</h2>
                  <p className="text-sm leading-6 text-[var(--text-secondary)]">{item.text}</p>
                </div>
              </Card>
            ))}
          </div>
        </section>

        <section>
          <div className="mb-4 flex items-end justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--text-tertiary)]">
                Where it lives
              </p>
              <h2 className="mt-1 text-2xl font-semibold tracking-tight text-[var(--text-primary)]">
                Direct routes into the product
              </h2>
            </div>
            <Badge variant="neutral">Functional entry points</Badge>
          </div>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {surfaces.map((surface, index) => (
              <Link key={surface.href} href={surface.href} className="group block h-full">
                <Card
                  variant="interactive"
                  padding="lg"
                  className="relative h-full overflow-hidden border-[var(--border-primary)] bg-[var(--bg-elevated)]/82 backdrop-blur-xl"
                >
                  <div className="absolute inset-x-0 top-0 h-1 bg-[var(--accent-primary)]" />
                  <div className="relative flex h-full flex-col justify-between gap-5">
                    <div className="space-y-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="space-y-3">
                          <span className="inline-flex rounded-full border border-[var(--border-primary)] bg-[var(--bg-secondary)] px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--text-tertiary)]">
                            {surface.badge}
                          </span>
                          <div className="flex items-center gap-3">
                            <span className="flex h-10 w-10 items-center justify-center rounded-2xl border border-[var(--border-primary)] bg-[var(--bg-secondary)] text-sm font-semibold text-[var(--text-primary)]">
                              0{index + 1}
                            </span>
                            <div>
                              <h3 className="text-xl font-semibold tracking-tight text-[var(--text-primary)]">
                                {surface.title}
                              </h3>
                              <p className="text-sm text-[var(--text-tertiary)]">Direct route</p>
                            </div>
                          </div>
                        </div>
                      </div>
                      <p className="max-w-md text-sm leading-6 text-[var(--text-secondary)]">{surface.desc}</p>
                    </div>

                    <div className="flex items-center justify-between border-t border-[var(--border-primary)] pt-4">
                      <span className="text-sm font-medium text-[var(--accent-primary)]">Open {surface.title}</span>
                      <span className="rounded-full border border-[var(--border-primary)] bg-[var(--bg-secondary)] px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--text-tertiary)]">
                        View
                      </span>
                    </div>
                  </div>
                </Card>
              </Link>
            ))}
          </div>
        </section>

        <section className="grid gap-4 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)]">
          <Card className="relative h-full overflow-hidden border-[var(--border-primary)] bg-[var(--bg-elevated)]" padding="lg">
            <div className="pointer-events-none absolute inset-x-0 top-0 h-1 bg-[var(--accent-primary)]" />
            <div className="relative flex h-full flex-col justify-between gap-5">
              <div className="space-y-4">
                <div className="inline-flex rounded-full border border-[var(--border-primary)] bg-[var(--bg-secondary)] px-3 py-1 text-[11px] font-semibold tracking-[0.18em] text-[var(--text-tertiary)]">
                  Start here
                </div>
                <div className="space-y-2">
                  <h3 className="text-xl font-semibold text-[var(--text-primary)]">A smoother path from visit to setup.</h3>
                  <p className="text-sm leading-6 text-[var(--text-secondary)]">
                    The layout now reads more like a homepage and less like a stack of same-sized boxes, with clearer
                    rhythm and more visual separation between sections.
                  </p>
                </div>
              </div>
              <Link
                href="/dashboard/overview"
                className="text-sm font-medium text-[var(--accent-primary)] transition hover:translate-x-1"
              >
                Start with Overview -&gt;
              </Link>
            </div>
          </Card>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1">
            {starterSteps.slice(1).map((step, index) => (
              <Card
                key={step.title}
                className="relative h-full overflow-hidden border-[var(--border-primary)] bg-[var(--bg-elevated)]"
                padding="lg"
              >
                <div className="pointer-events-none absolute inset-x-0 top-0 h-1 bg-[var(--accent-primary)]" />
                <div className="relative flex h-full flex-col justify-between gap-5">
                  <div className="space-y-4">
                    <div className="flex items-center gap-3">
                      <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[var(--accent-muted)] text-sm font-bold text-[var(--accent-primary)]">
                        {step.step}
                      </div>
                      <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--text-tertiary)]">
                        0{index + 2}
                      </span>
                    </div>
                    <div className="space-y-2">
                      <h3 className="text-base font-semibold text-[var(--text-primary)]">{step.title}</h3>
                      <p className="text-sm leading-6 text-[var(--text-secondary)]">{step.text}</p>
                    </div>
                  </div>
                  <Link
                    href={step.href}
                    className="text-sm font-medium text-[var(--accent-primary)] transition hover:translate-x-1"
                  >
                    Continue
                  </Link>
                </div>
              </Card>
            ))}
          </div>
        </section>

        <section className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(360px,0.72fr)]">
          <Panel className="p-6 md:p-8">
            <div className="space-y-4">
              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--text-tertiary)]">
                  Architecture snapshot
                </p>
                <h2 className="text-2xl font-semibold tracking-tight text-[var(--text-primary)]">
                  One flow from request to audited execution
                </h2>
              </div>
              <div className="overflow-x-auto rounded-2xl border border-[var(--border-primary)] bg-[var(--bg-secondary)] p-4">
                <pre className="min-w-[540px] text-xs leading-6 text-[var(--text-secondary)]">
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
          </Panel>

          <Card className="h-full border-[var(--border-primary)]" padding="lg">
            <div className="space-y-4">
              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--text-tertiary)]">
                  Connected surfaces
                </p>
                <h2 className="text-2xl font-semibold tracking-tight text-[var(--text-primary)]">
                  Designed for fast review
                </h2>
              </div>
              <div className="space-y-3">
                {[
                  "Account login for the operator session",
                  "Provider logins for scoped tool access",
                  "Approvals and logs for review workflows",
                ].map((line) => (
                  <div
                    key={line}
                    className="rounded-2xl border border-[var(--border-primary)] bg-[var(--bg-secondary)] px-4 py-3 text-sm text-[var(--text-secondary)]"
                  >
                    {line}
                  </div>
                ))}
              </div>
            </div>
          </Card>
        </section>

        <footer className="pb-2 pt-1 text-sm text-[var(--text-tertiary)]">
          Agent-Lock | Governance and approvals for AI tool execution
        </footer>
      </div>
    </main>
  )
}
