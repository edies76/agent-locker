"use client"

import Link from "next/link"
import { useParams } from "next/navigation"
import { useCallback, useEffect, useMemo, useState } from "react"
import Button from "@/app/components/ui/Button"
import Card, { CardContent, CardHeader } from "@/app/components/ui/Card"
import { useToast } from "@/app/components/Toast"
import { fetchRuntimeControls, updateRuntimeControls } from "@/lib/api"
import type { RuntimeControls, ScopeCatalogItem } from "@/types"

const PROVIDER_LABELS: Record<string, string> = {
  gmail: "Gmail",
  calendar: "Calendar",
  drive: "Drive",
  youtube: "YouTube",
  github: "GitHub",
  slack: "Slack",
}

function titleFromProvider(provider: string): string {
  return PROVIDER_LABELS[provider] ?? provider
}

function groupBySection(scopes: ScopeCatalogItem[]) {
  const map = new Map<string, ScopeCatalogItem[]>()
  for (const scope of scopes) {
    const section = scope.section || "General"
    const current = map.get(section) ?? []
    current.push(scope)
    map.set(section, current)
  }
  return Array.from(map.entries())
}

export default function ProviderScopesPage() {
  const params = useParams<{ provider: string }>()
  const provider = String(params?.provider ?? "").toLowerCase()
  const providerTitle = titleFromProvider(provider)
  const { showToast } = useToast()

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [controls, setControls] = useState<RuntimeControls | null>(null)
  const [catalog, setCatalog] = useState<Record<string, ScopeCatalogItem[]>>({})

  const scopes = catalog[provider] ?? []
  const scopeMap = controls?.integration_scopes_enabled?.[provider] ?? {}

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const data = await fetchRuntimeControls({ refresh: true })
      setControls(data.runtime_controls ?? null)
      setCatalog(data.available_scope_catalog ?? {})
      setError(null)
    } catch {
      setError("Could not load scope controls from backend.")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const sectionedScopes = useMemo(() => groupBySection(scopes), [scopes])

  const toggleScope = (scopeId: string) => {
    setControls((prev) => {
      if (!prev) return prev
      const existing = prev.integration_scopes_enabled ?? {}
      const providerMap = existing[provider] ?? {}
      return {
        ...prev,
        integration_scopes_enabled: {
          ...existing,
          [provider]: {
            ...providerMap,
            [scopeId]: !(providerMap[scopeId] !== false),
          },
        },
      }
    })
  }

  const setAll = (enabled: boolean) => {
    setControls((prev) => {
      if (!prev) return prev
      const existing = prev.integration_scopes_enabled ?? {}
      const nextProviderMap = Object.fromEntries(scopes.map((scope) => [scope.id, enabled])) as Record<
        string,
        boolean
      >
      return {
        ...prev,
        integration_scopes_enabled: {
          ...existing,
          [provider]: nextProviderMap,
        },
      }
    })
  }

  const save = async () => {
    if (!controls) return
    setSaving(true)
    try {
      const response = await updateRuntimeControls({
        integration_scopes_enabled: controls.integration_scopes_enabled,
      })
      setControls(response.runtime_controls)
      setCatalog(response.available_scope_catalog ?? {})
      showToast({ type: "success", title: `${providerTitle} scopes updated` })
    } catch {
      showToast({ type: "error", title: "Failed to update scopes" })
    } finally {
      setSaving(false)
    }
  }

  const enabledCount = scopes.filter((scope) => scopeMap[scope.id] !== false).length

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2">
        <Link href="/dashboard/scopes" className="text-sm text-indigo-400 hover:text-indigo-300">
          ← Back to all providers
        </Link>
        <h1 className="text-2xl font-bold text-white">{providerTitle} Scopes</h1>
        <p className="text-sm text-slate-500">
          Toggle each available scope for {providerTitle}. Changes are saved to runtime controls.
        </p>
      </div>

      {loading && <div className="h-40 animate-pulse rounded-xl bg-[var(--bg-tertiary)]" />}

      {error && !loading && (
        <div className="rounded-lg border border-red-700/40 bg-red-900/20 px-4 py-3 text-sm text-red-200">
          {error}
        </div>
      )}

      {!loading && !error && scopes.length === 0 && (
        <div className="rounded-lg border border-amber-700/40 bg-amber-900/20 px-4 py-3 text-sm text-amber-200">
          No scope catalog is configured for this provider.
        </div>
      )}

      {!loading && !error && scopes.length > 0 && (
        <>
          <Card>
            <CardHeader
              title={`${enabledCount}/${scopes.length} enabled`}
              subtitle="Provider-level controls"
              action={
                <div className="flex gap-2">
                  <Button size="sm" variant="secondary" onClick={() => setAll(true)}>
                    Enable all
                  </Button>
                  <Button size="sm" variant="secondary" onClick={() => setAll(false)}>
                    Disable all
                  </Button>
                </div>
              }
            />
            <CardContent>
              <p className="text-xs text-[var(--text-tertiary)]">
                Tip: keep only the minimum scopes enabled in production.
              </p>
            </CardContent>
          </Card>

          {sectionedScopes.map(([section, sectionScopes]) => (
            <Card key={section}>
              <CardHeader title={section} subtitle={`${sectionScopes.length} scopes`} />
              <CardContent className="space-y-3">
                {sectionScopes.map((scope) => {
                  const enabled = scopeMap[scope.id] !== false
                  return (
                    <div
                      key={scope.id}
                      className="flex items-start justify-between gap-4 rounded-lg border border-[var(--border-primary)] bg-[var(--bg-secondary)]/50 p-3"
                    >
                      <div className="space-y-1">
                        <p className="text-sm font-medium text-[var(--text-primary)]">{scope.label}</p>
                        <p className="text-xs text-[var(--text-secondary)]">{scope.description}</p>
                        <code className="text-xs text-[var(--text-tertiary)]">{scope.id}</code>
                      </div>
                      <button
                        type="button"
                        className={`switch ${enabled ? "switch-on" : "switch-off"}`}
                        onClick={() => toggleScope(scope.id)}
                        aria-label={`Toggle ${scope.label}`}
                      >
                        <span className="switch-knob" />
                      </button>
                    </div>
                  )
                })}
              </CardContent>
            </Card>
          ))}

          <div className="flex justify-end">
            <Button onClick={save} loading={saving}>
              Save {providerTitle} scopes
            </Button>
          </div>
        </>
      )}
    </div>
  )
}

