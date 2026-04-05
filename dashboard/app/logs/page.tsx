"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { fetchLogsFiltered, LogsQuery } from "@/lib/api"
import { AuditLogItem } from "@/types"
import { Card, CardHeader, Button, Badge, Table, TableHeader, TableBody, TableRow, TableHead, TableCell, TableEmpty } from "../components/ui"

function DecisionBadge({ decision }: { decision: string }) {
  const variant =
    decision === "AUTO_APPROVED" || decision === "APPROVED"
      ? "success"
      : decision === "BLOCKED"
      ? "danger"
      : decision === "PENDING"
      ? "warning"
      : "neutral"

  return <Badge variant={variant as "success" | "danger" | "warning" | "neutral"}>{decision}</Badge>
}

function RiskBadge({ risk }: { risk: string }) {
  const variant = risk === "CRITICAL" ? "danger" : risk === "HIGH" ? "warning" : "success"
  return <Badge variant={variant as "success" | "warning" | "danger"}>{risk}</Badge>
}

export default function LogsPage() {
  const [items, setItems] = useState<AuditLogItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)

  const [risk, setRisk] = useState("")
  const [decision, setDecision] = useState("")
  const [signature, setSignature] = useState<"all" | "valid" | "invalid">("all")
  const [tool, setTool] = useState("")
  const [agent, setAgent] = useState("")
  const [search, setSearch] = useState("")

  const query = useMemo<LogsQuery>(
    () => ({
      limit: 150,
      risk: risk || undefined,
      decision: decision || undefined,
      signature,
      tool: tool || undefined,
      agent: agent || undefined,
      search: search || undefined,
    }),
    [agent, decision, risk, search, signature, tool]
  )

  const load = useCallback(
    async (forceRefresh = false) => {
      try {
        if (!loading) setRefreshing(true)
        const data = await fetchLogsFiltered({ ...query, refresh: forceRefresh })
        setItems(Array.isArray(data) ? (data as AuditLogItem[]) : [])
        setError(null)
      } catch {
        setError("Could not load logs")
      } finally {
        setLoading(false)
        setRefreshing(false)
      }
    },
    [loading, query]
  )

  useEffect(() => {
    load(false)
  }, [load])

  useEffect(() => {
    const timer = setTimeout(() => {
      void load(false)
    }, 350)
    return () => clearTimeout(timer)
  }, [query, load])

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="page-title">Logs</h1>
          <p className="page-subtitle max-w-2xl">Audit stream with filters for fast incident review</p>
        </div>
        <div className="flex items-center gap-2">
          {refreshing && <span className="text-xs" style={{ color: "var(--text-muted)" }}>Refreshing...</span>}
          <Button variant="secondary" size="sm" onClick={() => load(true)}>
            Refresh
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader title="Filters" subtitle="Narrow logs by risk, decision, signer and actor" />
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-6">
          <select className="input" value={risk} onChange={(e) => setRisk(e.target.value)}>
            <option value="">All risk</option>
            <option value="LOW">Low</option>
            <option value="HIGH">High</option>
            <option value="CRITICAL">Critical</option>
          </select>
          <select className="input" value={decision} onChange={(e) => setDecision(e.target.value)}>
            <option value="">All decision</option>
            <option value="PENDING">Pending</option>
            <option value="AUTO_APPROVED">Auto approved</option>
            <option value="APPROVED">Approved</option>
            <option value="BLOCKED">Blocked</option>
          </select>
          <select
            className="input"
            value={signature}
            onChange={(e) => setSignature(e.target.value as "all" | "valid" | "invalid")}
          >
            <option value="all">All signatures</option>
            <option value="valid">Valid only</option>
            <option value="invalid">Invalid only</option>
          </select>
          <input
            className="input"
            placeholder="Tool"
            value={tool}
            onChange={(e) => setTool(e.target.value)}
          />
          <input
            className="input"
            placeholder="Agent"
            value={agent}
            onChange={(e) => setAgent(e.target.value)}
          />
          <input
            className="input"
            placeholder="Search text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </Card>

      <Card padding="none">
        <div className="px-4 py-3 flex items-center justify-between" style={{ borderBottom: "1px solid var(--border-primary)" }}>
          <h2 className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>Audit Events</h2>
          <span className="text-xs" style={{ color: "var(--text-muted)" }}>{items.length} rows</span>
        </div>

        {error ? (
          <div className="px-4 py-6 text-sm" style={{ color: "var(--danger)" }}>{error}</div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Time</TableHead>
                <TableHead>Tool</TableHead>
                <TableHead>Risk</TableHead>
                <TableHead>Decision</TableHead>
                <TableHead>Signature</TableHead>
                <TableHead>Agent</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                [...Array(8)].map((_, i) => (
                  <TableRow key={`s-${i}`}>
                    {[...Array(6)].map((__, j) => (
                      <TableCell key={`s-${i}-${j}`}>
                        <div className="h-4 w-20 animate-pulse rounded" style={{ background: "var(--bg-tertiary)" }} />
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              ) : items.length === 0 ? (
                <TableEmpty colSpan={6} message="No logs match the current filters" />
              ) : (
                items.map((item) => (
                  <TableRow key={item.action_id}>
                    <TableCell>
                      <span className="text-xs font-mono" style={{ color: "var(--text-muted)" }}>
                        {new Date(item.timestamp).toLocaleString()}
                      </span>
                    </TableCell>
                    <TableCell>
                      <span className="font-mono text-sm" style={{ color: "var(--text-primary)" }}>
                        {item.tool_name}
                      </span>
                    </TableCell>
                    <TableCell>
                      <RiskBadge risk={item.risk_level} />
                    </TableCell>
                    <TableCell>
                      <DecisionBadge decision={item.decision} />
                    </TableCell>
                    <TableCell>
                      <Badge variant={item._signature_valid === false ? "danger" : "success"}>
                        {item._signature_valid === false ? "Invalid" : "Valid"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <span className="text-xs font-mono" style={{ color: "var(--text-secondary)" }}>
                        {item.agent_id || "-"}
                      </span>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        )}
      </Card>
    </div>
  )
}
