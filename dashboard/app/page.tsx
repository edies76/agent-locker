"use client"

import Link from "next/link"
import { Space_Grotesk, Source_Sans_3 } from "next/font/google"
import { useMemo, useState } from "react"

const displayFont = Space_Grotesk({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
})

const bodyFont = Source_Sans_3({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
})

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
        {
          title: "4) Use dashboard channel chat",
          desc: "Open Channel Chat in dashboard, send a request to OpenClaw, then verify approval and logs for full traceability.",
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
    openDashboard: "Abrir Dashboard",
    viewGithub: "Ver en GitHub",
    sections: {
      whatIs: "Que es Agent-Lock?",
      usage: "Como se usa Agent-Lock",
      integrations: "Superficies de integracion",
      howToUse: "Como usarlo",
    },
    cards: {
      whatIs: [
        {
          title: "Capa de enforcement de politicas",
          desc: "Se ubica entre agentes IA y herramientas para permitir, pausar o bloquear acciones segun politica y controles runtime.",
        },
        {
          title: "Aprobaciones con intencion",
          desc: "Combina validacion de intencion y niveles de riesgo (LOW/HIGH/CRITICAL) para pedir aprobacion cuando corresponde.",
        },
        {
          title: "Visibilidad operativa",
          desc: "Logs, actividad, aprobaciones y diagnosticos centralizados para operacion y gobierno.",
        },
      ],
      usage: [
        {
          title: "Para equipos de AI operations",
          desc: "Define guardrails, monitorea comportamiento y reduce ejecucion accidental o no autorizada.",
        },
        {
          title: "Para flujos orientados a seguridad",
          desc: "Usa aprobaciones manuales, reglas de politica e historial de auditoria cuando hay impacto productivo.",
        },
        {
          title: "Para stacks multi-herramienta",
          desc: "Aplica el mismo modelo de control en herramientas MCP, plugin y backend cloud/local.",
        },
      ],
      integrations: [
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
        {
          title: "4) Usa el chat del dashboard",
          desc: "Abre Channel Chat en dashboard, envia una solicitud a OpenClaw y valida aprobacion + logs para trazabilidad completa.",
        },
      ],
    },
    footer: "Agent-Lock | Gobierno y aprobaciones para ejecucion de herramientas IA",
  },
}

function StatChip({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-cyan-100 bg-cyan-50/70 px-3 py-2">
      <p className="text-[10px] uppercase tracking-[0.18em] text-cyan-700">{label}</p>
      <p className="text-sm font-semibold text-slate-900">{value}</p>
    </div>
  )
}

function SectionCards({
  items,
}: {
  items: Array<{ title: string; desc: string; code?: string }>
}) {
  return (
    <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {items.map((item, idx) => (
        <article
          key={item.title}
          className="reveal-up group relative overflow-hidden rounded-2xl border border-slate-200/90 bg-white p-5 shadow-[0_10px_28px_rgba(15,23,42,0.08)] transition duration-300 hover:-translate-y-1 hover:border-cyan-300 hover:shadow-[0_18px_40px_rgba(8,145,178,0.18)]"
          style={{ animationDelay: `${idx * 80}ms` }}
        >
          <span className="absolute -right-10 -top-10 h-28 w-28 rounded-full bg-gradient-to-br from-cyan-100 to-amber-100 opacity-90" />
          <p className="relative text-[11px] uppercase tracking-[0.16em] text-slate-500">Step {idx + 1}</p>
          <h3 className="relative mt-2 text-base font-semibold text-slate-900">{item.title}</h3>
          <p className="relative mt-2 text-sm leading-6 text-slate-600">{item.desc}</p>
          {item.code ? (
            <pre className="relative mt-3 overflow-x-auto rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
              <code className="whitespace-pre-wrap text-xs text-slate-700">{item.code}</code>
            </pre>
          ) : null}
        </article>
      ))}
    </div>
  )
}

function SectionBlock({
  title,
  items,
}: {
  title: string
  items: Array<{ title: string; desc: string; code?: string }>
}) {
  return (
    <section className="mt-12 md:mt-14">
      <h2 className={`${displayFont.className} text-2xl font-semibold text-slate-900 md:text-3xl`}>{title}</h2>
      <SectionCards items={items} />
    </section>
  )
}

