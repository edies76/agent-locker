"use client"

import Link from "next/link"
import { useMemo, useState } from "react"
import { Badge, Card } from "./components/ui"

type Locale = "en" | "es"

type CopyShape = {
  badge: string
  subtitle: string
  heroTitle: string
  heroTitleAccent: string
  heroDescription: string
  primaryAction: string
  secondaryAction: string
  sections: {
    whatItDoes: string
    surfaces: string
    controlFlow: string
    howToStart: string
  }
  blocks: {
    whatItDoes: Array<{ title: string; desc: string }>
    surfaces: Array<{ title: string; desc: string }>
    controlFlow: Array<{ title: string; desc: string }>
    howToStart: Array<{ title: string; desc: string; code?: string }>
  }
  footer: string
}

const COPY: Record<Locale, CopyShape> = {
  en: {
    badge: "Production AI security middleware",
    subtitle: "Agent-Lock",
    heroTitle: "Govern AI actions",
    heroTitleAccent: "with real controls",
    heroDescription:
      "Agent-Lock intercepts AI tool calls, validates intent, enforces policy and approvals, and gives operators one control plane for MCP, plugin, and runtime governance.",
    primaryAction: "Open Dashboard",
    secondaryAction: "Go to Settings",
    sections: {
      whatItDoes: "What it does",
      surfaces: "Operational surfaces",
      controlFlow: "Control flow",
      howToStart: "How to start",
    },
    blocks: {
      whatItDoes: [
        {
          title: "Policy enforcement layer",
          desc: "Sits between AI agents and tools to allow, gate, or block actions based on policy and runtime controls.",
        },
        {
          title: "Intent-aware approvals",
          desc: "Combines intent validation and risk levels so sensitive actions require explicit approval before execution.",
        },
        {
          title: "Operational visibility",
          desc: "Centralized logs, activity, approvals, and diagnostics for production troubleshooting and governance.",
        },
      ],
      surfaces: [
        {
          title: "Dashboard",
          desc: "Operator console for activity, approvals, settings, analytics, and runtime controls.",
        },
        {
          title: "Plugin bridge",
          desc: "User-facing integration surface for approvals and chat workflows with governed execution.",
        },
        {
          title: "MCP gateway",
          desc: "MCP-oriented path for model clients, with policy and approval enforcement before tools execute.",
        },
      ],
      controlFlow: [
        {
          title: "Automatic tools",
          desc: "Safe read-only or low-risk calls can be auto-approved when policy allows it.",
        },
        {
          title: "Approval-required tools",
          desc: "High and critical actions stop at the dashboard until a human confirms them.",
        },
        {
          title: "Audit trail",
          desc: "Every decision is logged with action data, timing, and risk classification.",
        },
      ],
      howToStart: [
        {
          title: "1) Open the dashboard",
          desc: "Start in the overview so you can see health, approvals, and current activity.",
          code: "https://agent-lock-dashboard.azurewebsites.net/dashboard/overview",
        },
        {
          title: "2) Configure runtime controls",
          desc: "Use settings to tune auto-approval, confirmation flow, and provider scopes.",
        },
        {
          title: "3) Connect integrations",
          desc: "Enable plugin, MCP, and provider logins so each tool surface is governed consistently.",
        },
        {
          title: "4) Review and approve",
          desc: "Use Approvals, Logs, and Channel Chat to manage high-risk actions from one place.",
        },
      ],
    },
    footer: "Agent-Lock | Governance and approvals for AI tool execution",
  },
  es: {
    badge: "Middleware de seguridad para IA en produccion",
    subtitle: "Agent-Lock",
    heroTitle: "Gobierna acciones de IA",
    heroTitleAccent: "con controles reales",
    heroDescription:
      "Agent-Lock intercepta llamadas de herramientas, valida intencion, aplica politicas y aprobaciones, y entrega un plano de control para MCP, plugin y gobierno operativo.",
    primaryAction: "Abrir Dashboard",
    secondaryAction: "Ir a Settings",
    sections: {
      whatItDoes: "Que hace",
      surfaces: "Superficies operativas",
      controlFlow: "Flujo de control",
      howToStart: "Como empezar",
    },
    blocks: {
      whatItDoes: [
        {
          title: "Capa de enforcement de politicas",
          desc: "Se ubica entre agentes IA y herramientas para permitir, pausar o bloquear acciones segun politica y controles runtime.",
        },
        {
          title: "Aprobaciones con intencion",
          desc: "Combina validacion de intencion y niveles de riesgo para pedir aprobacion antes de ejecutar acciones sensibles.",
        },
        {
          title: "Visibilidad operativa",
          desc: "Logs, actividad, aprobaciones y diagnosticos centralizados para operacion y gobierno.",
        },
      ],
      surfaces: [
        {
          title: "Dashboard",
          desc: "Consola operativa para actividad, aprobaciones, settings, analitica y controles runtime.",
        },
        {
          title: "Plugin bridge",
          desc: "Superficie para aprobaciones y chat, con ejecucion gobernada.",
        },
        {
          title: "MCP gateway",
          desc: "Ruta orientada a clientes MCP, con enforcement antes de ejecutar herramientas.",
        },
      ],
      controlFlow: [
        {
          title: "Herramientas automaticas",
          desc: "Las llamadas seguras o de bajo riesgo pueden autoaprobarse si la politica lo permite.",
        },
        {
          title: "Herramientas con aprobacion",
          desc: "Las acciones altas y criticas se detienen en el dashboard hasta que una persona las aprueba.",
        },
        {
          title: "Trazabilidad",
          desc: "Cada decision queda registrada con datos de la accion, tiempos y nivel de riesgo.",
        },
      ],
      howToStart: [
        {
          title: "1) Abre el dashboard",
          desc: "Empieza en overview para ver salud, aprobaciones y actividad actual.",
          code: "https://agent-lock-dashboard.azurewebsites.net/dashboard/overview",
        },
        {
          title: "2) Configura controles runtime",
          desc: "Usa settings para ajustar auto-approval, confirmation flow y scopes por proveedor.",
        },
        {
          title: "3) Conecta integraciones",
          desc: "Activa plugin, MCP y provider logins para gobernar cada superficie de manera uniforme.",
        },
        {
          title: "4) Revisa y aprueba",
          desc: "Usa Approvals, Logs y Channel Chat para manejar acciones de alto riesgo desde un solo lugar.",
        },
      ],
    },
    footer: "Agent-Lock | Gobierno y aprobaciones para ejecucion de herramientas IA",
  },
}

