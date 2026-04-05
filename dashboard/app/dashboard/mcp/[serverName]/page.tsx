import { redirect } from "next/navigation"

export default function DashboardMcpServerAliasPage({
  params,
}: {
  params: { serverName: string }
}) {
  redirect(`/mcp/${encodeURIComponent(params.serverName)}`)
}
