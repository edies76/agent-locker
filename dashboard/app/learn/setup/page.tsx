export default function LearnSetupPage() {
  return (
    <section className="space-y-4">
      <article className="rounded-2xl border border-white/10 bg-black/35 p-5 backdrop-blur-xl sm:p-6">
        <h2 className="mb-3 text-2xl font-semibold text-white">Setup sequence</h2>
        <p className="text-gray-300">
          Follow this order to avoid most integration failures: backend readiness, runtime install, identity setup, and then a safe test call before any high-risk action.
        </p>
      </article>

      <article className="rounded-2xl border border-white/10 bg-white/5 p-5 backdrop-blur-xl">
        <h3 className="mb-2 font-semibold text-white">Recommended order</h3>
        <ol className="list-decimal space-y-1 pl-5 text-sm text-gray-300">
          <li>Confirm backend health endpoint responds.</li>
          <li>Install one integration mode (MCP gateway or plugin) first.</li>
          <li>Configure required environment values (Auth0, Telegram, Gemini, backend URL).</li>
          <li>Run one read-only tool call and confirm it appears in dashboard activity.</li>
          <li>Run one high-risk sample and confirm approval workflow works end to end.</li>
        </ol>
      </article>

      <article className="rounded-2xl border border-white/10 bg-white/5 p-5 backdrop-blur-xl">
        <h3 className="mb-2 font-semibold text-white">Quick install options</h3>
        <p className="text-sm text-gray-300">
          For teams on Windows, use the one-click installers under <code>installers/</code>. For advanced control, use the npm package <code>@agentlock/mcp-server</code> and plugin CLI commands.
        </p>
      </article>

      <article className="rounded-2xl border border-emerald-400/30 bg-emerald-500/10 p-5">
        <h3 className="mb-2 font-semibold text-emerald-200">First successful run checklist</h3>
        <ul className="list-disc space-y-1 pl-5 text-sm text-emerald-100/90">
          <li>Dashboard shows incoming low-risk action in Activity.</li>
          <li>Approvals page receives at least one high-risk pending action.</li>
          <li>MCP monitor reflects gateway connected and server statuses.</li>
        </ul>
      </article>
    </section>
  )
}
