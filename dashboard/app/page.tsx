"use client"

import Link from "next/link"
import { useMemo, useState } from "react"

type Locale = "en" | "es"

type CopyShape = {
  badge: string
  subtitle: string
  heroTitle: string
  heroTitleAccent: string
  heroDescription: string
  openDashboard: string
  viewGithub: string
  sections: {
    whatIs: string
    usage: string
    integrations: string
    howToUse: string
  }
  cards: {
    whatIs: Array<{ title: string; desc: string }>
    usage: Array<{ title: string; desc: string }>
    integrations: Array<{ title: string; desc: string }>
    howToUse: Array<{ title: string; desc: string; code?: string }>
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
    openDashboard: "Open Dashboard",
    viewGithub: "View on GitHub",
    sections: {
      whatIs: "What is Agent-Lock?",
      usage: "How Agent-Lock is used",
      integrations: "Integration surfaces",
      howToUse: "How to use it",
    },
    cards: {
      whatIs: [
        {
          title: "Policy enforcement layer",
          desc: "Sits between AI agents and tools to allow, gate, or block actions based on policy and runtime controls.",
        },
        {
          title: "Intent-aware approvals",
          desc: "Combines intent validation and risk levels (LOW/HIGH/CRITICAL) so sensitive actions require explicit approval.",
        },
        {
          title: "Operational visibility",
          desc: "Centralized logs, activity, approvals, and diagnostics for production troubleshooting and governance.",
        },
      ],
      usage: [
        {
          title: "For AI operations teams",
          desc: "Define guardrails, monitor behavior, and reduce accidental or unauthorized tool execution.",
        },
        {
          title: "For security-focused workflows",
          desc: "Use manual approvals, policy rules, and audit history when actions can affect production data or systems.",
        },
        {
          title: "For multi-tool agent stacks",
          desc: "Apply the same control model across MCP tools, plugin actions, and cloud/local backend execution.",
        },
      ],
      integrations: [
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
      howToUse: [
        {
          title: "1) Open landing and dashboard",
          desc: "Use the landing page for product context, then open the dashboard for operations.",
          code: "https://agent-lock-dashboard.azurewebsites.net\nhttps://agent-lock-dashboard.azurewebsites.net/dashboard/overview",
        },
        {
          title: "2) Configure controls",
          desc: "Set runtime controls, integration modes, and per-provider scopes from dashboard settings.",
        },
        {
          title: "3) Connect integrations",
          desc: "Configure Auth0-connected providers (Google/GitHub/Slack), then validate approvals and logs in production.",
        },
      ],
    },
    footer: "Agent-Lock | Governance and approvals for AI tool execution",
  },
  es: {
    badge: "Middleware de seguridad para IA en producción",
    subtitle: "Agent-Lock",
    heroTitle: "Gobierna acciones de IA",
    heroTitleAccent: "con controles reales",
    heroDescription:
      "Agent-Lock intercepta llamadas de herramientas, valida intención, aplica políticas y aprobaciones, y entrega un plano de control para MCP, plugin y gobierno operativo.",
    openDashboard: "Abrir Dashboard",
    viewGithub: "Ver en GitHub",
    sections: {
      whatIs: "¿Qué es Agent-Lock?",
      usage: "Cómo se usa Agent-Lock",
      integrations: "Superficies de integración",
      howToUse: "Cómo usarlo",
    },
    cards: {
      whatIs: [
        {
          title: "Capa de enforcement de políticas",
          desc: "Se ubica entre agentes IA y herramientas para permitir, pausar o bloquear acciones según política y controles runtime.",
        },
        {
          title: "Aprobaciones con intención",
          desc: "Combina validación de intención y niveles de riesgo (LOW/HIGH/CRITICAL) para pedir aprobación cuando corresponde.",
        },
        {
          title: "Visibilidad operativa",
          desc: "Logs, actividad, aprobaciones y diagnósticos centralizados para operación y gobierno.",
        },
      ],
      usage: [
        {
          title: "Para equipos de AI operations",
          desc: "Define guardrails, monitorea comportamiento y reduce ejecución accidental o no autorizada.",
        },
        {
          title: "Para flujos orientados a seguridad",
          desc: "Usa aprobaciones manuales, reglas de política e historial de auditoría cuando hay impacto productivo.",
        },
        {
          title: "Para stacks multi-herramienta",
          desc: "Aplica el mismo modelo de control en herramientas MCP, plugin y backend cloud/local.",
        },
      ],
      integrations: [
        {
          title: "Dashboard",
          desc: "Consola operativa para actividad, aprobaciones, settings, analítica y controles runtime.",
        },
        {
          title: "Plugin bridge",
          desc: "Superficie para aprobaciones y chat, con ejecución gobernada.",
        },
        {
          title: "MCP gateway",
          desc: "Ruta orientada a clientes MCP, con enforcement antes de ejecutar herramientas.",
        },
      ],
      howToUse: [
        {
          title: "1) Abre landing y dashboard",
          desc: "Usa la landing para contexto y luego entra al dashboard para operar.",
          code: "https://agent-lock-dashboard.azurewebsites.net\nhttps://agent-lock-dashboard.azurewebsites.net/dashboard/overview",
        },
        {
          title: "2) Configura controles",
          desc: "Ajusta runtime controls, integration modes y scopes por proveedor desde settings.",
        },
        {
          title: "3) Conecta integraciones",
          desc: "Configura proveedores en Auth0 (Google/GitHub/Slack) y valida aprobaciones y logs.",
        },
      ],
    },
    footer: "Agent-Lock | Gobierno y aprobaciones para ejecución de herramientas IA",
  },
}

function SectionStream({
  items,
}: {
  items: Array<{ title: string; desc: string; code?: string }>
}) {
  return (
    <div className="relative mt-6 space-y-4">
      <div className="pointer-events-none absolute bottom-0 left-4 top-0 w-px bg-gradient-to-b from-red-400/60 via-zinc-500/70 to-transparent" />
      {items.map((item, idx) => (
        <article
          key={item.title}
          className="relative overflow-hidden rounded-2xl border border-zinc-700/70 bg-zinc-900/45 p-5 pl-10 backdrop-blur-sm transition duration-300 hover:-translate-y-0.5 hover:border-red-400/60 hover:bg-zinc-800/55"
        >
          <span className="absolute left-3.5 top-6 h-2.5 w-2.5 rounded-full bg-red-400 shadow-[0_0_0_5px_rgba(239,68,68,0.18)]" />
          <span className="absolute right-0 top-0 h-full w-24 bg-gradient-to-l from-red-500/8 to-transparent" />
          <p className="mb-1 text-[11px] uppercase tracking-[0.22em] text-zinc-400">Phase {idx + 1}</p>
          <h3 className="text-base font-semibold text-zinc-100">{item.title}</h3>
          <p className="mt-1 text-sm leading-6 text-zinc-300">{item.desc}</p>
          {item.code ? (
            <pre className="mt-3 overflow-x-auto rounded-lg border border-zinc-700/70 bg-zinc-950/80 px-3 py-2">
              <code className="whitespace-pre-wrap text-xs text-zinc-200">{item.code}</code>
            </pre>
          ) : null}
        </article>
      ))}
    </div>
  )
}

export default function LandingPage() {
  const [locale, setLocale] = useState<Locale>("en")
  const t = useMemo(() => COPY[locale], [locale])

  return (
    <div className="relative min-h-screen overflow-hidden bg-gradient-to-b from-zinc-800 via-zinc-900 to-zinc-950 text-white">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_12%_18%,_rgba(239,68,68,0.2),_transparent_33%),radial-gradient(circle_at_84%_10%,_rgba(148,163,184,0.24),_transparent_46%)]" />
      <div className="pointer-events-none absolute -left-20 top-8 h-72 w-72 animate-[pulse_8s_ease-in-out_infinite] rounded-full bg-red-500/15 blur-3xl" />
      <div className="pointer-events-none absolute right-0 top-0 h-[26rem] w-[26rem] animate-[pulse_10s_ease-in-out_infinite] rounded-full bg-zinc-300/15 blur-3xl" />
      <div className="pointer-events-none absolute bottom-10 right-10 h-64 w-64 animate-[pulse_9s_ease-in-out_infinite] rounded-full bg-red-400/10 blur-3xl" />

      <header className="sticky top-0 z-40 border-b border-zinc-700/70 bg-zinc-900/70 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <div>
            <p className="text-xs uppercase tracking-[0.24em] text-zinc-300">{t.badge}</p>
            <h1 className="text-xl font-bold text-zinc-100">{t.subtitle}</h1>
          </div>
          <div className="flex items-center gap-3">
            <div className="inline-flex overflow-hidden rounded-lg border border-zinc-600/70 bg-zinc-800/70">
              <button
                type="button"
                onClick={() => setLocale("en")}
                className={`px-3 py-1.5 text-sm transition ${locale === "en" ? "bg-zinc-100 text-zinc-900" : "bg-transparent text-zinc-300 hover:bg-zinc-700/80"}`}
              >
                EN
              </button>
              <button
                type="button"
                onClick={() => setLocale("es")}
                className={`px-3 py-1.5 text-sm transition ${locale === "es" ? "bg-zinc-100 text-zinc-900" : "bg-transparent text-zinc-300 hover:bg-zinc-700/80"}`}
              >
                ES
              </button>
            </div>
            <Link
              href="/dashboard/overview"
              className="rounded-lg border border-zinc-300/30 bg-zinc-100 px-4 py-2 text-sm font-semibold text-zinc-900 transition hover:bg-zinc-200"
            >
              {t.openDashboard}
            </Link>
          </div>
        </div>
      </header>

      <main className="relative mx-auto max-w-7xl px-6 pb-16 pt-16">
        <section className="relative overflow-hidden rounded-3xl border border-zinc-600/70 bg-zinc-900/55 p-8 shadow-[0_24px_64px_rgba(0,0,0,0.35)] backdrop-blur-xl md:p-12">
          <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-red-400/70 to-transparent" />
          <div className="grid gap-12 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)] lg:items-center">
            <div>
              <p className="text-xs uppercase tracking-[0.24em] text-red-400">{t.badge}</p>
              <h2 className="mt-3 max-w-5xl text-4xl font-bold leading-tight md:text-6xl">
                {t.heroTitle}{" "}
                <span className="bg-gradient-to-r from-red-400 via-zinc-200 to-zinc-100 bg-clip-text text-transparent">
                  {t.heroTitleAccent}
                </span>
              </h2>
              <p className="mt-5 max-w-3xl text-lg leading-8 text-zinc-300">{t.heroDescription}</p>
              <div className="mt-8 flex flex-wrap gap-3">
                <Link
                  href="/dashboard/overview"
                  className="rounded-xl border border-red-400/35 bg-red-500 px-6 py-3 font-semibold text-white shadow-[0_14px_34px_rgba(239,68,68,0.28)] transition hover:-translate-y-0.5 hover:bg-red-400"
                >
                  {t.openDashboard}
                </Link>
                <a
                  href="https://github.com/edies76/agent-locker"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded-xl border border-zinc-500/80 bg-zinc-800 px-6 py-3 font-semibold text-zinc-100 transition hover:-translate-y-0.5 hover:border-red-400/50 hover:bg-zinc-700"
                >
                  {t.viewGithub}
                </a>
              </div>
            </div>

            <div className="relative mx-auto w-full max-w-md">
              <div className="absolute -inset-1 animate-[pulse_7s_ease-in-out_infinite] rounded-3xl bg-gradient-to-br from-red-500/35 via-transparent to-zinc-300/20 blur-xl" />
              <div className="relative rounded-3xl border border-zinc-600/80 bg-zinc-900/85 p-6">
                <div className="space-y-5">
                  <div className="flex items-center justify-between border-b border-zinc-700/70 pb-3">
                    <span className="text-xs uppercase tracking-wider text-zinc-400">Approval model</span>
                    <span className="rounded-full border border-red-400/40 bg-red-500/15 px-2.5 py-1 text-xs text-red-300">
                      ACTIVE
                    </span>
                  </div>
                  <div className="space-y-3">
                    <div className="rounded-lg border border-zinc-700/70 bg-zinc-800/60 px-3 py-2 text-sm text-zinc-200">
                      Intent + Risk validation
                    </div>
                    <div className="rounded-lg border border-zinc-700/70 bg-zinc-800/60 px-3 py-2 text-sm text-zinc-200">
                      Scoped provider controls
                    </div>
                    <div className="rounded-lg border border-zinc-700/70 bg-zinc-800/60 px-3 py-2 text-sm text-zinc-200">
                      MCP, Plugin, Backend governance
                    </div>
                  </div>
                  <div className="rounded-xl border border-red-500/35 bg-red-500/10 px-4 py-3 text-sm text-red-200">
                    Real-time approvals and policy decisions in one operator surface.
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="mt-14">
          <h2 className="text-2xl font-bold text-zinc-100">{t.sections.whatIs}</h2>
          <SectionStream items={t.cards.whatIs} />
        </section>

        <section className="mt-14">
          <h2 className="text-2xl font-bold text-zinc-100">{t.sections.usage}</h2>
          <SectionStream items={t.cards.usage} />
        </section>

        <section className="mt-14">
          <h2 className="text-2xl font-bold text-zinc-100">{t.sections.integrations}</h2>
          <SectionStream items={t.cards.integrations} />
        </section>

        <section className="mt-14">
          <h2 className="text-2xl font-bold text-zinc-100">{t.sections.howToUse}</h2>
          <SectionStream items={t.cards.howToUse} />
        </section>
      </main>

      <footer className="border-t border-zinc-700/70 bg-zinc-900/70">
        <div className="mx-auto max-w-7xl px-6 py-6 text-sm text-zinc-400">{t.footer}</div>
      </footer>
    </div>
  )
}

