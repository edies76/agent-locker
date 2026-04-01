/**
 * @agentlock/shared
 * 
 * Shared configuration and utilities for Agent-Lock packages.
 * Used by both @agentlock/agent-lock (plugin) and @agentlock/mcp-server.
 */

// ── Backend URLs ─────────────────────────────────────────────────────────────
export const OFFICIAL_BACKEND_URL = "https://agent-lock-backend-api-7.azurewebsites.net";
export const LOCAL_BACKEND_URL = "http://localhost:8000";

// ── Product Info ─────────────────────────────────────────────────────────────
export const PRODUCT_NAME = "Agent-Lock";
export const PRODUCT_EMOJI = "🦞";

// ── Timeouts (configurable via env vars) ─────────────────────────────────────
export function getTimeoutMs(envVar: string, defaultMs: number): number {
    const val = process.env[envVar];
    if (val) {
        const parsed = parseInt(val, 10);
        if (!isNaN(parsed) && parsed > 0) return parsed;
    }
    return defaultMs;
}

export const NPM_LOOKUP_TIMEOUT_MS = getTimeoutMs("AGENT_LOCK_NPM_LOOKUP_TIMEOUT_MS", 30_000);
export const NPM_INSTALL_TIMEOUT_MS = getTimeoutMs("AGENT_LOCK_NPM_INSTALL_TIMEOUT_MS", 300_000);
export const BACKEND_HEALTH_TIMEOUT_MS = getTimeoutMs("AGENT_LOCK_BACKEND_HEALTH_TIMEOUT_MS", 5_000);

// ── Backend URL Normalization ────────────────────────────────────────────────
export function normalizeUrl(url: string): string {
    return url.replace(/\/+$/, "");
}

// ── Version utilities ────────────────────────────────────────────────────────
export type SemVer = [number, number, number];

export function parseSemver(version: string): SemVer | null {
    const m = version.trim().match(/^(\d+)\.(\d+)\.(\d+)/);
    if (!m) return null;
    return [Number(m[1]), Number(m[2]), Number(m[3])];
}

export function compareSemver(a: string, b: string): number {
    const pa = parseSemver(a);
    const pb = parseSemver(b);
    if (!pa || !pb) return 0;
    for (let i = 0; i < 3; i++) {
        if (pa[i] > pb[i]) return 1;
        if (pa[i] < pb[i]) return -1;
    }
    return 0;
}

export function versionOrUnknown(version: string | null | undefined): string {
    return version ?? "unknown";
}

// ── Paths ────────────────────────────────────────────────────────────────────
import os from "node:os";
import path from "node:path";

export function getAgentLockDir(): string {
    return path.join(os.homedir(), ".agent-lock");
}

export function getOpenClawDir(): string {
    return path.join(os.homedir(), ".openclaw");
}

export function getMcpConfigPath(): string {
    return path.join(getAgentLockDir(), "mcp_config.json");
}

export function getPluginConfigPath(): string {
    return path.join(getOpenClawDir(), "extensions", "agent-lock", "agent-lock.config.json");
}

// ── Config Types ─────────────────────────────────────────────────────────────
export interface BaseConfig {
    backend_url: string;
    subject_token?: string;
    auto_approve_low_risk?: boolean;
    require_approval_for_high?: boolean;
    require_approval_for_critical?: boolean;
    approval_timeout_seconds?: number;
}

export interface MCPTargetServer {
    name: string;
    command: string;
    args: string[];
    env?: Record<string, string>;
    enabled?: boolean;
}

export interface MCPConfig extends BaseConfig {
    target_servers: MCPTargetServer[];
    local_cache_ttl?: number;
    audit_log_path?: string;
}

export interface PluginConfig extends BaseConfig {
    status_poll_ms?: number;
    status_poll_ms_max?: number;
    log_level?: "debug" | "info" | "warn" | "error";
}

// ── Default Configs ──────────────────────────────────────────────────────────
export const DEFAULT_MCP_CONFIG: MCPConfig = {
    target_servers: [],
    backend_url: OFFICIAL_BACKEND_URL,
    subject_token: "",
    auto_approve_low_risk: true,
    require_approval_for_high: true,
    require_approval_for_critical: true,
    approval_timeout_seconds: 300,
    local_cache_ttl: 3600,
    audit_log_path: "logs/mcp_audit.jsonl",
};

export const DEFAULT_PLUGIN_CONFIG: PluginConfig = {
    backend_url: OFFICIAL_BACKEND_URL,
    status_poll_ms: 500,
    status_poll_ms_max: 2000,
    log_level: "info",
};

// ── Export all ───────────────────────────────────────────────────────────────
export { os, path };
