export default function LearnOperationsPage() {
  return (
    <section className="space-y-4">
      <article className="card p-5 sm:p-6">
        <h2 className="mb-3 text-2xl font-semibold">Operations and scope model</h2>
        <p className="text-[var(--text-secondary)]">
          Agent-Lock now uses shared global controls only where necessary and isolates user runtime context elsewhere. This keeps platform policy centralized while protecting per-user operational data.
        </p>
      </article>

      <div className="grid gap-4 md:grid-cols-2">
        <article className="card p-4">
          <h3 className="mb-2 font-semibold">Global surfaces</h3>
          <ul className="list-disc space-y-1 pl-5 text-sm text-[var(--text-secondary)]">
            <li>Auth provider integration and token-vault backend capability.</li>
            <li>Shared Gemini service key used by platform AI functions.</li>
            <li>Cloud governance backend endpoint and core policy engine.</li>
          </ul>
        </article>

        <article className="card p-4">
          <h3 className="mb-2 font-semibold">User-scoped surfaces</h3>
          <ul className="list-disc space-y-1 pl-5 text-sm text-[var(--text-secondary)]">
            <li>MCP targets, heartbeats, and diagnostics by user and gateway identity.</li>
            <li>User settings values that should not leak across accounts.</li>
            <li>Session/channel data tied to user ID and gateway token.</li>
          </ul>
        </article>
      </div>

      <article className="card p-5">
        <h3 className="mb-2 font-semibold">Daily checks in dashboard</h3>
        <ul className="list-disc space-y-1 pl-5 text-sm text-[var(--text-secondary)]">
          <li><strong>MCP page:</strong> verify gateway is connected and server statuses are current.</li>
          <li><strong>Activity/Logs:</strong> verify decisions include risk and execution metadata.</li>
          <li><strong>Settings:</strong> confirm account identity and scoped values are correct.</li>
        </ul>
      </article>
    </section>
  )
}
