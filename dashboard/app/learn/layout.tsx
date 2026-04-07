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
    <main className="min-h-screen bg-[var(--bg-secondary)] text-[var(--text-primary)]">
      <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:px-8">
        <header className="card mb-6 flex flex-wrap items-center justify-between gap-4 p-4 sm:p-5">
          <div className="flex items-center gap-3">
            <Image src="/logo.jpeg" alt="Agent-Lock logo" width={36} height={36} className="h-9 w-9 rounded-md border border-[var(--border-primary)] object-cover" />
            <div>
              <p className="text-xs uppercase tracking-[0.15em] text-[var(--text-tertiary)]">Agent-Lock Knowledge Hub</p>
              <h1 className="text-lg font-semibold">How Agent-Lock works</h1>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href="/" className="btn btn-secondary">Home</Link>
            <Link href="/dashboard/overview" className="btn btn-primary">Dashboard</Link>
          </div>
        </header>

        <nav className="card mb-6 flex flex-wrap gap-2 p-3">
          {sections.map((section) => (
            <Link key={section.href} href={section.href} className="rounded-md border border-[var(--border-primary)] px-3 py-1.5 text-xs font-medium text-[var(--text-secondary)] transition-colors hover:bg-[var(--bg-tertiary)] hover:text-[var(--text-primary)]">
              {section.label}
            </Link>
          ))}
        </nav>

        {children}
      </div>
    </main>
  )
}
