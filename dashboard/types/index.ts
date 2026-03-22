export type RiskLevel = "LOW" | "HIGH" | "CRITICAL"
export type ActionStatus = "PENDING" | "AUTO_APPROVED" | "APPROVED" | "BLOCKED"

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
}

export interface MCPTargetsResponse {
  config_path: string
  servers: MCPTargetServer[]
  configured_count: number
  connected_count: number
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
