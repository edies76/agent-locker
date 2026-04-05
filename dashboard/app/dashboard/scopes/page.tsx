"use client"

import Link from "next/link"
import { useEffect, useMemo, useState } from "react"
import Card, { CardContent, CardHeader } from "@/app/components/ui/Card"
import { fetchRuntimeControls } from "@/lib/api"
import type { RuntimeControls, ScopeCatalogItem } from "@/types"

const PROVIDER_ORDER = ["gmail", "calendar", "drive", "youtube", "github", "slack"] as const

const PROVIDER_LABELS: Record<string, string> = {
  gmail: "Gmail",
  calendar: "Calendar",
  drive: "Drive",
  youtube: "YouTube",
  github: "GitHub",
  slack: "Slack",
}

export default function ScopesIndexPage() {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [catalog, setCatalog] = useState<Record<string, ScopeCatalogItem[]>>({})
  const [controls, setControls] = useState<RuntimeControls | null>(null)

  useEffect(() => {
    let mounted = true
    async function load() {
      setLoading(true)
      try {
        const data = await fetchRuntimeControls({ refresh: true })
        if (!mounted) return
        setCatalog(data.available_scope_catalog ?? {})
        setControls(data.runtime_controls ?? null)
        setError(null)
      } catch {
        if (!mounted) return
        setError("Could not load scopes from backend.")
      } finally {
        if (mounted) setLoading(false)
      }
    }
    void load()
    return () => {
      mounted = false
    }
  }, [])

  const providers = useMemo(() => {
    const fromCatalog = Object.keys(catalog)
    const merged = Array.from(new Set([...PROVIDER_ORDER, ...fromCatalog]))
    return merged.filter((provider) => (catalog[provider]?.length ?? 0) > 0)
  }, [catalog])

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Integration Scopes</h1>
        <p className="text-sm text-slate-500 mt-1">
          Each provider has its own screen. Toggle every available scope individually.
        </p>
      </div>

      {loading && (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-36 animate-pulse rounded-xl bg-[var(--bg-tertiary)]" />
          ))}
        </div>
      )}

      {error && !loading && (
        <div className="rounded-lg border border-red-700/40 bg-red-900/20 px-4 py-3 text-sm text-red-200">
          {error}
        </div>
      )}

      {!loading && !error && (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {providers.map((provider) => {
            const scopes = catalog[provider] ?? []
            const enabledMap = controls?.integration_scopes_enabled?.[provider] ?? {}
            const enabledCount = scopes.filter((scope) => enabledMap[scope.id] !== false).length
            return (
              <Link key={provider} href={`/dashboard/scopes/${provider}`} className="block">
                <Card variant="interactive" className="h-full">
                  <CardHeader
                    title={PROVIDER_LABELS[provider] ?? provider}
                    subtitle={`${enabledCount}/${scopes.length} scopes enabled`}
                  />
                  <CardContent>
                    <p className="text-sm text-[var(--text-secondary)]">
                      Open dedicated scope controls for {PROVIDER_LABELS[provider] ?? provider}.
                    </p>
                  </CardContent>
                </Card>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}

