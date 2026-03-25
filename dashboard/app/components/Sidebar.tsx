"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useEffect, useState } from "react"
import { fetchPending } from "@/lib/api"

const navItems = [
  { href: "/overview", label: "Overview", icon: "📊" },
  { href: "/activity", label: "Activity", icon: "📋" },
  { href: "/approvals", label: "Approvals", icon: "⏳" },
  { href: "/mcp", label: "MCP Monitor", icon: "🔌" },
  { href: "/settings", label: "Settings", icon: "⚙️" },
  { href: "/about", label: "About", icon: "ℹ️" },
]

export default function Sidebar() {
  const pathname = usePathname()
  const [pendingCount, setPendingCount] = useState(0)

  useEffect(() => {
    let mounted = true

    async function loadPending() {
      try {
        const data = await fetchPending()
        if (mounted && Array.isArray(data)) {
          setPendingCount(data.length)
        }
      } catch {
        // silently ignore
      }
    }

    loadPending()
    const interval = setInterval(loadPending, 5000)
    return () => {
      mounted = false
      clearInterval(interval)
    }
  }, [])

  return (
    <aside className="fixed left-0 top-0 h-screen w-60 bg-brand-sidebar/80 backdrop-blur-xl flex flex-col z-50 border-r border-slate-700/40 shadow-2xl shadow-slate-950/30">
      {/* Logo / Branding */}
      <div className="px-5 py-6 border-b border-slate-700/40">
        <div className="flex items-center gap-2">
          <span className="text-2xl">🦞</span>
          <div>
            <h1 className="text-white font-bold text-lg leading-tight">Agent-Lock</h1>
            <p className="text-slate-400 text-xs leading-tight">Control Center</p>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {navItems.map((item) => {
          const isActive = pathname === item.href || pathname.startsWith(item.href + "/")
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`
                flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium
                transition-all duration-200 relative
                ${
                  isActive
                    ? "bg-sky-500/80 text-slate-900 shadow-lg shadow-sky-700/30 border border-sky-300/60"
                    : "text-slate-300 hover:text-white hover:bg-slate-800/60 border border-transparent"
                }
              `}
            >
              <span className="text-base leading-none">{item.icon}</span>
              <span className="flex-1">{item.label}</span>
              {item.href === "/approvals" && pendingCount > 0 && (
                <span className="bg-red-500 text-white text-xs font-bold rounded-full min-w-[20px] h-5 flex items-center justify-center px-1.5">
                  {pendingCount > 99 ? "99+" : pendingCount}
                </span>
              )}
            </Link>
          )
        })}
      </nav>

      {/* Footer */}
      <div className="px-5 py-4 border-t border-slate-700/40">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-sky-400 animate-pulse" />
          <span className="text-slate-400 text-xs">v1.0.0</span>
        </div>
        <p className="text-slate-500 text-xs mt-1">Governance Dashboard</p>
      </div>
    </aside>
  )
}
