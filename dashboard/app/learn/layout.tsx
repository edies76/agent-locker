import Link from "next/link"
import Image from "next/image"

const sections = [
  { href: "/learn", label: "Overview" },
  { href: "/learn/problem", label: "Problem" },
  { href: "/learn/architecture", label: "Architecture" },
  { href: "/learn/setup", label: "Setup" },
  { href: "/learn/operations", label: "Operations" },
  { href: "/learn/troubleshooting", label: "Troubleshooting" },
]

export default function LearnLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="relative min-h-screen overflow-hidden text-[var(--text-primary)]">
      <div className="fixed inset-0 z-[-2] bg-[#050814]" />
      <div className="fixed inset-0 z-[-1] pointer-events-none">
        <div className="absolute left-[-120px] top-[-90px] h-[320px] w-[320px] rounded-full bg-blue-500/20 blur-[110px]" />
        <div className="absolute right-[-120px] top-[120px] h-[320px] w-[320px] rounded-full bg-violet-500/20 blur-[120px]" />
      </div>

      <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:px-8">
        <header className="mb-6 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur-xl sm:p-5">
          <div className="flex items-center gap-3">
            <Image src="/logo.jpeg" alt="Agent-Lock logo" width={36} height={36} className="h-9 w-9 rounded-md border border-[var(--border-primary)] object-cover" />
            <div>
              <p className="text-xs uppercase tracking-[0.15em] text-gray-300">Agent-Lock Knowledge Hub</p>
              <h1 className="text-lg font-semibold text-white">How Agent-Lock works</h1>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href="/" className="btn btn-secondary">Home</Link>
            <Link href="/dashboard/overview" className="btn btn-primary">Dashboard</Link>
          </div>
        </header>

        <section className="mb-6 rounded-2xl border border-white/10 bg-black/35 p-5 backdrop-blur-xl">
          <p className="mb-2 text-xs uppercase tracking-[0.16em] text-gray-300">Knowledge mission</p>
          <h2 className="mb-2 text-2xl font-semibold text-white">Understand the full Agent-Lock system, not just screens.</h2>
          <p className="max-w-4xl text-sm text-gray-300">
            This hub explains the problem, architecture, setup, operations, and failure handling with practical guidance so teams can deploy and operate Agent-Lock with confidence.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <span className="rounded-full border border-emerald-400/30 bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-300">MCP + Plugin</span>
            <span className="rounded-full border border-blue-400/30 bg-blue-500/10 px-3 py-1 text-xs font-medium text-blue-300">Fail-closed approvals</span>
            <span className="rounded-full border border-violet-400/30 bg-violet-500/10 px-3 py-1 text-xs font-medium text-violet-300">User-scoped runtime</span>
          </div>
        </section>

        <nav className="mb-6 flex flex-wrap gap-2 rounded-2xl border border-white/10 bg-white/5 p-3 backdrop-blur-xl">
          {sections.map((section) => (
            <Link key={section.href} href={section.href} className="rounded-md border border-white/15 px-3 py-1.5 text-xs font-medium text-gray-200 transition-colors hover:bg-white/10 hover:text-white">
              {section.label}
            </Link>
          ))}
        </nav>

        {children}
      </div>
    </main>
  )
}
