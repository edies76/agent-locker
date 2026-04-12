export default function LearnOperationsPage() {
  return (
    <section className="space-y-4">
      <article className="rounded-2xl border border-white/10 bg-black/35 p-5 backdrop-blur-xl sm:p-6">
        <h2 className="mb-3 text-2xl font-semibold text-white">Operations and scope model</h2>
        <p className="text-gray-300">
          Agent-Lock now uses shared global controls only where necessary and isolates user runtime context elsewhere. This keeps platform policy centralized while protecting per-user operational data.
        </p>
      </article>

      <div className="grid gap-4 md:grid-cols-2">
        <article className="rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur-xl">
          <h3 className="mb-2 font-semibold text-white">Global surfaces</h3>
          <ul className="list-disc space-y-1 pl-5 text-sm text-gray-300">
            <li>Auth provider integration and token-vault backend capability.</li>
            <li>Shared Gemini service key used by platform AI functions.</li>
            <li>Cloud governance backend endpoint and core policy engine.</li>
          </ul>
        </article>

        <article className="rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur-xl">
          <h3 className="mb-2 font-semibold text-white">User-scoped surfaces</h3>
          <ul className="list-disc space-y-1 pl-5 text-sm text-gray-300">
            <li>MCP targets, heartbeats, and diagnostics by user and gateway identity.</li>
            <li>User settings values that should not leak across accounts.</li>
            <li>Session/channel data tied to user ID and gateway token.</li>
          </ul>
        </article>
      </div>

      <article className="rounded-2xl border border-white/10 bg-white/5 p-5 backdrop-blur-xl">
        <h3 className="mb-2 font-semibold text-white">Daily checks in dashboard</h3>
        <ul className="list-disc space-y-1 pl-5 text-sm text-gray-300">
          <li><strong>MCP page:</strong> verify gateway is connected and server statuses are current.</li>
          <li><strong>Activity/Logs:</strong> verify decisions include risk and execution metadata.</li>
          <li><strong>Settings:</strong> confirm account identity and scoped values are correct.</li>
        </ul>
      </article>

      <article className="rounded-2xl border border-violet-400/30 bg-violet-500/10 p-5">
        <h3 className="mb-2 font-semibold text-violet-200">Escalation signal</h3>
        <p className="text-sm text-violet-100/90">
          If MCP status and Activity diverge for the same user, treat it as an identity-scoping issue first (user ID / gateway token mismatch) before debugging tool servers.
        </p>
      </article>
    </section>
  )
}
