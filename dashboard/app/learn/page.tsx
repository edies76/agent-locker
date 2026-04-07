import Link from "next/link"

const tracks = [
  {
    title: "Integration modes",
    body: "Run Agent-Lock as an MCP gateway for Claude/Desktop clients, as an OpenClaw plugin, or both in parallel with the same governance backend.",
  },
  {
    title: "Governance flow",
    body: "Every tool call is intercepted, classified, and either auto-approved or paused for approval. Timeouts fail closed by design.",
  },
  {
    title: "Production topology",
    body: "The dashboard and local runtimes connect to the centralized Azure backend policy engine while user-scoped data remains isolated.",
  },
]

export default function LearnIndexPage() {
  return (
    <section className="space-y-6">
      <article className="card p-5 sm:p-6">
        <p className="mb-2 text-xs uppercase tracking-[0.16em] text-[var(--text-tertiary)]">Central route</p>
        <h2 className="mb-3 text-3xl font-semibold">Agent-Lock AI knowledge center</h2>
        <p className="max-w-4xl text-[var(--text-secondary)]">
          Agent-Lock is a security middleware for AI agents. It guards tool execution through policy rules, risk checks, human approvals, and full audit logging so high-impact actions never run unnoticed.
        </p>
      </article>

      <div className="grid gap-4 md:grid-cols-3">
        {tracks.map((item) => (
          <article key={item.title} className="card p-4">
            <h3 className="mb-2 font-semibold">{item.title}</h3>
            <p className="text-sm text-[var(--text-secondary)]">{item.body}</p>
          </article>
        ))}
      </div>

      <article className="card p-5">
        <h3 className="mb-3 text-lg font-semibold">Read by topic</h3>
        <div className="grid gap-2 sm:grid-cols-2">
          <Link href="/learn/problem" className="card card-interactive block p-3">
            <p className="font-medium">Problem statement</p>
            <p className="text-sm text-[var(--text-secondary)]">Why this middleware exists and which risks it mitigates.</p>
          </Link>
          <Link href="/learn/architecture" className="card card-interactive block p-3">
            <p className="font-medium">Architecture</p>
            <p className="text-sm text-[var(--text-secondary)]">Gateway, backend, plugin, and data boundaries.</p>
          </Link>
          <Link href="/learn/setup" className="card card-interactive block p-3">
            <p className="font-medium">Setup</p>
            <p className="text-sm text-[var(--text-secondary)]">Prerequisites and first successful local/cloud run.</p>
          </Link>
          <Link href="/learn/operations" className="card card-interactive block p-3">
            <p className="font-medium">Operations</p>
            <p className="text-sm text-[var(--text-secondary)]">What to monitor daily and what is global vs user-scoped.</p>
          </Link>
          <Link href="/learn/troubleshooting" className="card card-interactive block p-3 sm:col-span-2">
            <p className="font-medium">Troubleshooting</p>
            <p className="text-sm text-[var(--text-secondary)]">Fast checks for MCP, backend, auth, and deployment issues.</p>
          </Link>
        </div>
      </article>
    </section>
  )
}
