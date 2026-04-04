import Link from "next/link"

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
      {/* Header */}
      <header className="border-b border-slate-800/50 backdrop-blur-sm sticky top-0 z-50 bg-slate-950/80">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center font-bold text-white text-xl shadow-lg shadow-cyan-500/20">
              A
            </div>
            <div>
              <h1 className="text-xl font-bold text-white">Agent-Lock</h1>
              <p className="text-xs text-slate-400">Security middleware for AI agents</p>
            </div>
          </div>
          <Link 
            href="/dashboard/overview" 
            className="px-5 py-2.5 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg font-medium transition-all shadow-lg shadow-cyan-600/20 hover:shadow-cyan-500/30"
          >
            Open Dashboard →
          </Link>
        </div>
      </header>

      {/* Hero */}
      <section className="max-w-7xl mx-auto px-6 pt-20 pb-16 text-center">
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 text-sm font-medium mb-8">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-cyan-500"></span>
          </span>
          Production-ready AI security middleware
        </div>
        
        <h1 className="text-5xl md:text-7xl font-bold text-white mb-6 leading-tight">
          Secure your AI agents
          <br />
          <span className="bg-gradient-to-r from-cyan-400 via-blue-500 to-purple-600 bg-clip-text text-transparent">
            without breaking workflow
          </span>
        </h1>
        
        <p className="text-xl text-slate-400 max-w-3xl mx-auto mb-12 leading-relaxed">
          Agent-Lock intercepts AI tool calls, validates intent with Gemini AI, and enforces approval workflows—all while maintaining zero-friction UX for authorized actions.
        </p>

        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Link 
            href="/dashboard/overview"
            className="px-8 py-4 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white rounded-xl font-semibold transition-all shadow-2xl shadow-cyan-600/30 hover:shadow-cyan-500/40 hover:scale-105"
          >
            Launch Dashboard
          </Link>
          <a 
            href="https://github.com/edies76/agent-locker"
            target="_blank"
            rel="noopener noreferrer"
            className="px-8 py-4 bg-slate-800 hover:bg-slate-700 text-white rounded-xl font-semibold transition-all border border-slate-700 hover:border-slate-600"
          >
            View on GitHub
          </a>
        </div>
      </section>

      {/* Features */}
      <section className="max-w-7xl mx-auto px-6 py-20">
        <h2 className="text-3xl font-bold text-white text-center mb-12">Why Agent-Lock?</h2>
        <div className="grid md:grid-cols-3 gap-8">
          <FeatureCard
            icon="🛡️"
            title="AI-Powered Validation"
            description="Gemini validates every tool call against user intent before execution, catching misaligned actions."
          />
          <FeatureCard
            icon="⚡"
            title="Zero-Friction Auto-Approve"
            description="Low-risk actions auto-approve instantly. High-risk requires manual review. CRITICAL blocks by default."
          />
          <FeatureCard
            icon="🔐"
            title="Connected Accounts"
            description="Securely broker Gmail, Calendar, GitHub, Slack via Auth0 Token Vault—agents never see your tokens."
          />
          <FeatureCard
            icon="📊"
            title="Real-Time Dashboard"
            description="Monitor activity, approvals, analytics, and MCP topology from anywhere."
          />
          <FeatureCard
            icon="🔌"
            title="MCP Server Integration"
            description="Drop-in MCP server for Claude Desktop with built-in policy enforcement."
          />
          <FeatureCard
            icon="📱"
            title="Telegram Approvals"
            description="Get instant approval requests on your phone with YES/NO buttons."
          />
        </div>
      </section>

      {/* How it works */}
      <section className="max-w-7xl mx-auto px-6 py-20">
        <h2 className="text-3xl font-bold text-white text-center mb-12">How It Works</h2>
        <div className="grid md:grid-cols-4 gap-6">
          <StepCard number="1" title="Agent calls tool" description="Claude Desktop makes a tool call via MCP" />
          <StepCard number="2" title="Intent validation" description="Gemini AI validates against user intent" />
          <StepCard number="3" title="Risk assessment" description="Policy engine assigns LOW/HIGH/CRITICAL risk" />
          <StepCard number="4" title="Execute or block" description="Auto-approve, manual review, or block" />
        </div>
      </section>

      {/* Quick Start */}
      <section className="max-w-4xl mx-auto px-6 py-20">
        <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-10">
          <h2 className="text-3xl font-bold text-white mb-6">Quick Start</h2>
          <div className="space-y-4">
            <CodeBlock title="1. Install the MCP server">
              npx @agent-lock/mcp-server
            </CodeBlock>
            <CodeBlock title="2. Add to Claude Desktop config">
              {`{
  "mcpServers": {
    "agent-lock": {
      "command": "npx",
      "args": ["-y", "@agent-lock/mcp-server"]
    }
  }
}`}
            </CodeBlock>
            <CodeBlock title="3. Open the dashboard">
              https://agent-lock-dashboard.azurewebsites.net
            </CodeBlock>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-slate-800/50 mt-20">
        <div className="max-w-7xl mx-auto px-6 py-8 flex flex-col md:flex-row justify-between items-center gap-4">
          <p className="text-slate-400 text-sm">
            © 2026 Agent-Lock. Open source security for AI agents.
          </p>
          <div className="flex gap-6">
            <a href="https://github.com/edies76/agent-locker" className="text-slate-400 hover:text-white transition-colors">
              GitHub
            </a>
            <Link href="/dashboard/overview" className="text-slate-400 hover:text-white transition-colors">
              Dashboard
            </Link>
            <Link href="/dashboard/about" className="text-slate-400 hover:text-white transition-colors">
              About
            </Link>
          </div>
        </div>
      </footer>
    </div>
  )
}

function FeatureCard({ icon, title, description }: { icon: string; title: string; description: string }) {
  return (
    <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-6 hover:border-slate-700 transition-all hover:shadow-lg hover:shadow-cyan-500/5">
      <div className="text-4xl mb-4">{icon}</div>
      <h3 className="text-xl font-semibold text-white mb-3">{title}</h3>
      <p className="text-slate-400 leading-relaxed">{description}</p>
    </div>
  )
}

function StepCard({ number, title, description }: { number: string; title: string; description: string }) {
  return (
    <div className="relative">
      <div className="flex flex-col items-center text-center">
        <div className="w-12 h-12 rounded-full bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center text-white font-bold text-xl mb-4 shadow-lg shadow-cyan-500/20">
          {number}
        </div>
        <h3 className="text-lg font-semibold text-white mb-2">{title}</h3>
        <p className="text-sm text-slate-400">{description}</p>
      </div>
      {number !== "4" && (
        <div className="hidden md:block absolute top-6 left-[calc(50%+24px)] w-[calc(100%-48px)] h-0.5 bg-gradient-to-r from-cyan-500/50 to-transparent"></div>
      )}
    </div>
  )
}

function CodeBlock({ title, children }: { title: string; children: string }) {
  return (
    <div>
      <p className="text-sm text-slate-400 mb-2">{title}</p>
      <pre className="bg-slate-950 border border-slate-800 rounded-lg p-4 overflow-x-auto">
        <code className="text-sm text-cyan-400 font-mono">{children}</code>
      </pre>
    </div>
  )
}
