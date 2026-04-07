export default function LearnSetupPage() {
  return (
    <section className="space-y-4">
      <article className="card p-5 sm:p-6">
        <h2 className="mb-3 text-2xl font-semibold">Setup sequence</h2>
        <p className="text-[var(--text-secondary)]">
          Follow this order to avoid most integration failures: backend readiness, runtime install, identity setup, and then a safe test call before any high-risk action.
        </p>
      </article>

      <article className="card p-5">
        <h3 className="mb-2 font-semibold">Recommended order</h3>
        <ol className="list-decimal space-y-1 pl-5 text-sm text-[var(--text-secondary)]">
          <li>Confirm backend health endpoint responds.</li>
          <li>Install one integration mode (MCP gateway or plugin) first.</li>
          <li>Configure required environment values (Auth0, Telegram, Gemini, backend URL).</li>
          <li>Run one read-only tool call and confirm it appears in dashboard activity.</li>
          <li>Run one high-risk sample and confirm approval workflow works end to end.</li>
        </ol>
      </article>

      <article className="card p-5">
        <h3 className="mb-2 font-semibold">Quick install options</h3>
        <p className="text-sm text-[var(--text-secondary)]">
          For teams on Windows, use the one-click installers under <code>installers/</code>. For advanced control, use the npm package <code>@agentlock/mcp-server</code> and plugin CLI commands.
        </p>
      </article>
    </section>
  )
}
