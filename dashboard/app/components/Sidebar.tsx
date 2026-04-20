"use client"

import Link from "next/link"
import Image from "next/image"
import { usePathname } from "next/navigation"
import { useEffect, useState } from "react"
import { fetchPending } from "@/lib/api"
import { useTheme } from "@/contexts/ThemeContext"
import AIAssistantWidget from "./AIAssistantWidget"

const navSections = [
  {
    title: "Dashboard",
    items: [
      {
        href: "/dashboard/overview",
        label: "Dashboard",
        icon: (
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5">
            <rect x="2" y="2" width="5" height="5" rx="1" />
            <rect x="11" y="2" width="5" height="5" rx="1" />
            <rect x="2" y="11" width="5" height="5" rx="1" />
            <rect x="11" y="11" width="5" height="5" rx="1" />
          </svg>
        ),
      },
      {
        href: "/dashboard/activity",
        label: "Activity",
        icon: (
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M2 9h3l2-5 3 10 2-5h4" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        ),
      },
      {
        href: "/dashboard/approvals",
        label: "Approvals",
        icon: (
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5">
            <circle cx="9" cy="9" r="7" />
            <path d="M6 9l2 2 4-4" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        ),
      },
      {
        href: "/dashboard/logs",
        label: "Logs",
        icon: (
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M4 4h10M4 7h10M4 10h6M4 13h8" strokeLinecap="round" />
          </svg>
        ),
      },
    ],
  },
  {
    title: "Integrations",
    items: [
      {
        href: "/dashboard/plugin",
        label: "Plugin",
        icon: (
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M5 4h8a2 2 0 012 2v6a2 2 0 01-2 2H9l-3 3v-3H5a2 2 0 01-2-2V6a2 2 0 012-2z" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        ),
      },
      {
        href: "/dashboard/chat",
        label: "Channel Chat",
        icon: (
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M3 4.5a1.5 1.5 0 011.5-1.5h9A1.5 1.5 0 0115 4.5v6A1.5 1.5 0 0113.5 12H8l-3 3v-3H4.5A1.5 1.5 0 013 10.5v-6z" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        ),
      },
      {
        href: "/dashboard/mcp",
        label: "MCP",
        icon: (
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5">
            <rect x="3" y="3" width="4" height="4" rx="0.5" />
            <rect x="11" y="3" width="4" height="4" rx="0.5" />
            <rect x="7" y="11" width="4" height="4" rx="0.5" />
            <path d="M5 7v2m0 2v0M13 7v4M9 11V9" strokeLinecap="round" />
          </svg>
        ),
      },
      {
        href: "/dashboard/mcp/setup",
        label: "Setup",
        icon: (
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5">
            <circle cx="9" cy="9" r="2.5" />
            <path d="M9 2v2M9 14v2M2 9h2M14 9h2M4.2 4.2l1.4 1.4M12.4 12.4l1.4 1.4M4.2 13.8l1.4-1.4M12.4 5.6l1.4-1.4" />
          </svg>
        ),
      },
      {
        href: "/dashboard/scopes",
        label: "Scopes",
        icon: (
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M9 2l6 3.5v7L9 16 3 12.5v-7L9 2z" />
            <path d="M9 2v14M3 5.5l6 3.5 6-3.5" strokeLinecap="round" />
          </svg>
        ),
      },
    ],
  },
  {
    title: "Admin",
    items: [
      {
        href: "/dashboard/analytics",
        label: "Analytics",
        icon: (
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M3 15V9M7 15V6M11 15V3M15 15v-5" strokeLinecap="round" />
          </svg>
        ),
      },
      {
        href: "/dashboard/settings",
        label: "Settings",
        icon: (
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5">
            <circle cx="9" cy="9" r="2.5" />
            <path d="M9 2v2M9 14v2M2 9h2M14 9h2M4.2 4.2l1.4 1.4M12.4 12.4l1.4 1.4M4.2 13.8l1.4-1.4M12.4 5.6l1.4-1.4" />
          </svg>
        ),
      },
      {
        href: "/learn",
        label: "Knowledge Hub",
        icon: (
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5">
            <rect x="3" y="3" width="12" height="12" rx="1.5" />
            <path d="M6 6h6M6 9h6M6 12h4" strokeLinecap="round" />
          </svg>
        ),
      },
    ],
  },
]

export default function Sidebar() {
  const pathname = usePathname()
  const [pendingCount, setPendingCount] = useState(0)
  const [collapsed, setCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [panelMode, setPanelMode] = useState<"sidebar" | "ai">(() => {
    if (typeof window === "undefined") return "sidebar"
    try {
      const raw = localStorage.getItem("agent-lock-left-panel-mode")
      return raw === "ai" || raw === "sidebar" ? raw : "sidebar"
    } catch {
      return "sidebar"
    }
  })
  const { theme, resolvedTheme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    let isMounted = true

    async function loadPending() {
      try {
        const data = await fetchPending()
        if (isMounted && Array.isArray(data)) {
          setPendingCount(data.length)
        }
      } catch {
        // silently ignore
      }
    }

    loadPending()
    const interval = setInterval(loadPending, 5000)
    return () => {
      isMounted = false
      clearInterval(interval)
    }
  }, [])

  useEffect(() => {
    if (!mobileOpen) return

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = "hidden"

    const handleEsc = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMobileOpen(false)
    }

    window.addEventListener("keydown", handleEsc)
    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener("keydown", handleEsc)
    }
  }, [mobileOpen])

  useEffect(() => {
    try {
      localStorage.setItem("agent-lock-left-panel-mode", panelMode)
    } catch {
      // ignore storage errors
    }
  }, [panelMode])

  const cycleTheme = () => {
    const themes: Array<'light' | 'dark' | 'system'> = ['light', 'dark', 'system']
    const currentIndex = themes.indexOf(theme)
    const nextIndex = (currentIndex + 1) % themes.length
    setTheme(themes[nextIndex])
  }

  const togglePanelMode = () => {
    setPanelMode((prev) => {
      const next = prev === "sidebar" ? "ai" : "sidebar"
      if (next === "ai" && collapsed) {
        setCollapsed(false)
      }
      return next
    })
  }

  const themeIcon = !mounted ? (
    <div className="w-[18px] h-[18px]"></div>
  ) : theme === 'system' ? (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5">
      <rect x="3" y="4" width="12" height="9" rx="1" />
      <path d="M6 16h6M9 13v3" />
    </svg>
  ) : resolvedTheme === 'dark' ? (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M15 10.5A6 6 0 017.5 3a6 6 0 108 7.5z" />
    </svg>
  ) : (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5">
      <circle cx="9" cy="9" r="3" />
      <path d="M9 2v2M9 14v2M2 9h2M14 9h2M4.2 4.2l1.4 1.4M12.4 12.4l1.4 1.4M4.2 13.8l1.4-1.4M12.4 5.6l1.4-1.4" />
    </svg>
  )

  const nav = (mobile = false) => (
    <div className="px-2 space-y-4">
      {navSections.map((section) => (
        <div key={section.title} className="space-y-1">
          {(mobile || !collapsed) && (
            <p className="px-3 text-[10px] font-semibold uppercase tracking-[0.24em]" style={{ color: 'var(--text-muted)' }}>
              {section.title}
            </p>
          )}
          <div className="space-y-0.5">
            {section.items.map((item) => {
              const isActive = pathname === item.href || pathname.startsWith(item.href + "/")
              const showBadge = item.href === "/approvals" && pendingCount > 0

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => {
                    if (mobile) setMobileOpen(false)
                  }}
                  className={`relative flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-all ${collapsed && !mobile ? 'justify-center' : ''}`}
                  style={{
                    background: isActive ? 'var(--accent-muted)' : 'transparent',
                    color: isActive ? 'var(--accent-primary)' : 'var(--text-secondary)',
                  }}
                  title={collapsed && !mobile ? item.label : undefined}
                >
                  <span className="flex-shrink-0">{item.icon}</span>
                  {(mobile || !collapsed) && <span className="flex-1">{item.label}</span>}
                  {showBadge && (
                    <span
                      className={`flex items-center justify-center rounded-full text-xs font-medium ${collapsed && !mobile ? 'absolute -top-1 -right-1 h-4 w-4 text-[10px]' : 'min-w-[20px] h-5 px-1.5'}`}
                      style={{ background: 'var(--danger)', color: 'white' }}
                    >
                      {pendingCount > 99 ? '99+' : pendingCount}
                    </span>
                  )}
                </Link>
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )

  return (
    <>
      <div
        className="fixed left-0 right-0 top-0 z-40 h-14 px-3 md:hidden"
        style={{ background: 'var(--bg-primary)', borderBottom: '1px solid var(--border-primary)' }}
      >
        <div className="flex h-full items-center justify-between">
          <button
            onClick={() => setMobileOpen(true)}
            aria-label="Open navigation"
            className="rounded-md p-2"
            style={{ color: 'var(--text-secondary)' }}
          >
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6">
              <path d="M3 5h14M3 10h14M3 15h14" strokeLinecap="round" />
            </svg>
          </button>
          <div className="flex items-center gap-2">
            <Image src="/logo.jpeg" alt="Agent-Lock" width={26} height={26} className="rounded-lg object-cover" />
            <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
              Agent-Lock
            </span>
          </div>
          <button
            onClick={cycleTheme}
            aria-label="Switch theme"
            className="rounded-md p-2"
            style={{ color: 'var(--text-secondary)' }}
            title={mounted ? `Theme: ${theme}` : 'Theme'}
          >
            {themeIcon}
          </button>
        </div>
      </div>

      {mobileOpen && (
        <>
          <button
            aria-label="Close navigation overlay"
            className="fixed inset-0 z-40 md:hidden"
            style={{ background: 'rgba(0, 0, 0, 0.45)' }}
            onClick={() => setMobileOpen(false)}
          />
          <aside
            className="fixed left-0 top-0 z-50 h-screen w-[86vw] max-w-[320px] md:hidden"
            style={{ background: 'var(--bg-primary)', borderRight: '1px solid var(--border-primary)' }}
          >
            <div className="flex h-14 items-center justify-between px-4" style={{ borderBottom: '1px solid var(--border-primary)' }}>
              <div className="flex items-center gap-2">
                <Image src="/logo.jpeg" alt="Agent-Lock" width={28} height={28} className="rounded-lg object-cover" />
                <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                  Agent-Lock
                </span>
              </div>
              <button
                onClick={() => setMobileOpen(false)}
                className="rounded p-1.5"
                style={{ color: 'var(--text-muted)' }}
                title="Close"
              >
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.7">
                  <path d="M4 4l8 8M12 4l-8 8" strokeLinecap="round" />
                </svg>
              </button>
            </div>
            <nav className="h-[calc(100vh-56px)] overflow-y-auto py-3">{nav(true)}</nav>
          </aside>
        </>
      )}

      <aside
        className={`fixed left-0 top-0 z-50 hidden h-screen flex-col transition-all duration-200 md:flex ${collapsed ? 'w-16' : 'w-[15.4rem]'}`}
        style={{ background: 'var(--bg-primary)', borderRight: '1px solid var(--border-primary)' }}
      >
        <div
          className="flex h-14 items-center justify-between px-4"
          style={{ borderBottom: panelMode === "ai" ? "none" : '1px solid var(--border-primary)' }}
        >
          {!collapsed && (
            <div className="flex items-center gap-2">
              <Image src="/logo.jpeg" alt="Agent-Lock" width={28} height={28} className="rounded-lg object-cover" />
              <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                Agent-Lock
              </span>
            </div>
          )}
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="rounded p-1.5 transition-colors"
            style={{ color: 'var(--text-muted)' }}
            title={collapsed ? 'Expand' : 'Collapse'}
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
              {collapsed ? (
                <path d="M6 4l4 4-4 4" strokeLinecap="round" strokeLinejoin="round" />
              ) : (
                <path d="M10 4L6 8l4 4" strokeLinecap="round" strokeLinejoin="round" />
              )}
            </svg>
          </button>
        </div>

        <div className="flex-1 overflow-hidden">
          {panelMode === "sidebar" ? (
            <nav className="h-full overflow-y-auto py-3">{nav(false)}</nav>
          ) : (
            <div className="h-full">
              <AIAssistantWidget embedded />
            </div>
          )}
        </div>

        <div className="px-3 pb-3 pt-5" style={{ borderTop: '1px solid var(--border-primary)' }}>
          {!collapsed ? (
            <>
              <div className="flex items-center gap-2">
                <button
                  onClick={togglePanelMode}
                  className="flex flex-1 items-center justify-center gap-2 rounded-md px-2 py-1.5 text-xs transition-colors"
                  style={{ color: 'var(--text-secondary)' }}
                  title={panelMode === "sidebar" ? "Switch to AI panel" : "Switch to navigation panel"}
                >
                  <svg width="15" height="15" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5">
                    {panelMode === "sidebar" ? (
                      <path d="M4 4h10v10H4zM7 7h4M7 10h4" strokeLinecap="round" strokeLinejoin="round" />
                    ) : (
                      <path d="M3 4h12M3 9h12M3 14h12" strokeLinecap="round" />
                    )}
                  </svg>
                  <span>Navigation</span>
                </button>

                <button
                  onClick={cycleTheme}
                  className="flex flex-1 items-center justify-center gap-2 rounded-md px-2 py-1.5 text-xs transition-colors"
                  style={{ color: 'var(--text-secondary)' }}
                  title={mounted ? `Theme: ${theme}` : 'Theme'}
                >
                  <span className="scale-90">{themeIcon}</span>
                  <span className="capitalize">{mounted ? theme : 'System'}</span>
                </button>
              </div>

              <div className="mt-2 px-1">
                <div className="flex items-center gap-2">
                  <span className="status-dot status-dot-success status-pulse" />
                  <span className="text-xs" style={{ color: 'var(--text-muted)' }}>v1.0.0</span>
                </div>
              </div>
            </>
          ) : (
            <div className="space-y-2">
              <button
                onClick={togglePanelMode}
                className="flex w-full items-center justify-center rounded-md px-2 py-1.5 transition-colors"
                style={{ color: 'var(--text-secondary)' }}
                title={panelMode === "sidebar" ? "Switch to AI panel" : "Switch to navigation panel"}
              >
                <svg width="15" height="15" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5">
                  {panelMode === "sidebar" ? (
                    <path d="M4 4h10v10H4zM7 7h4M7 10h4" strokeLinecap="round" strokeLinejoin="round" />
                  ) : (
                    <path d="M3 4h12M3 9h12M3 14h12" strokeLinecap="round" />
                  )}
                </svg>
              </button>
              <button
                onClick={cycleTheme}
                className="flex w-full items-center justify-center rounded-md px-2 py-1.5 transition-colors"
                style={{ color: 'var(--text-secondary)' }}
                title={mounted ? `Theme: ${theme}` : 'Theme'}
              >
                {themeIcon}
              </button>
            </div>
          )}
        </div>
      </aside>
    </>
  )
}

