export default function LearnArchitecturePage() {
  return (
    <section className="space-y-4">
      <article className="rounded-2xl border border-white/10 bg-black/35 p-5 backdrop-blur-xl sm:p-6">
        <h2 className="mb-3 text-2xl font-semibold text-white">Architecture overview</h2>
        <p className="text-gray-300">
          Agent-Lock separates local execution from centralized governance. The local gateway/plugin handles interception close to tools, while the cloud backend applies policy, auth, and auditing.
        </p>
      </article>

      <div className="grid gap-4 md:grid-cols-2">
        <article className="rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur-xl">
          <h3 className="mb-2 font-semibold text-white">Local layer</h3>
          <p className="text-sm text-gray-300">MCP gateway and plugin intercept tool calls, attach identity context, and request a decision before execution.</p>
        </article>
        <article className="rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur-xl">
          <h3 className="mb-2 font-semibold text-white">Backend layer</h3>
          <p className="text-sm text-gray-300">FastAPI service evaluates risk, handles approval state, supports token vault flows, and records immutable audit events.</p>
        </article>
      </div>

      <article className="rounded-2xl border border-white/10 bg-white/5 p-5 backdrop-blur-xl">
        <h3 className="mb-2 font-semibold text-white">Decision flow</h3>
        <pre className="overflow-x-auto rounded-md border border-white/10 bg-black/35 p-3 text-xs text-gray-300">{`Agent -> Gateway/Plugin -> Policy Backend
                           -> LOW => Execute
                           -> HIGH/CRITICAL => Pending approval
                           -> Decision => Execute or Block
                           -> Audit log written`}</pre>
      </article>

      <article className="rounded-2xl border border-blue-400/30 bg-blue-500/10 p-5">
        <h3 className="mb-2 font-semibold text-blue-200">Boundary principle</h3>
        <p className="text-sm text-blue-100/90">
          Interception happens close to tools, while governance logic stays centralized. This allows local tool access without sacrificing global policy consistency.
        </p>
      </article>
    </section>
  )
}
