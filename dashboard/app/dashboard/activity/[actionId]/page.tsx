import { redirect } from "next/navigation"

export default function DashboardActivityDetailAliasPage({
  params,
}: {
  params: { actionId: string }
}) {
  redirect(`/activity/${encodeURIComponent(params.actionId)}`)
}
