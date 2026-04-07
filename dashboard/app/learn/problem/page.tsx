export default function LearnProblemPage() {
  return (
    <section className="space-y-4">
      <article className="card p-5 sm:p-6">
        <h2 className="mb-3 text-2xl font-semibold">Problem Agent-Lock solves</h2>
        <p className="text-[var(--text-secondary)]">
          AI agents can issue powerful tool calls quickly, but speed without controls creates destructive risk. A single unintended command can delete data, modify production systems, or leak sensitive context.
        </p>
      </article>

      <article className="card p-5">
        <h3 className="mb-2 font-semibold">Core risks without governance</h3>
        <ul className="list-disc space-y-1 pl-5 text-sm text-[var(--text-secondary)]">
          <li>Unsafe commands executing automatically without human confirmation.</li>
          <li>No clear accountability when an action is triggered by an agent chain.</li>
          <li>Weak visibility into why a decision was made and who approved it.</li>
        </ul>
      </article>

      <article className="card p-5">
        <h3 className="mb-2 font-semibold">Agent-Lock response</h3>
        <p className="text-sm text-[var(--text-secondary)]">
          Agent-Lock enforces a fail-closed policy model: low-risk calls may pass automatically, while high-risk calls are paused until explicit approval. Every decision is logged for audit and policy tuning.
        </p>
      </article>
    </section>
  )
}