function SectionGrid({ items }: { items: Array<{ title: string; desc: string; code?: string }> }) {
  return (
    <div className="mx-auto mt-5 grid max-w-6xl gap-4 md:grid-cols-2 xl:grid-cols-3">
      {items.map((item) => (
        <article
          key={item.title}
          className="group relative w-full overflow-hidden rounded-2xl border border-slate-800 bg-[var(--bg-elevated)] p-5 text-left shadow-[0_12px_34px_rgba(0,0,0,0.35)] transition duration-300 hover:-translate-y-1 hover:border-cyan-500/40"
        >
          <span className="absolute -right-10 -top-10 h-28 w-28 rounded-full bg-gradient-to-br from-cyan-500/20 to-transparent" />
          <h3 className="relative text-base font-semibold text-slate-100">{item.title}</h3>
          <p className="relative mt-2 text-sm leading-6 text-slate-400">{item.desc}</p>
          {item.code ? (
            <pre className="relative mt-3 overflow-x-auto rounded-lg border border-slate-800 bg-slate-950/80 px-3 py-2 text-xs text-slate-200">
              <code className="whitespace-pre-wrap">{item.code}</code>
            </pre>
          ) : null}
        </article>
      ))}
    </div>
  )
}

function SectionBlock({ title, items }: { title: string; items: Array<{ title: string; desc: string; code?: string }> }) {
  return (
    <section className="mx-auto mt-12 max-w-6xl md:mt-14">
      <h2 className="text-center text-2xl font-semibold tracking-tight text-slate-100 md:text-3xl">{title}</h2>
      <SectionGrid items={items} />
    </section>
  )
}

