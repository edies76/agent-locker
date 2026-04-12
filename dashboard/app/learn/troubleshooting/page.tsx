export default function LearnTroubleshootingPage() {
  return (
    <section className="space-y-4">
      <article className="rounded-2xl border border-white/10 bg-black/35 p-5 backdrop-blur-xl sm:p-6">
        <h2 className="mb-3 text-2xl font-semibold text-white">Troubleshooting guide</h2>
        <p className="text-gray-300">
          Use these quick checks before deeper debugging. Most failures come from identity mismatch, stale runtime, or misconfigured integration endpoints.
        </p>
      </article>

      <article className="rounded-2xl border border-white/10 bg-white/5 p-5 backdrop-blur-xl">
        <h3 className="mb-2 font-semibold text-white">Common issues</h3>
        <ul className="list-disc space-y-1 pl-5 text-sm text-gray-300">
          <li>Gateway appears disconnected in cloud because user ID or gateway token does not match current session scope.</li>
          <li>No MCP execution logs because no calls reached execution stage yet, even if heartbeat is active.</li>
          <li>Telegram approval conflicts when two services poll with the same bot token.</li>
          <li>Dashboard runtime mismatch after deploy due to stale build artifact.</li>
        </ul>
      </article>

      <article className="rounded-2xl border border-white/10 bg-white/5 p-5 backdrop-blur-xl">
        <h3 className="mb-2 font-semibold text-white">First-response checklist</h3>
        <ol className="list-decimal space-y-1 pl-5 text-sm text-gray-300">
          <li>Confirm backend health and active deployment slot/runtime.</li>
          <li>Confirm dashboard and gateway use the same backend URL.</li>
          <li>Re-check account identity, gateway token, and user-scoped MCP config.</li>
          <li>Trigger one low-risk call and verify it appears in activity and MCP diagnostics.</li>
        </ol>
      </article>

      <article className="rounded-2xl border border-red-400/30 bg-red-500/10 p-5">
        <h3 className="mb-2 font-semibold text-red-200">When to treat as incident</h3>
        <p className="text-sm text-red-100/90">
          If high-risk actions are executing without approval or audit events stop recording, escalate immediately and freeze automated execution until policy flow is restored.
        </p>
      </article>
    </section>
  )
}
