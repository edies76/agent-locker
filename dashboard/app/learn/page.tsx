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
      <article className="rounded-2xl border border-white/10 bg-black/35 p-5 backdrop-blur-xl sm:p-6">
        <p className="mb-2 text-xs uppercase tracking-[0.16em] text-gray-300">Central route</p>
        <h2 className="mb-3 text-3xl font-semibold text-white">Agent-Lock AI knowledge center</h2>
        <p className="max-w-4xl text-gray-300">
          Agent-Lock is a security middleware for AI agents. It guards tool execution through policy rules, risk checks, human approvals, and full audit logging so high-impact actions never run unnoticed.
        </p>
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <div className="rounded-xl border border-white/10 bg-white/5 p-3">
            <p className="text-xs uppercase tracking-wide text-gray-400">Execution mode</p>
            <p className="mt-1 text-sm font-medium text-white">Fail-closed by default</p>
          </div>
          <div className="rounded-xl border border-white/10 bg-white/5 p-3">
            <p className="text-xs uppercase tracking-wide text-gray-400">Approval path</p>
            <p className="mt-1 text-sm font-medium text-white">Human-in-the-loop</p>
          </div>
          <div className="rounded-xl border border-white/10 bg-white/5 p-3">
            <p className="text-xs uppercase tracking-wide text-gray-400">Traceability</p>
            <p className="mt-1 text-sm font-medium text-white">Structured audit logs</p>
          </div>
        </div>
      </article>

      <div className="grid gap-4 md:grid-cols-3">
        {tracks.map((item) => (
          <article key={item.title} className="rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur-xl">
            <h3 className="mb-2 font-semibold text-white">{item.title}</h3>
            <p className="text-sm text-gray-300">{item.body}</p>
          </article>
        ))}
      </div>

      <article className="rounded-2xl border border-white/10 bg-black/35 p-5 backdrop-blur-xl">
        <h3 className="mb-3 text-lg font-semibold text-white">Read by topic</h3>
        <div className="grid gap-2 sm:grid-cols-2">
          <Link href="/learn/problem" className="block rounded-xl border border-white/10 bg-white/5 p-3 transition hover:bg-white/10">
            <p className="font-medium text-white">Problem statement</p>
            <p className="text-sm text-gray-300">Why this middleware exists and which risks it mitigates.</p>
          </Link>
          <Link href="/learn/architecture" className="block rounded-xl border border-white/10 bg-white/5 p-3 transition hover:bg-white/10">
            <p className="font-medium text-white">Architecture</p>
            <p className="text-sm text-gray-300">Gateway, backend, plugin, and data boundaries.</p>
          </Link>
          <Link href="/learn/setup" className="block rounded-xl border border-white/10 bg-white/5 p-3 transition hover:bg-white/10">
            <p className="font-medium text-white">Setup</p>
            <p className="text-sm text-gray-300">Prerequisites and first successful local/cloud run.</p>
          </Link>
          <Link href="/learn/operations" className="block rounded-xl border border-white/10 bg-white/5 p-3 transition hover:bg-white/10">
            <p className="font-medium text-white">Operations</p>
            <p className="text-sm text-gray-300">What to monitor daily and what is global vs user-scoped.</p>
          </Link>
          <Link href="/learn/troubleshooting" className="block rounded-xl border border-white/10 bg-white/5 p-3 transition hover:bg-white/10 sm:col-span-2">
            <p className="font-medium text-white">Troubleshooting</p>
            <p className="text-sm text-gray-300">Fast checks for MCP, backend, auth, and deployment issues.</p>
          </Link>
        </div>
      </article>

      <article className="rounded-2xl border border-white/10 bg-white/5 p-5 backdrop-blur-xl">
        <h3 className="mb-3 text-lg font-semibold text-white">Quick comparison</h3>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="text-left text-gray-400">
                <th className="pb-2 pr-4">Capability</th>
                <th className="pb-2 pr-4">Without Agent-Lock</th>
                <th className="pb-2">With Agent-Lock</th>
              </tr>
            </thead>
            <tbody className="text-gray-300">
              <tr className="border-t border-white/10">
                <td className="py-2 pr-4">Risk gate</td>
                <td className="py-2 pr-4">Best effort</td>
                <td className="py-2">Policy + AI + fail-closed</td>
              </tr>
              <tr className="border-t border-white/10">
                <td className="py-2 pr-4">Human approval</td>
                <td className="py-2 pr-4">Manual, out of band</td>
                <td className="py-2">Integrated decision flow</td>
              </tr>
              <tr className="border-t border-white/10">
                <td className="py-2 pr-4">Audit trail</td>
                <td className="py-2 pr-4">Partial</td>
                <td className="py-2">Structured end-to-end logs</td>
              </tr>
            </tbody>
          </table>
        </div>
      </article>
    </section>
  )
}