export default function LandingPage() {
  const [locale, setLocale] = useState<Locale>("en")
  const t = useMemo(() => COPY[locale], [locale])

  return (
    <div className={`${bodyFont.className} relative min-h-screen overflow-hidden bg-[#f4f7fb] text-slate-900`}>
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_10%_10%,_rgba(8,145,178,0.22),_transparent_35%),radial-gradient(circle_at_88%_14%,_rgba(245,158,11,0.15),_transparent_34%),radial-gradient(circle_at_52%_92%,_rgba(14,116,144,0.12),_transparent_48%)]" />
      <div className="pointer-events-none absolute -left-16 top-8 h-72 w-72 rounded-full bg-cyan-200/45 blur-3xl" />
      <div className="pointer-events-none absolute -right-10 top-0 h-80 w-80 rounded-full bg-amber-200/40 blur-3xl" />

      <header className="sticky top-0 z-40 border-b border-slate-200/70 bg-white/82 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 md:px-6">
          <div>
            <p className="text-[11px] uppercase tracking-[0.22em] text-slate-500">{t.badge}</p>
            <h1 className={`${displayFont.className} text-xl font-semibold text-slate-900`}>{t.subtitle}</h1>
          </div>

          <div className="flex items-center gap-2 md:gap-3">
            <div className="inline-flex overflow-hidden rounded-lg border border-slate-300 bg-white shadow-sm">
              <button
                type="button"
                onClick={() => setLocale("en")}
                className={`px-3 py-1.5 text-sm transition ${
                  locale === "en"
                    ? "bg-slate-900 text-white"
                    : "bg-transparent text-slate-700 hover:bg-slate-100"
                }`}
              >
                EN
              </button>
              <button
                type="button"
                onClick={() => setLocale("es")}
                className={`px-3 py-1.5 text-sm transition ${
                  locale === "es"
                    ? "bg-slate-900 text-white"
                    : "bg-transparent text-slate-700 hover:bg-slate-100"
                }`}
              >
                ES
              </button>
            </div>

            <Link
              href="/dashboard/overview"
              className="rounded-lg border border-cyan-700 bg-cyan-700 px-3 py-2 text-sm font-semibold text-white transition hover:-translate-y-0.5 hover:bg-cyan-600 md:px-4"
            >
              {t.openDashboard}
            </Link>
          </div>
        </div>
      </header>

      <main className="relative mx-auto max-w-7xl px-4 pb-16 pt-8 md:px-6 md:pt-12">
        <section className="relative overflow-hidden rounded-3xl border border-slate-200 bg-white/92 p-6 shadow-[0_18px_48px_rgba(15,23,42,0.10)] md:p-10">
          <div className="hero-glow pointer-events-none absolute -right-16 top-0 h-56 w-56 rounded-full bg-cyan-100/70 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-12 left-8 h-44 w-44 rounded-full bg-amber-100/70 blur-3xl" />

          <div className="grid gap-10 lg:grid-cols-[minmax(0,1.12fr)_minmax(0,0.88fr)] lg:items-center">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-cyan-700">{t.badge}</p>
              <h2 className={`${displayFont.className} mt-3 max-w-4xl text-4xl font-semibold leading-[1.05] text-slate-900 md:text-7xl`}>
                {t.heroTitle}{" "}
                <span className="bg-gradient-to-r from-cyan-700 via-sky-600 to-amber-600 bg-clip-text text-transparent">
                  {t.heroTitleAccent}
                </span>
              </h2>
              <p className="mt-5 max-w-3xl text-lg leading-8 text-slate-700">{t.heroDescription}</p>

              <div className="mt-4 flex flex-wrap gap-2 text-xs font-medium">
                <span className="rounded-full border border-cyan-200 bg-cyan-50 px-3 py-1 text-cyan-800">Realtime governance</span>
                <span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-emerald-800">Policy + approval engine</span>
                <span className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-amber-800">Scoped token execution</span>
              </div>

              <div className="mt-8 flex flex-wrap gap-3">
                <Link
                  href="/dashboard/overview"
                  className="rounded-xl border border-cyan-700 bg-gradient-to-r from-cyan-700 to-sky-700 px-6 py-3 font-semibold text-white shadow-[0_10px_28px_rgba(14,116,144,0.24)] transition hover:-translate-y-0.5 hover:from-cyan-600 hover:to-sky-600"
                >
                  {t.openDashboard}
                </Link>
                <a
                  href="https://github.com/edies76/agent-locker"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded-xl border border-slate-300 bg-white px-6 py-3 font-semibold text-slate-800 transition hover:-translate-y-0.5 hover:border-amber-300 hover:text-amber-700"
                >
                  {t.viewGithub}
                </a>
              </div>
            </div>

            <div className="relative mx-auto w-full max-w-md reveal-up" style={{ animationDelay: "120ms" }}>
              <div className="absolute -inset-1 rounded-3xl bg-gradient-to-br from-cyan-300/55 via-transparent to-amber-200/45 blur-xl" />
              <div className="relative rounded-3xl border border-slate-200 bg-white p-6 shadow-[0_20px_44px_rgba(15,23,42,0.12)]">
                <div className="space-y-4">
                  <div className="flex items-center justify-between border-b border-slate-200 pb-3">
                    <span className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Approval model</span>
                    <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">
                      ACTIVE
                    </span>
                  </div>

                  <div className="space-y-2">
                    <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
                      Intent + risk validation
                    </div>
                    <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
                      Scoped provider controls
                    </div>
                    <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
                      MCP, Plugin, Backend governance
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-2">
                    <StatChip label="Policy" value="Enforced" />
                    <StatChip label="Approvals" value="Realtime" />
                    <StatChip label="Audit" value="Complete" />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <SectionBlock title={t.sections.whatIs} items={t.cards.whatIs} />
        <SectionBlock title={t.sections.usage} items={t.cards.usage} />
        <SectionBlock title={t.sections.integrations} items={t.cards.integrations} />
        <SectionBlock title={t.sections.howToUse} items={t.cards.howToUse} />

        <section className="mt-12 rounded-3xl border border-slate-200 bg-white/92 p-6 shadow-[0_12px_34px_rgba(15,23,42,0.08)] md:mt-14 md:p-8">
          <h2 className={`${displayFont.className} text-2xl font-semibold text-slate-900`}>Connected account and provider logins</h2>
          <p className="mt-3 max-w-4xl text-sm leading-7 text-slate-700">
            Agent-Lock supports two login layers directly from dashboard flow: account login for the operator session, and
            provider logins (Google, GitHub, Slack) for tool-scoped access using Auth0 Token Vault.
          </p>

          <div className="mt-5 grid gap-3 md:grid-cols-3">
            {[
              {
                title: "1) Account login",
                desc: "Create authenticated dashboard session before connecting providers.",
              },
              {
                title: "2) Provider login",
                desc: "Connect Google/GitHub/Slack as secondary provider identities.",
              },
              {
                title: "3) Governed tool use",
                desc: "Issue short-lived scoped tokens only after policy and approval checks.",
              },
            ].map((item) => (
              <article
                key={item.title}
                className="rounded-xl border border-slate-200 bg-slate-50 p-4 transition hover:-translate-y-0.5 hover:border-cyan-300"
              >
                <h3 className="text-sm font-semibold text-slate-900">{item.title}</h3>
                <p className="mt-1 text-sm leading-6 text-slate-700">{item.desc}</p>
              </article>
            ))}
          </div>

          <div className="mt-5 flex flex-wrap gap-3">
            <Link
              href="/dashboard/settings"
              className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-800 transition hover:border-cyan-300 hover:text-cyan-800"
            >
              Open settings
            </Link>
            <Link
              href="/dashboard/chat"
              className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-800 transition hover:border-cyan-300 hover:text-cyan-800"
            >
              Open channel chat
            </Link>
            <Link
              href="/dashboard/scopes"
              className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-800 transition hover:border-cyan-300 hover:text-cyan-800"
            >
              Provider scopes
            </Link>
          </div>
        </section>

        <section className="mt-12 rounded-3xl border border-slate-200 bg-white/92 p-6 shadow-[0_12px_34px_rgba(15,23,42,0.08)] md:mt-14 md:p-8">
          <h2 className={`${displayFont.className} text-2xl font-semibold text-slate-900`}>Architecture snapshot</h2>
          <p className="mt-3 text-sm leading-7 text-slate-700">
            Homepage summary of the production flow: AI client -&gt; Agent-Lock policy gate -&gt; risk + intent analysis
            -&gt; auto-approve or manual Telegram approval -&gt; scoped execution with full audit trail.
          </p>
          <div className="mt-5 overflow-x-auto rounded-xl border border-slate-200 bg-slate-950 p-4">
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

      <footer className="border-t border-slate-200 bg-white/78">
        <div className="mx-auto max-w-7xl px-4 py-6 text-sm text-slate-600 md:px-6">{t.footer}</div>
      </footer>

      <style jsx global>{`
        @keyframes landingFadeUp {
          from {
            opacity: 0;
            transform: translateY(10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        @keyframes landingPulse {
          0%,
          100% {
            transform: scale(1);
            opacity: 0.65;
          }
          50% {
            transform: scale(1.05);
            opacity: 0.9;
          }
        }

        .reveal-up {
          opacity: 0;
          animation: landingFadeUp 620ms ease-out forwards;
        }

        .hero-glow {
          animation: landingPulse 9s ease-in-out infinite;
        }
      `}</style>
    </div>
  )
}
