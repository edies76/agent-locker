export type RiskLevel = "LOW" | "HIGH" | "CRITICAL"
export type ActionStatus = "PENDING" | "AUTO_APPROVED" | "APPROVED" | "BLOCKED" | "AUTH_REQUIRED"

export interface Action {
  action_id: string
  timestamp: string
  tool_name: string
  args: Record<string, unknown>
  raw_command?: string
  user_intent: string
  agent_id?: string
  risk_level: RiskLevel
  intent_score: number
  analysis: string
  decision: ActionStatus
  decided_at?: string
  _signature_valid?: boolean
  _source?: "store" | "log"
  execution?: {
    server_name?: string
    tool_name?: string
    success?: boolean
    request_args?: Record<string, unknown>
    response_summary?: string
    error?: string
    timings_ms?: {
      validation_wait_ms?: number
      target_exec_ms?: number
      total_gateway_ms?: number
      baseline_direct_ms?: number
      agent_lock_overhead_ms?: number
    }
    benchmark?: {
      enabled?: boolean
      mode?: string
      success?: boolean
      note?: string
    }
    updated_at?: string
  }
}

export interface Stats {
  total: number
  auto_approved: number
  human_approved: number
  blocked: number
  pending: number
  risk_breakdown: { LOW: number; HIGH: number; CRITICAL: number }
  signature_failures: number
}

export interface MCPStatus {
  connected: boolean
  last_seen: string | null
  seconds_ago: number | null
  info: {
    connected_servers: string[]
    tool_count: number
    version: string
  }
}

export interface MCPTargetServer {
  name: string
  enabled: boolean
  connected: boolean
  command: string
  args?: string[]
}

export interface MCPTargetsResponse {
  config_path: string
  servers: MCPTargetServer[]
  configured_count: number
  connected_count: number
}

export interface MCPTimingAverages {
  total_gateway_ms: number | null
  validation_wait_ms: number | null
  target_exec_ms: number | null
  baseline_direct_ms: number | null
  agent_lock_overhead_ms: number | null
}

export interface MCPTimingsResponse {
  sample_size: number
  with_total: number
  with_baseline: number
  average_ms: MCPTimingAverages
  latest: Array<{
    server_name?: string
    tool_name?: string
    success?: boolean
    updated_at?: string
    timings_ms?: {
      total_gateway_ms?: number
      validation_wait_ms?: number
      target_exec_ms?: number
      baseline_direct_ms?: number
      agent_lock_overhead_ms?: number
    }
  }>
}

export interface MCPDiagnostics {
  connected: boolean
  seconds_ago: number | null
  config_path: string
  configured_count: number
  connected_count: number
  timings: MCPTimingAverages
  disconnected_enabled: string[]
  disconnected_details?: Array<{
    name: string
    enabled: boolean
    connected: boolean
    command?: string
    resolved_command?: string | null
    command_found?: boolean
    endpoint?: string
    endpoint_reachable?: boolean
    startup_hint?: string
  }>
  warnings: string[]
  recommendations: string[]
  telegram_runtime?: {
    polling_enabled: boolean
    polling_active: boolean
    polling_conflict: boolean
    lock_owner: boolean
    last_error: string
  }
  root_cause_code?: string
  root_cause_message?: string
  next_step?: string
  healthy: boolean
  error?: string
}

export interface MCPTargetDetail {
  name: string
  enabled: boolean
  connected: boolean
  command: string
  args: string[]
  resolved_command?: string | null
  command_found?: boolean
  endpoint?: string | null
  endpoint_reachable?: boolean | null
  endpoint_status?: string | null
  connection_reason_code?: string
  connection_reason?: string
  startup_hint?: string
}

export interface MCPTargetDetailResponse {
  ok: boolean
  error?: string
  warning?: string
  config_path?: string
  target?: MCPTargetDetail
  observed_connected_servers?: string[]
  restart_required_after_toggle?: boolean
}

export interface AuditLogItem {
  action_id: string
  timestamp: string
  tool_name: string
  args: Record<string, unknown>
  raw_command?: string
  user_intent: string
  agent_id?: string
  risk_level: RiskLevel
  intent_score: number
  analysis: string
  decision: ActionStatus
  decided_at?: string
  _signature_valid?: boolean
}

export interface Settings {
  telegram: {
    configured: boolean
    bot_token_preview: string | null
    chat_id: string | null
  }
  gemini: {
    configured: boolean
    key_preview: string | null
  }
  auth0: {
    configured: boolean
    domain: string | null
    audience: string
    client_id_preview: string | null
    callback_url: string
    scope: string
    token_vault_enabled?: boolean
    google_connection_name?: string
    google_scopes?: string
    google_audience?: string
    github_connection_name?: string
    slack_connection_name?: string
  }
  server: {
    backend_url: string
    port: number
    audit_log_path: string
  }
  security: {
    secret_key_is_default: boolean
  }
}

export interface Policy {
  id: string
  tool_pattern: string
  condition: string
  action: string
  risk_level: string
  description: string
}

export interface PoliciesResponse {
  policies: Policy[]
  global_config: Record<string, unknown>
}

export interface HealthResponse {
  status: string
  [key: string]: unknown
}

export interface TelegramTestResponse {
  ok: boolean
  message: string
}

export interface ApproveResponse {
  ok?: boolean
  status?: string
  [key: string]: unknown
}
