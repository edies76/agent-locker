export default function LearnProblemPage() {
  return (
    <section className="space-y-4">
      <article className="rounded-2xl border border-white/10 bg-black/35 p-5 backdrop-blur-xl sm:p-6">
        <h2 className="mb-3 text-2xl font-semibold text-white">Problem Agent-Lock solves</h2>
        <p className="text-gray-300">
          AI agents can issue powerful tool calls quickly, but speed without controls creates destructive risk. A single unintended command can delete data, modify production systems, or leak sensitive context.
        </p>
      </article>

      <article className="rounded-2xl border border-white/10 bg-white/5 p-5 backdrop-blur-xl">
        <h3 className="mb-2 font-semibold text-white">Core risks without governance</h3>
        <ul className="list-disc space-y-1 pl-5 text-sm text-gray-300">
          <li>Unsafe commands executing automatically without human confirmation.</li>
          <li>No clear accountability when an action is triggered by an agent chain.</li>
          <li>Weak visibility into why a decision was made and who approved it.</li>
        </ul>
      </article>

      <article className="rounded-2xl border border-white/10 bg-white/5 p-5 backdrop-blur-xl">
        <h3 className="mb-2 font-semibold text-white">Agent-Lock response</h3>
        <p className="text-sm text-gray-300">
          Agent-Lock enforces a fail-closed policy model: low-risk calls may pass automatically, while high-risk calls are paused until explicit approval. Every decision is logged for audit and policy tuning.
        </p>
      </article>

      <article className="rounded-2xl border border-amber-400/30 bg-amber-500/10 p-5">
        <h3 className="mb-2 font-semibold text-amber-200">What changes operationally</h3>
        <p className="text-sm text-amber-100/90">
          Instead of trusting intent blindly, execution becomes a governed pipeline: classify, decide, log, and only then execute. This is the key shift from AI convenience to AI reliability.
        </p>
      </article>
    </section>
  )
}