export default function LandingPage() {
  const [locale, setLocale] = useState<Locale>("en")
  const t = useMemo(() => COPY[locale], [locale])

  return (
    <div className="relative min-h-screen overflow-hidden bg-[var(--bg-secondary)] text-slate-100">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_10%_10%,_rgba(8,145,178,0.18),_transparent_35%),radial-gradient(circle_at_88%_14%,_rgba(16,185,129,0.10),_transparent_34%),radial-gradient(circle_at_52%_92%,_rgba(56,189,248,0.10),_transparent_48%)]" />
      <div className="pointer-events-none absolute -left-16 top-8 h-72 w-72 rounded-full bg-cyan-500/10 blur-3xl" />
      <div className="pointer-events-none absolute -right-10 top-0 h-80 w-80 rounded-full bg-sky-500/10 blur-3xl" />

      <header className="sticky top-0 z-40 border-b border-slate-800/80 bg-slate-950/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 md:px-6">
          <div>
            <p className="text-[11px] uppercase tracking-[0.22em] text-slate-400">{t.badge}</p>
            <h1 className="text-xl font-semibold text-slate-100">{t.subtitle}</h1>
          </div>
          <div className="flex items-center gap-2 md:gap-3">
            <div className="inline-flex overflow-hidden rounded-lg border border-slate-800 bg-slate-900 shadow-sm">
              <button
                type="button"
                onClick={() => setLocale("en")}
                className={`px-3 py-1.5 text-sm transition ${
                  locale === "en" ? "bg-slate-100 text-slate-900" : "bg-transparent text-slate-300 hover:bg-slate-800"
                }`}
              >
                EN
              </button>
              <button
                type="button"
                onClick={() => setLocale("es")}
                className={`px-3 py-1.5 text-sm transition ${
                  locale === "es" ? "bg-slate-100 text-slate-900" : "bg-transparent text-slate-300 hover:bg-slate-800"
                }`}
              >
                ES
              </button>
            </div>
            <Link
              href="/dashboard/overview"
              className="rounded-lg border border-cyan-500/40 bg-cyan-500 px-3 py-2 text-sm font-semibold text-white transition hover:-translate-y-0.5 hover:bg-cyan-400 md:px-4"
            >
              {t.primaryAction}
            </Link>
          </div>
        </div>
      </header>

      <main className="relative mx-auto max-w-7xl px-4 pb-16 pt-8 md:px-6 md:pt-12">
        <section className="relative overflow-hidden rounded-3xl border border-slate-800 bg-slate-950/90 p-6 text-center shadow-[0_24px_80px_rgba(0,0,0,0.35)] md:p-10">
          <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-cyan-400/70 to-transparent" />
          <div className="mx-auto grid max-w-5xl gap-10 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)] lg:items-center">
            <div className="mx-auto max-w-3xl">
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-cyan-300">{t.badge}</p>
              <h2 className="mt-3 max-w-4xl text-4xl font-semibold leading-tight text-slate-50 md:text-6xl">
                {t.heroTitle}{" "}
                <span className="bg-gradient-to-r from-cyan-300 via-sky-200 to-emerald-300 bg-clip-text text-transparent">
                  {t.heroTitleAccent}
                </span>
              </h2>
              <p className="mx-auto mt-5 max-w-3xl text-lg leading-8 text-slate-300">{t.heroDescription}</p>

              <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
                <Link
                  href="/dashboard/overview"
                  className="rounded-xl border border-cyan-500/40 bg-gradient-to-r from-cyan-600 to-sky-600 px-6 py-3 font-semibold text-white shadow-[0_10px_28px_rgba(8,145,178,0.24)] transition hover:-translate-y-0.5 hover:from-cyan-500 hover:to-sky-500"
                >
                  {t.primaryAction}
                </Link>
                <Link
                  href="/dashboard/settings"
                  className="rounded-xl border border-slate-800 bg-slate-900 px-6 py-3 font-semibold text-slate-100 transition hover:-translate-y-0.5 hover:border-cyan-500/40 hover:bg-slate-800"
                >
                  {t.secondaryAction}
                </Link>
              </div>

              <div className="mt-5 flex flex-wrap justify-center gap-2 text-xs font-medium">
                <Badge variant="accent">Realtime governance</Badge>
                <Badge variant="success">Policy + approval engine</Badge>
                <Badge variant="warning">Scoped token execution</Badge>
              </div>
            </div>

            <Card className="mx-auto w-full max-w-md border-slate-800 bg-slate-900/80 shadow-[0_20px_44px_rgba(0,0,0,0.35)]" padding="lg">
              <div className="space-y-4">
                <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                  <span className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Approval model</span>
                  <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-xs font-semibold text-emerald-300">
                    ACTIVE
                  </span>
                </div>
                <div className="space-y-2">
                  <div className="rounded-lg border border-slate-800 bg-slate-950/80 px-3 py-2 text-sm text-slate-200">
                    Intent + risk validation
                  </div>
                  <div className="rounded-lg border border-slate-800 bg-slate-950/80 px-3 py-2 text-sm text-slate-200">
                    Scoped provider controls
                  </div>
                  <div className="rounded-lg border border-slate-800 bg-slate-950/80 px-3 py-2 text-sm text-slate-200">
                    MCP, Plugin, Backend governance
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    ["Policy", "Enforced"],
                    ["Approvals", "Realtime"],
                    ["Audit", "Complete"],
                  ].map(([label, value]) => (
                    <div key={label} className="rounded-xl border border-slate-800 bg-slate-950/70 px-3 py-2">
                      <p className="text-[10px] uppercase tracking-[0.18em] text-slate-500">{label}</p>
                      <p className="text-sm font-semibold text-slate-100">{value}</p>
                    </div>
                  ))}
                </div>
              </div>
            </Card>
          </div>
        </section>

        <SectionBlock title={t.sections.whatItDoes} items={t.blocks.whatItDoes} />
        <SectionBlock title={t.sections.surfaces} items={t.blocks.surfaces} />
        <SectionBlock title={t.sections.controlFlow} items={t.blocks.controlFlow} />
        <SectionBlock title={t.sections.howToStart} items={t.blocks.howToStart} />

        <section className="mx-auto mt-12 max-w-6xl rounded-3xl border border-slate-800 bg-slate-950/90 p-6 text-center shadow-[0_20px_64px_rgba(0,0,0,0.3)] md:mt-14 md:p-8">
          <h2 className="text-2xl font-semibold text-slate-100">Connected account and provider logins</h2>
          <p className="mx-auto mt-3 max-w-4xl text-sm leading-7 text-slate-300">
            Agent-Lock supports two login layers directly from the dashboard flow: account login for the operator session,
            and provider logins for tool-scoped access using Auth0 Token Vault.
          </p>

          <div className="mt-5 grid gap-3 md:grid-cols-3">
            {[
              {
                title: "1) Account login",
                desc: "Create authenticated dashboard session before connecting providers.",
              },
              {
                title: "2) Provider login",
                desc: "Connect Google, GitHub, Slack, and other identities as secondary provider logins.",
              },
              {
                title: "3) Governed tool use",
                desc: "Issue short-lived scoped tokens only after policy and approval checks.",
              },
            ].map((item) => (
              <article
                key={item.title}
                className="rounded-xl border border-slate-800 bg-slate-900/70 p-4 transition hover:-translate-y-0.5 hover:border-cyan-500/40"
              >
                <h3 className="text-sm font-semibold text-slate-100">{item.title}</h3>
                <p className="mt-1 text-sm leading-6 text-slate-300">{item.desc}</p>
              </article>
            ))}
          </div>

          <div className="mt-5 flex flex-wrap gap-3">
            <Link
              href="/dashboard/chat"
              className="rounded-lg border border-slate-800 bg-slate-900 px-4 py-2 text-sm font-semibold text-slate-100 transition hover:border-cyan-500/40 hover:bg-slate-800"
            >
              Open channel chat
            </Link>
            <Link
              href="/dashboard/logs"
              className="rounded-lg border border-slate-800 bg-slate-900 px-4 py-2 text-sm font-semibold text-slate-100 transition hover:border-cyan-500/40 hover:bg-slate-800"
            >
              View logs
            </Link>
            <Link
              href="/dashboard/scopes"
              className="rounded-lg border border-slate-800 bg-slate-900 px-4 py-2 text-sm font-semibold text-slate-100 transition hover:border-cyan-500/40 hover:bg-slate-800"
            >
              Provider scopes
            </Link>
          </div>
        </section>

        <section className="mx-auto mt-12 max-w-6xl rounded-3xl border border-slate-800 bg-slate-950/90 p-6 text-center shadow-[0_20px_64px_rgba(0,0,0,0.3)] md:mt-14 md:p-8">
          <h2 className="text-2xl font-semibold text-slate-100">Architecture snapshot</h2>
          <p className="mx-auto mt-3 max-w-4xl text-sm leading-7 text-slate-300">
            Homepage summary of the production flow: AI client -&gt; Agent-Lock policy gate -&gt; risk + intent analysis
            -&gt; auto-approve or manual Telegram approval -&gt; scoped execution with full audit trail.
          </p>
          <div className="mx-auto mt-5 max-w-4xl overflow-x-auto rounded-xl border border-slate-800 bg-slate-950 p-4 text-left">
            <pre className="min-w-[520px] text-xs leading-6 text-slate-200">
{`AI Client (Claude/OpenClaw)
       |
       v
Agent-Lock Intercept Layer
  - policy rules
  - runtime controls
  - Gemini risk+intent analysis
       |
       +--> LOW: auto-approved execution
       |
       +--> HIGH/CRITICAL: Telegram approval required
       |
       v
Scoped provider token + audited execution`}
            </pre>
          </div>
        </section>
      </main>

      <footer className="border-t border-slate-800 bg-slate-950/80">
        <div className="mx-auto max-w-7xl px-4 py-6 text-sm text-slate-400 md:px-6">{t.footer}</div>
      </footer>
    </div>
  )
}
