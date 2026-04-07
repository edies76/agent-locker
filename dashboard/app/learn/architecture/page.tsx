export default function LearnArchitecturePage() {
  return (
    <section className="space-y-4">
      <article className="card p-5 sm:p-6">
        <h2 className="mb-3 text-2xl font-semibold">Architecture overview</h2>
        <p className="text-[var(--text-secondary)]">
          Agent-Lock separates local execution from centralized governance. The local gateway/plugin handles interception close to tools, while the cloud backend applies policy, auth, and auditing.
        </p>
      </article>

      <div className="grid gap-4 md:grid-cols-2">
        <article className="card p-4">
          <h3 className="mb-2 font-semibold">Local layer</h3>
          <p className="text-sm text-[var(--text-secondary)]">MCP gateway and plugin intercept tool calls, attach identity context, and request a decision before execution.</p>
        </article>
        <article className="card p-4">
          <h3 className="mb-2 font-semibold">Backend layer</h3>
          <p className="text-sm text-[var(--text-secondary)]">FastAPI service evaluates risk, handles approval state, supports token vault flows, and records immutable audit events.</p>
        </article>
      </div>

      <article className="card p-5">
        <h3 className="mb-2 font-semibold">Decision flow</h3>
        <pre className="overflow-x-auto rounded-md border border-[var(--border-primary)] bg-[var(--bg-primary)] p-3 text-xs text-[var(--text-secondary)]">{`Agent -> Gateway/Plugin -> Policy Backend
                           -> LOW => Execute
                           -> HIGH/CRITICAL => Pending approval
                           -> Decision => Execute or Block
                           -> Audit log written`}</pre>
      </article>
    </section>
  )
}
