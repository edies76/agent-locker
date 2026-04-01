"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useEffect, useState } from "react"
import { fetchPending } from "@/lib/api"
import { useTheme } from "@/contexts/ThemeContext"

const navItems = [
  { 
    href: "/overview", 
    label: "Overview", 
    icon: (
      <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5">
        <rect x="2" y="2" width="5" height="5" rx="1" />
        <rect x="11" y="2" width="5" height="5" rx="1" />
        <rect x="2" y="11" width="5" height="5" rx="1" />
        <rect x="11" y="11" width="5" height="5" rx="1" />
      </svg>
    )
  },
  { 
    href: "/activity", 
    label: "Activity", 
    icon: (
      <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path d="M2 9h3l2-5 3 10 2-5h4" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    )
  },
  { 
    href: "/approvals", 
    label: "Approvals", 
    icon: (
      <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5">
        <circle cx="9" cy="9" r="7" />
        <path d="M6 9l2 2 4-4" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    )
  },
  { 
    href: "/plugin", 
    label: "Plugin", 
    icon: (
      <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path d="M5 4h8a2 2 0 012 2v6a2 2 0 01-2 2H9l-3 3v-3H5a2 2 0 01-2-2V6a2 2 0 012-2z" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    )
  },
  { 
    href: "/mcp", 
    label: "MCP", 
    icon: (
      <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5">
        <rect x="3" y="3" width="4" height="4" rx="0.5" />
        <rect x="11" y="3" width="4" height="4" rx="0.5" />
        <rect x="7" y="11" width="4" height="4" rx="0.5" />
        <path d="M5 7v2m0 2v0M13 7v4M9 11V9" strokeLinecap="round" />
      </svg>
    )
  },
  { 
    href: "/mcp/setup", 
    label: "MCP Setup", 
    icon: (
      <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5">
        <circle cx="9" cy="9" r="2.5" />
        <path d="M9 2v2M9 14v2M2 9h2M14 9h2M4.2 4.2l1.4 1.4M12.4 12.4l1.4 1.4M4.2 13.8l1.4-1.4M12.4 5.6l1.4-1.4" />
      </svg>
    )
  },
  { 
    href: "/logs", 
    label: "Logs", 
    icon: (
      <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path d="M4 4h10M4 7h10M4 10h6M4 13h8" strokeLinecap="round" />
      </svg>
    )
  },
  { 
    href: "/analytics", 
    label: "Analytics", 
    icon: (
      <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path d="M3 15V9M7 15V6M11 15V3M15 15v-5" strokeLinecap="round" />
      </svg>
    )
  },
  { 
    href: "/settings", 
    label: "Settings", 
    icon: (
      <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5">
        <circle cx="9" cy="9" r="2.5" />
        <path d="M9 2v2M9 14v2M2 9h2M14 9h2M4.2 4.2l1.4 1.4M12.4 12.4l1.4 1.4M4.2 13.8l1.4-1.4M12.4 5.6l1.4-1.4" />
      </svg>
    )
  },
]

export default function Sidebar() {
  const pathname = usePathname()
  const [pendingCount, setPendingCount] = useState(0)
  const [collapsed, setCollapsed] = useState(false)
  const { theme, resolvedTheme, setTheme, mounted } = useTheme()

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

  const cycleTheme = () => {
    const themes: ('light' | 'dark' | 'system')[] = ['light', 'dark', 'system']
    const currentIndex = themes.indexOf(theme)
    const nextIndex = (currentIndex + 1) % themes.length
    setTheme(themes[nextIndex])
  }

  const ThemeIcon = () => {
    if (theme === 'system') {
      return (
        <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5">
          <rect x="3" y="4" width="12" height="9" rx="1" />
          <path d="M6 16h6M9 13v3" />
        </svg>
      )
    }
    if (resolvedTheme === 'dark') {
      return (
        <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5">
          <path d="M15 10.5A6 6 0 017.5 3a6 6 0 108 7.5z" />
        </svg>
      )
    }
    return (
      <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5">
        <circle cx="9" cy="9" r="3" />
        <path d="M9 2v2M9 14v2M2 9h2M14 9h2M4.2 4.2l1.4 1.4M12.4 12.4l1.4 1.4M4.2 13.8l1.4-1.4M12.4 5.6l1.4-1.4" />
      </svg>
    )
  }

  // Don't render full sidebar until mounted to avoid hydration mismatch
  if (!mounted) {
    return (
      <aside 
        className="fixed left-0 top-0 h-screen w-56 flex flex-col z-50"
        style={{
          background: 'var(--bg-primary)',
          borderRight: '1px solid var(--border-primary)',
        }}
      />
    )
  }

  return (
    <aside 
      className={`fixed left-0 top-0 h-screen flex flex-col z-50 transition-all duration-200 ${collapsed ? 'w-16' : 'w-56'}`}
      style={{
        background: 'var(--bg-primary)',
        borderRight: '1px solid var(--border-primary)',
      }}
    >
      {/* Header */}
      <div 
        className="h-14 flex items-center justify-between px-4"
        style={{ borderBottom: '1px solid var(--border-primary)' }}
      >
        {!collapsed && (
          <div className="flex items-center gap-2">
            <div 
              className="w-7 h-7 rounded flex items-center justify-center text-sm font-bold"
              style={{ background: 'var(--accent-primary)', color: 'white' }}
            >
              A
            </div>
            <span className="font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>
              Agent-Lock
            </span>
          </div>
        )}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="p-1.5 rounded transition-colors"
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

      {/* Navigation */}
      <nav className="flex-1 py-3 overflow-y-auto">
        <div className="px-2 space-y-0.5">
          {navItems.map((item) => {
            const isActive = pathname === item.href || pathname.startsWith(item.href + "/")
            const showBadge = item.href === "/approvals" && pendingCount > 0
            
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-all relative ${collapsed ? 'justify-center' : ''}`}
                style={{
                  background: isActive ? 'var(--accent-muted)' : 'transparent',
                  color: isActive ? 'var(--accent-primary)' : 'var(--text-secondary)',
                }}
                title={collapsed ? item.label : undefined}
              >
                <span className="flex-shrink-0">{item.icon}</span>
                {!collapsed && <span className="flex-1">{item.label}</span>}
                {showBadge && (
                  <span 
                    className={`flex items-center justify-center text-xs font-medium rounded-full ${collapsed ? 'absolute -top-1 -right-1 w-4 h-4 text-[10px]' : 'min-w-[20px] h-5 px-1.5'}`}
                    style={{ background: 'var(--danger)', color: 'white' }}
                  >
                    {pendingCount > 99 ? '99+' : pendingCount}
                  </span>
                )}
              </Link>
            )
          })}
        </div>
      </nav>

      {/* Footer */}
      <div 
        className="px-3 py-3"
        style={{ borderTop: '1px solid var(--border-primary)' }}
      >
        {/* Theme toggle */}
        <button
          onClick={cycleTheme}
          className={`flex items-center gap-3 w-full px-3 py-2 rounded-md text-sm transition-colors ${collapsed ? 'justify-center' : ''}`}
          style={{ color: 'var(--text-secondary)' }}
          title={`Theme: ${theme}`}
        >
          <ThemeIcon />
          {!collapsed && (
            <span className="capitalize">{theme}</span>
          )}
        </button>
        
        {!collapsed && (
          <div className="mt-3 px-3">
            <div className="flex items-center gap-2">
              <span className="status-dot status-dot-success status-pulse" />
              <span className="text-xs" style={{ color: 'var(--text-muted)' }}>v1.0.0</span>
            </div>
          </div>
        )}
      </div>
    </aside>
  )
}

