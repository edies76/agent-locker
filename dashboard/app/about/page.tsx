export default function AboutPage() {
  return (
    <div className="space-y-10 max-w-4xl">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white">About Agent-Lock</h1>
        <p className="text-slate-500 text-sm mt-0.5">
          Security middleware for AI agent tool call interception
        </p>
      </div>

      {/* What is Agent-Lock */}
      <section className="bg-brand-card border border-brand-border rounded-xl p-6 space-y-4">
        <h2 className="text-lg font-bold text-white flex items-center gap-2">
          🦞 What is Agent-Lock?
        </h2>
        <p className="text-slate-400 leading-relaxed">
          Agent-Lock is a security middleware layer that sits between AI agents (like Claude Desktop
          or ChatGPT via MCP) and the tools they can execute. Every tool call is intercepted,
          classified by risk level, and either automatically approved, sent for human review via
          Telegram, or blocked — before anything actually runs.
        </p>

        {/* ASCII-style pipeline flowchart */}
        <div className="bg-brand-bg border border-brand-border rounded-xl p-5 font-mono text-sm overflow-x-auto">
          <div className="flex flex-col items-center gap-0 min-w-[420px]">
            <div className="bg-indigo-900/40 border border-indigo-700/50 text-indigo-300 rounded-lg px-5 py-2.5 text-center w-64">
              🤖 AI Agent (Claude / ChatGPT)
            </div>
            <div className="text-slate-600 text-lg leading-none py-1">│</div>
            <div className="text-slate-500 text-xs">tool_call(name, args)</div>
            <div className="text-slate-600 text-lg leading-none py-1">▼</div>
            <div className="bg-red-900/40 border border-red-700/50 text-red-300 rounded-lg px-5 py-2.5 text-center w-64">
              🛑 Agent-Lock Intercepts
            </div>
            <div className="text-slate-600 text-lg leading-none py-1">│</div>
            <div className="text-slate-600 text-lg leading-none py-1">▼</div>
            <div className="bg-amber-900/40 border border-amber-700/50 text-amber-300 rounded-lg px-5 py-2.5 text-center w-64">
              ⚖️ Risk Classification
            </div>
            <div className="text-slate-600 text-lg leading-none py-1">│</div>
            <div className="flex items-start gap-6 w-full justify-center">
              <div className="flex flex-col items-center gap-1">
                <div className="text-slate-500 text-xs whitespace-nowrap">LOW risk</div>
                <div className="text-slate-600">▼</div>
                <div className="bg-emerald-900/40 border border-emerald-700/50 text-emerald-300 rounded-lg px-3 py-2 text-center text-xs w-36">
                  ✅ Auto-Execute<br />
                  <span className="text-emerald-500">+ Auth0 Token</span>
                </div>
              </div>
              <div className="flex flex-col items-center gap-1">
                <div className="text-slate-500 text-xs whitespace-nowrap">HIGH / CRITICAL</div>
                <div className="text-slate-600">▼</div>
                <div className="bg-red-900/40 border border-red-700/50 text-red-300 rounded-lg px-3 py-2 text-center text-xs w-36">
                  📱 Telegram Alert<br />
                  <span className="text-red-400">Wait for human</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Platform separation */}
      <section className="bg-brand-card border border-brand-border rounded-xl p-6 space-y-4">
        <h2 className="text-lg font-bold text-white flex items-center gap-2">
          🧩 Two Components, Two Responsibilities
        </h2>
        <p className="text-slate-400 text-sm leading-relaxed">
          Agent-Lock is intentionally split so external teams can adopt only what they need.
          The MCP Gateway and the OpenClaw Plugin are separate integration surfaces that both
          call the same backend governance API.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-brand-bg border border-brand-border rounded-xl p-4 space-y-2">
            <p className="text-sm font-bold text-indigo-300">MCP Gateway (mcp_server)</p>
            <ul className="space-y-1.5 text-xs text-slate-400">
              <li>• Used by Claude Desktop / ChatGPT MCP clients</li>
              <li>• Proxies target MCP tools with naming server__tool</li>
              <li>• Calls backend /intercept and /status for every tool call</li>
              <li>• Best for teams standardizing on MCP ecosystem</li>
            </ul>
          </div>

          <div className="bg-brand-bg border border-brand-border rounded-xl p-4 space-y-2">
            <p className="text-sm font-bold text-amber-300">OpenClaw Plugin (plugin/agent-lock-plugin)</p>
            <ul className="space-y-1.5 text-xs text-slate-400">
              <li>• Native interception inside OpenClaw runtime</li>
              <li>• Captures session intent and guards before_tool_call</li>
              <li>• Polls backend decisions and injects scoped auth token</li>
              <li>• Best for OpenClaw-first deployments</li>
            </ul>
          </div>
        </div>

        <div className="bg-brand-bg/40 border border-brand-border rounded-lg px-4 py-3">
          <p className="text-xs text-slate-400 leading-relaxed">
            Both paths share the same governance backend, policies, audit logs, Telegram approvals,
            and dashboard. This means one policy model and one audit trail across clients.
          </p>
        </div>
      </section>

      {/* Risk Classification Pipeline */}
      <section className="bg-brand-card border border-brand-border rounded-xl p-6 space-y-5">
        <h2 className="text-lg font-bold text-white flex items-center gap-2">
          ⚖️ Risk Classification Pipeline
        </h2>
        <p className="text-slate-400 text-sm leading-relaxed">
          Every intercepted tool call passes through a multi-stage analysis pipeline before a
          decision is made.
        </p>

        {/* Vertical stepper */}
        <div className="relative space-y-0">
          {/* Connecting line */}
          <div className="absolute left-5 top-6 bottom-6 w-px bg-brand-border" />

          {[
            {
              icon: "🔌",
              title: "AI Agent calls a tool",
              desc: "The agent (Claude Desktop, ChatGPT, etc.) invokes a tool like run_command, write_file, or query_database.",
              color: "border-indigo-700/50 bg-indigo-900/20",
              dot: "bg-indigo-500",
            },
            {
              icon: "🛑",
              title: "Agent-Lock intercepts",
              desc: "The middleware captures the call before execution. The HMAC signature is validated to ensure the request hasn't been tampered with.",
              color: "border-red-700/50 bg-red-900/10",
              dot: "bg-red-500",
            },
            {
              icon: "📋",
              title: "Static rules check",
              desc: "Pattern matching against known dangerous patterns: rm -rf, DROP TABLE, format C:, /etc/passwd access, and more. Fast, no API call needed.",
              color: "border-amber-700/50 bg-amber-900/10",
              dot: "bg-amber-500",
            },
            {
              icon: "🧠",
              title: "Gemini 2.0 Flash analysis",
              desc: "Only for HIGH and CRITICAL initial classifications. Gemini evaluates the semantic intent, potential blast radius, and assigns an intent score from 0–100.",
              color: "border-blue-700/50 bg-blue-900/10",
              dot: "bg-blue-500",
            },
            {
              icon: "⚖️",
              title: "Final risk verdict",
              desc: "Combining static rules and AI analysis, the final risk level is determined: LOW, HIGH, or CRITICAL.",
              color: "border-purple-700/50 bg-purple-900/10",
              dot: "bg-purple-500",
            },
          ].map((step, i) => (
            <div key={i} className="relative flex items-start gap-4 pb-4 last:pb-0">
              {/* Dot */}
              <div
                className={`relative z-10 flex-shrink-0 w-10 h-10 rounded-full border flex items-center justify-center text-lg ${step.color}`}
              >
                {step.icon}
              </div>
              {/* Content */}
              <div className={`flex-1 border rounded-xl px-4 py-3 mb-2 ${step.color}`}>
                <p className="text-sm font-semibold text-slate-200 mb-1">{step.title}</p>
                <p className="text-xs text-slate-400 leading-relaxed">{step.desc}</p>
              </div>
            </div>
          ))}

          {/* Outcome split */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2 pl-14">
            <div className="bg-emerald-900/20 border border-emerald-700/40 rounded-xl px-4 py-3">
              <p className="text-sm font-bold text-emerald-300 mb-1">
                6a. LOW ✅ Auto-execute
              </p>
              <p className="text-xs text-slate-400 leading-relaxed">
                Agent receives a scoped Auth0 token valid for 60 seconds with only the minimum
                permissions needed. The tool executes.
              </p>
            </div>
            <div className="bg-red-900/20 border border-red-700/40 rounded-xl px-4 py-3">
              <p className="text-sm font-bold text-red-300 mb-1">
                6b. HIGH / CRITICAL → 📱 Telegram
              </p>
              <p className="text-xs text-slate-400 leading-relaxed">
                A Telegram notification is sent with full details. Agent-Lock waits for your
                YES/NO response. If rejected or timed out, the action is blocked.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Auth0 Token Vault */}
      <section className="bg-brand-card border border-brand-border rounded-xl p-6 space-y-4">
        <h2 className="text-lg font-bold text-white flex items-center gap-2">
          🔐 What is the Auth0 Token Vault?
        </h2>
        <p className="text-slate-400 text-sm leading-relaxed">
          Traditional setups give AI agents permanent access to your API keys and credentials —
          a massive security risk. Agent-Lock uses Auth0 to issue short-lived, scoped tokens
          on-demand instead.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-red-900/20 border border-red-700/40 rounded-xl p-4 space-y-2">
            <p className="text-sm font-bold text-red-300">❌ Traditional approach</p>
            <ul className="space-y-1.5 text-xs text-slate-400">
              <li className="flex items-start gap-2">
                <span className="text-red-500 mt-0.5">✗</span>
                Agent stores your real API keys in memory or config files
              </li>
              <li className="flex items-start gap-2">
                <span className="text-red-500 mt-0.5">✗</span>
                Keys are valid forever — a compromised agent is a full breach
              </li>
              <li className="flex items-start gap-2">
                <span className="text-red-500 mt-0.5">✗</span>
                Overly broad permissions — one key for everything
              </li>
              <li className="flex items-start gap-2">
                <span className="text-red-500 mt-0.5">✗</span>
                Prompt injection can exfiltrate credentials
              </li>
            </ul>
          </div>

          <div className="bg-emerald-900/20 border border-emerald-700/40 rounded-xl p-4 space-y-2">
            <p className="text-sm font-bold text-emerald-300">✅ With Agent-Lock</p>
            <ul className="space-y-1.5 text-xs text-slate-400">
              <li className="flex items-start gap-2">
                <span className="text-emerald-500 mt-0.5">✓</span>
                Agent never sees real credentials — only receives ephemeral tokens
              </li>
              <li className="flex items-start gap-2">
                <span className="text-emerald-500 mt-0.5">✓</span>
                Tokens expire in 60 seconds — useless after the call
              </li>
              <li className="flex items-start gap-2">
                <span className="text-emerald-500 mt-0.5">✓</span>
                Minimum-privilege scope per tool (
                <code className="font-mono text-emerald-400">read:files</code>,{" "}
                <code className="font-mono text-emerald-400">write:db</code>)
              </li>
              <li className="flex items-start gap-2">
                <span className="text-emerald-500 mt-0.5">✓</span>
                Full audit trail of every token issued
              </li>
            </ul>
          </div>
        </div>
      </section>

      {/* What is MCP */}
      <section className="bg-brand-card border border-brand-border rounded-xl p-6 space-y-4">
        <h2 className="text-lg font-bold text-white flex items-center gap-2">
          🔌 What is MCP?
        </h2>
        <p className="text-slate-400 text-sm leading-relaxed">
          <strong className="text-slate-300">Model Context Protocol (MCP)</strong> is an open
          standard developed by Anthropic that allows AI models to communicate with external tools
          and data sources in a structured way. Instead of writing custom integrations for every
          service, MCP provides a unified protocol for tool discovery and invocation.
        </p>
        <p className="text-slate-400 text-sm leading-relaxed">
          Agent-Lock acts as an <strong className="text-slate-300">MCP proxy gateway</strong>. When
          Claude Desktop wants to call a tool, it goes through Agent-Lock&apos;s MCP server instead of
          calling the tool directly. This means every MCP tool call is intercepted, analyzed, and
          approved before it reaches the actual tool.
        </p>

        <div className="bg-brand-bg border border-brand-border rounded-xl p-4 font-mono text-xs overflow-x-auto">
          <div className="flex items-center gap-2 text-slate-500 mb-3 font-sans text-xs uppercase tracking-wider">
            Data flow with MCP
          </div>
          <div className="space-y-1 text-slate-400">
            <div>
              <span className="text-indigo-400">Claude Desktop</span>
              <span className="text-slate-600"> ──MCP──▶ </span>
              <span className="text-red-400">Agent-Lock MCP Server</span>
              <span className="text-slate-600"> ──▶ </span>
              <span className="text-amber-400">Risk Analysis</span>
            </div>
            <div className="pl-8 text-slate-600">
              └── APPROVED ──▶{" "}
              <span className="text-emerald-400">Real MCP Tool Server</span>
              <span className="text-slate-600"> ──▶ </span>
              <span className="text-slate-300">Result</span>
            </div>
            <div className="pl-8 text-slate-600">
              └── BLOCKED ──▶{" "}
              <span className="text-red-400">Error returned to Claude</span>
            </div>
          </div>
        </div>

        <div className="bg-brand-bg/40 border border-brand-border rounded-lg px-4 py-3">
          <p className="text-xs text-slate-400 leading-relaxed">
            <span className="text-slate-300 font-medium">Heartbeat: </span>
            The MCP gateway sends a ping to the backend every{" "}
            <code className="font-mono text-indigo-400">30 seconds</code>. You can monitor the
            connection status in real-time on the{" "}
            <strong className="text-slate-300">MCP Monitor</strong> page. If disconnected,
            restart with{" "}
            <code className="font-mono text-emerald-400 bg-brand-bg px-1.5 py-0.5 rounded">
              python -m mcp_server
            </code>
            .
          </p>
        </div>
      </section>

      {/* Setup Checklist */}
      <section className="bg-brand-card border border-brand-border rounded-xl p-6 space-y-4">
        <h2 className="text-lg font-bold text-white flex items-center gap-2">
          ✅ Setup Checklist
        </h2>
        <p className="text-slate-400 text-sm">
          Complete these steps to get Agent-Lock fully operational.
        </p>

        <div className="space-y-2">
          {[
            {
              label: "Backend running",
              desc: "cd backend && python -m uvicorn main:app --port 8000",
              icon: "🖥️",
              code: true,
            },
            {
              label: ".env configured",
              desc: "TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID, GEMINI_API_KEY, SECRET_KEY set",
              icon: "📄",
              code: false,
            },
            {
              label: "Claude Desktop config updated",
              desc: 'Add Agent-Lock MCP server to your Claude Desktop settings',
              icon: "🤖",
              code: false,
            },
            {
              label: "MCP config at ~/.agent-lock/mcp_config.json",
              desc: "Contains server connection details and tool definitions",
              icon: "⚙️",
              code: false,
            },
            {
              label: "Restart Claude Desktop",
              desc: "Required for MCP configuration changes to take effect",
              icon: "🔄",
              code: false,
            },
            {
              label: "Dashboard running",
              desc: "cd dashboard && npm run dev -- opens at http://localhost:3000",
              icon: "📊",
              code: true,
            },
          ].map((item, i) => (
            <div
              key={i}
              className="flex items-start gap-3 bg-brand-bg/40 border border-brand-border rounded-xl px-4 py-3.5 hover:border-slate-600/60 transition-colors"
            >
              <div className="flex-shrink-0 w-7 h-7 rounded-lg bg-indigo-900/40 border border-indigo-700/40 flex items-center justify-center text-sm">
                {item.icon}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-slate-200">{item.label}</p>
                {item.code ? (
                  <code className="text-xs text-emerald-400 font-mono mt-0.5 block">
                    {item.desc}
                  </code>
                ) : (
                  <p className="text-xs text-slate-500 mt-0.5">{item.desc}</p>
                )}
              </div>
              <div className="flex-shrink-0 w-5 h-5 rounded border-2 border-slate-600 mt-0.5" />
            </div>
          ))}
        </div>
      </section>

      {/* Tech Stack */}
      <section className="bg-brand-card border border-brand-border rounded-xl p-6 space-y-4">
        <h2 className="text-lg font-bold text-white">🛠️ Tech Stack</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {[
            { name: "FastAPI", role: "Backend API server", color: "text-emerald-400" },
            { name: "Gemini 2.0 Flash", role: "AI risk analysis", color: "text-blue-400" },
            { name: "Telegram Bot API", role: "Human approval notifications", color: "text-sky-400" },
            { name: "Auth0", role: "Token vault & scoped access", color: "text-orange-400" },
            { name: "MCP (Anthropic)", role: "AI tool protocol gateway", color: "text-purple-400" },
            { name: "Next.js 14", role: "This dashboard", color: "text-slate-300" },
          ].map((tech) => (
            <div
              key={tech.name}
              className="bg-brand-bg border border-brand-border rounded-lg px-3 py-3"
            >
              <p className={`text-sm font-semibold ${tech.color}`}>{tech.name}</p>
              <p className="text-xs text-slate-500 mt-0.5">{tech.role}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Footer */}
      <div className="text-center py-4">
        <p className="text-xs text-slate-700">
          Agent-Lock v1.0.0 · Built for secure AI agent deployments
        </p>
      </div>
    </div>
  )
}
