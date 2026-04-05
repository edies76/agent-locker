/**
 * Agent-Lock Plugin for OpenClaw
 *
 * NOTE ON USER INTENT:
 * OpenClaw's before_tool_call event only contains { toolName, params }.
 * The user message is NOT available directly in the event, BUT it may still
 * be reachable through nested properties like event.session, event.context,
 * event.request, etc. We use a multi-strategy approach:
 *
 * Strategy 1 — api.onMessage: fires before any tool call.
 * Strategy 2 — api.on() with all known event names.
 * Strategy 3 — api.registerPlugin hooks (before_prompt_build / before_model_call).
 * Strategy 4 — agent_lock_respond tool for in-chat decisions.
 * Strategy 5 — Deep-search of the event object itself inside before_tool_call
 *              (catches cases where strategies 1-3 haven't fired yet).
 *
 * A message is only silently dropped if it is completely empty.
 */

import fs from "node:fs";
import path from "node:path";

// Load version from package.json in same directory as this file
function loadVersion(): string {
    try {
        const pkgPath = path.join(__dirname, "package.json");
        const raw = fs.readFileSync(pkgPath, "utf8");
        const pkg = JSON.parse(raw);
        return pkg.version ?? "unknown";
    } catch {
        return "unknown";
    }
}

const PLUGIN_VERSION = loadVersion();

type AgentLockFileConfig = {
    backend_url?: string;
    status_poll_ms?: number;
    status_poll_ms_max?: number;
    log_level?: string;
    subject_token?: string;
    dashboard_bridge_token?: string;
    preferred_channel?: string;
    available_channels?: string[];
    client_label?: string;
};

function loadFileConfig(): AgentLockFileConfig {
    try {
        const configPath = path.join(__dirname, "agent-lock.config.json");
        if (!fs.existsSync(configPath)) return {};
        const raw = fs.readFileSync(configPath, "utf8");
        const parsed = JSON.parse(raw) as AgentLockFileConfig;
        return parsed ?? {};
    } catch {
        return {};
    }
}

const FILE_CONFIG = loadFileConfig();

const LOCAL_BACKEND_URL = "http://localhost:8000";
const CLOUD_BACKEND_URL = process.env.AGENT_LOCK_URL ?? FILE_CONFIG.backend_url ?? "https://agent-lock-backend-api-7.azurewebsites.net";
const PREFER_CLOUD = (process.env.AGENT_LOCK_PREFER_CLOUD ?? "true").toLowerCase() !== "false";
let activeBackendUrl = PREFER_CLOUD ? CLOUD_BACKEND_URL : LOCAL_BACKEND_URL;
let cloudFallbackAnnounced = false;

const STATUS_POLL_MS = Number(process.env.AGENT_LOCK_STATUS_POLL_MS ?? FILE_CONFIG.status_poll_ms ?? "500");
const STATUS_POLL_MS_MAX = Number(process.env.AGENT_LOCK_STATUS_POLL_MS_MAX ?? FILE_CONFIG.status_poll_ms_max ?? "2000");
const AUTH_REQUIRED_WAIT_MS = Number(process.env.AGENT_LOCK_AUTH_WAIT_MS ?? "600000");
const LOG_LEVEL = (process.env.AGENT_LOCK_LOG_LEVEL ?? FILE_CONFIG.log_level ?? "info").toLowerCase();
const DASHBOARD_BRIDGE_TOKEN = process.env.AGENT_LOCK_DASHBOARD_BRIDGE_TOKEN ?? FILE_CONFIG.dashboard_bridge_token ?? "";
const PREFERRED_CHANNEL = (process.env.AGENT_LOCK_PREFERRED_CHANNEL ?? FILE_CONFIG.preferred_channel ?? "agentlock_dashboard").toLowerCase();
const AVAILABLE_CHANNELS = Array.isArray(FILE_CONFIG.available_channels) && FILE_CONFIG.available_channels.length > 0
    ? FILE_CONFIG.available_channels
    : ["agentlock_dashboard", "whatsapp", "telegram"];
const CLIENT_LABEL = process.env.AGENT_LOCK_CLIENT_LABEL ?? FILE_CONFIG.client_label ?? "openclaw";
const SUBJECT_TOKEN = process.env.AGENT_LOCK_SUBJECT_TOKEN ?? FILE_CONFIG.subject_token ?? "default";

const LEVEL_WEIGHT: Record<string, number> = {
    debug: 10,
    info: 20,
    warn: 30,
    error: 40,
};

function shouldLog(level: "debug" | "info" | "warn" | "error"): boolean {
    const current = LEVEL_WEIGHT[LOG_LEVEL] ?? LEVEL_WEIGHT.info;
    return LEVEL_WEIGHT[level] >= current;
}

// ── Structured log buffer for the dashboard ────────────────────────────────
// Console shows clean human-readable text only.
// Full context (JSON details) is kept here for the dashboard to read.
const LOG_BUFFER_SIZE = 500;
type LogEntry = { ts: string; level: string; message: string; context?: Record<string, unknown> };
const logBuffer: LogEntry[] = [];

function log(
    level: "debug" | "info" | "warn" | "error",
    message: string,
    context?: Record<string, unknown>,
): void {
    if (!shouldLog(level)) return;

    // Store full structured entry for the dashboard
    logBuffer.push({ ts: new Date().toISOString(), level, message, context });
    if (logBuffer.length > LOG_BUFFER_SIZE) logBuffer.shift();

    // Console: clean text only — no JSON noise
    const line = `[Agent-Lock][${level.toUpperCase()}] ${message}`;
    if (level === "warn") { console.warn(line); return; }
    if (level === "error") { console.error(line); return; }
    console.log(line);
}

/** Returns the in-memory structured log buffer (for dashboard polling). */
export function getLogBuffer() { return [...logBuffer]; }


function logBlue(message: string): void {
    const BLUE = "\x1b[94m";
    const RESET = "\x1b[0m";
    console.log(`${BLUE}[Agent-Lock] ${message}${RESET}`);
}

// Cache: session → latest user message
const intentCache = new Map<string, string>();
let intentGlobal = ""; // Global fallback when sessionKey is unavailable

function store(key: string, msg: string): boolean {
    if (!msg || msg.trim().length < 1) return false; // Accept any non-empty message
    const clean = msg.trim();
    // Only update if the new message is different (avoid duplicates in logs)
    if (intentCache.get(key) === clean && intentGlobal === clean) return false;
    intentCache.set(key, clean);
    intentGlobal = clean;
    return true;
}

function getIntent(key: string): string {
    return intentCache.get(key) ?? intentGlobal;
}

const pending = new Map<string, (d: "approve" | "deny") => void>();
const authRequiredLogGate = new Map<string, number>();
const AUTH_REQUIRED_LOG_COOLDOWN_MS = 60_000;
let activeChannel = PREFERRED_CHANNEL;
let heartbeatConnectedAnnounced = false;
let heartbeatAnnouncedChannel = "";

const AUTH_GATED_TOOL_KEYWORDS = ["gmail", "email", "mail", "calendar", "slack", "github", "vault"];

function isAuthGatedTool(toolName: string): boolean {
    const normalized = (toolName || "").toLowerCase();
    return AUTH_GATED_TOOL_KEYWORDS.some((kw) => normalized.includes(kw));
}

function jsonToolResult(payload: unknown) {
    return {
        content: [{ type: "text" as const, text: JSON.stringify(payload, null, 2) }],
        details: payload,
    };
}

async function authInfoMessage(toolName: string): Promise<ReturnType<typeof jsonToolResult> | null> {
    try {
        const me = await get("/auth/me", undefined, SUBJECT_TOKEN, true) as any;
        if (Boolean(me?.authenticated)) return null;
    } catch {
        // Let tool call continue; backend response will provide detailed error context.
    }
    const loginUrl = `${activeBackendUrl}/auth/login?subject_token=${encodeURIComponent(SUBJECT_TOKEN || "default")}`;
    return jsonToolResult({
        success: true,
        requires_login: true,
        message: `🔵 Debes iniciar sesión antes de ejecutar ${toolName}.`,
        next_step: "Abre login_url, completa login y vuelve a intentar.",
        login_url: loginUrl,
    });
}

async function post(
    url: string,
    body: unknown,
    customHeaders?: Record<string, string>,
    subjectTokenOverride?: string,
    cloudOnly: boolean = false,
) {
    const start = Date.now();
    const extraAuth = subjectTokenOverride ?? SUBJECT_TOKEN;

    const attempt = async (baseUrl: string) => {
        const r = await fetch(`${baseUrl}${url}`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                ...(extraAuth ? { "Authorization": `Bearer ${extraAuth}` } : {}),
                ...(customHeaders ?? {}),
            },
            body: JSON.stringify(body),
        });
        if (!r.ok) {
            const errorText = await r.text().catch(() => "");
            const err = new Error(`HTTP ${r.status}: ${errorText}`) as Error & { status?: number };
            err.status = r.status;
            throw err;
        }
        activeBackendUrl = baseUrl;
        return r;
    };

    const primary = cloudOnly ? CLOUD_BACKEND_URL : (PREFER_CLOUD ? CLOUD_BACKEND_URL : LOCAL_BACKEND_URL);
    const secondary = cloudOnly ? CLOUD_BACKEND_URL : (PREFER_CLOUD ? LOCAL_BACKEND_URL : CLOUD_BACKEND_URL);
    try {
        const response = await attempt(primary);
        if (cloudFallbackAnnounced) {
            cloudFallbackAnnounced = false;
        }
        log("debug", "HTTP POST completed", {
            url: `${primary}${url}`,
            status: response.status,
            latency_ms: Date.now() - start,
        });
        return response.json();
    } catch (primaryErr) {
        if (secondary === primary) throw primaryErr;
        const response = await attempt(secondary);
        if (!cloudFallbackAnnounced) {
            cloudFallbackAnnounced = true;
            log("warn", "Primary backend unavailable, using fallback", {
                primary_backend_url: primary,
                fallback_backend_url: secondary,
            });
        }
        log("debug", "HTTP POST completed", {
            url: `${secondary}${url}`,
            status: response.status,
            latency_ms: Date.now() - start,
        });
        return response.json();
    }
}

async function get(
    url: string,
    customHeaders?: Record<string, string>,
    subjectTokenOverride?: string,
    cloudOnly: boolean = false,
) {
    const start = Date.now();
    const extraAuth = subjectTokenOverride ?? SUBJECT_TOKEN;
    const attempt = async (baseUrl: string) => {
        const r = await fetch(`${baseUrl}${url}`, {
            headers: {
                ...(extraAuth ? { "Authorization": `Bearer ${extraAuth}` } : {}),
                ...(customHeaders ?? {}),
            },
        });
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        activeBackendUrl = baseUrl;
        return r;
    };

    const primary = cloudOnly ? CLOUD_BACKEND_URL : (PREFER_CLOUD ? CLOUD_BACKEND_URL : LOCAL_BACKEND_URL);
    const secondary = cloudOnly ? CLOUD_BACKEND_URL : (PREFER_CLOUD ? LOCAL_BACKEND_URL : CLOUD_BACKEND_URL);
    try {
        const response = await attempt(primary);
        if (cloudFallbackAnnounced) {
            cloudFallbackAnnounced = false;
        }
        log("debug", "HTTP GET completed", {
            url: `${primary}${url}`,
            status: response.status,
            latency_ms: Date.now() - start,
        });
        return response.json();
    } catch (primaryErr) {
        if (secondary === primary) throw primaryErr;

        const response = await attempt(secondary);
        if (!cloudFallbackAnnounced) {
            cloudFallbackAnnounced = true;
            log("warn", "Primary backend unavailable, using fallback", {
                primary_backend_url: primary,
                fallback_backend_url: secondary,
            });
        }
        log("debug", "HTTP GET completed", {
            url: `${secondary}${url}`,
            status: response.status,
            latency_ms: Date.now() - start,
        });
        return response.json();
    }
}

// ── Extracts sessionKey from an event context ─────────────────────────────────
function sessionOf(ctx: any): string {
    const direct = (
        ctx?.sessionKey ??
        ctx?.session_key ??
        ctx?.sessionId ??
        ctx?.session?.id ??
        ctx?.session?.key
    );
    if (direct) return String(direct);

    // WhatsApp (and some other channels) provide a stable conversation key.
    const channelId = ctx?.channelId ?? ctx?.metadata?.originatingChannel ?? ctx?.metadata?.channelId;
    const accountId = ctx?.accountId ?? ctx?.metadata?.accountId ?? ctx?.metadata?.originatingTo;
    const conversationId =
        ctx?.conversationId ??
        ctx?.metadata?.conversationId ??
        ctx?.metadata?.senderId ??
        ctx?.from ??
        ctx?.metadata?.senderE164;
    if (channelId && conversationId) {
        return `${String(channelId)}:${String(accountId ?? "default")}:${String(conversationId)}`;
    }

    return "default";
}

// ── Extracts text from a message object ──────────────────────────────────────
function bodyOf(msg: any): string {
    if (!msg) return "";
    if (typeof msg === "string") return msg;
    // Covers all known OpenClaw message field names
    return (
        msg.body ?? msg.text ?? msg.content ?? msg.message ??
        msg.input ?? msg.prompt ?? msg.query ?? msg.value ?? ""
    );
}

/**
 * Strategy 5: Deep-search an arbitrary event/context object for a user message.
 * We traverse up to MAX_DEPTH levels deep looking for known text fields,
 * prioritising objects that also have role==='user' or type==='user'.
 *
 * @param obj   - Object to search.
 * @param depth - Current recursion depth.
 * @param seen  - WeakSet to track visited objects and prevent infinite cycles.
 *                A new WeakSet is created per top-level call.
 */
function _deepFindUserMessage(obj: any, depth = 0, seen = new WeakSet<object>()): string {
    const MAX_DEPTH = 6;
    if (depth > MAX_DEPTH || !obj || typeof obj !== "object") return "";
    if (seen.has(obj)) return "";
    seen.add(obj);

    // If this node looks like a user message, extract and return its text
    const role: string = (obj.role ?? obj.type ?? "").toLowerCase();
    if (role === "user" || role === "human") {
        const text = bodyOf(obj);
        if (text) return text;
    }

    // If it has an array of messages, find the last user entry first
    for (const key of ["messages", "history", "turns", "chat"]) {
        const arr = obj[key];
        if (Array.isArray(arr) && arr.length > 0) {
            const lastUser = [...arr].reverse().find(
                (m: any) => (m?.role ?? m?.type ?? "").toLowerCase() === "user" ||
                             (m?.role ?? m?.type ?? "").toLowerCase() === "human"
            );
            if (lastUser) {
                const text = bodyOf(lastUser);
                if (text) return text;
            }
            // Fallback: last element of the array
            const lastText = bodyOf(arr[arr.length - 1]);
            if (lastText) return lastText;
        }
    }

    // Check direct text-like fields on this node
    const directText = bodyOf(obj);
    if (directText && directText.length > 2) return directText;

    // Recurse into child objects, passing the same seen set
    for (const val of Object.values(obj)) {
        if (val && typeof val === "object") {
            const found = _deepFindUserMessage(val, depth + 1, seen);
            if (found) return found;
        }
    }
    return "";
}

export default function register(api: any) {
    const sendPluginHeartbeat = async () => {
        if (!DASHBOARD_BRIDGE_TOKEN) return;
        try {
            const hb = await post(`/dashboard/plugin/heartbeat`, {
                token: DASHBOARD_BRIDGE_TOKEN,
                client_id: CLIENT_LABEL,
                plugin_version: PLUGIN_VERSION,
                available_channels: AVAILABLE_CHANNELS,
                active_channel: activeChannel,
                metadata: {
                    backend_url: activeBackendUrl,
                },
            });
            if (hb?.ok && (!heartbeatConnectedAnnounced || heartbeatAnnouncedChannel !== activeChannel)) {
                heartbeatConnectedAnnounced = true;
                heartbeatAnnouncedChannel = activeChannel;
                log("info", "Dashboard channel connected", {
                    pairing_id: hb?.pairing_id ?? "unknown",
                    active_channel: hb?.active_channel ?? activeChannel,
                    preferred_channel: hb?.preferred_channel ?? PREFERRED_CHANNEL,
                });
            }
        } catch (error: any) {
            heartbeatConnectedAnnounced = false;
            log("debug", "Plugin heartbeat failed", {
                error: error?.message ?? "unknown",
            });
        }
    };

    if (DASHBOARD_BRIDGE_TOKEN) {
        log("info", "Dashboard channel token detected", {
            preferred_channel: PREFERRED_CHANNEL,
            client_label: CLIENT_LABEL,
        });
        void sendPluginHeartbeat();
        setInterval(() => {
            void sendPluginHeartbeat();
        }, 15000);
    } else {
        log("info", "Dashboard channel token missing. Plugin heartbeat pairing is disabled.");
    }

    // ── Capture user intent from inbound messages ───────────────────────────
    // OpenClaw WhatsApp emits `message_received` with (message, meta)
    try {
        api.on("message_received", (msg: any, meta: any) => {
            const text = msg?.content;
            const detectedChannel = String(meta?.channelId ?? meta?.metadata?.originatingChannel ?? "").toLowerCase();
            if (detectedChannel.includes("whatsapp")) {
                activeChannel = "whatsapp";
            } else if (detectedChannel.includes("telegram")) {
                activeChannel = "telegram";
            } else if (PREFERRED_CHANNEL) {
                activeChannel = PREFERRED_CHANNEL;
            }

            if (text && typeof text === "string" && text.trim().length > 0) {
                // Prefer the metadata object since it contains channelId/accountId/conversationId
                const sessionKey = sessionOf(meta ?? msg);
                const storedPrimary = store(sessionKey, text);

                // Compatibility fallback: store under message-derived key too
                const fallbackKey = sessionOf(msg);
                const storedFallback = (fallbackKey !== sessionKey) ? store(fallbackKey, text) : false;

                if (storedPrimary || storedFallback) {
                    // Intentionally silent to avoid leaking user intent content in logs.
                }

                void sendPluginHeartbeat();
            }
            return undefined;
        });
    } catch {
        // If this OpenClaw build doesn't support the event, intent capture falls back to defaults.
    }

    // ── Strategy 4: manual response tool + Token Vault Tools ────────────────
    if (typeof api.registerTool === "function") {
        // Manual approval tool
        api.registerTool({
            name: "agent_lock_respond",
            label: "Agent-Lock Respond",
            description: "Records the user's decision for a pending Agent-Lock action.",
            parameters: {
                type: "object",
                properties: {
                    action_id: { type: "string", description: "ID of the pending action" },
                    decision: { type: "string", enum: ["approve", "deny"] },
                },
                required: ["action_id", "decision"],
            },
            execute: async (_toolCallId: string, params: Record<string, unknown>) => {
                const action_id = typeof params.action_id === "string" ? params.action_id : "";
                const decision =
                    params.decision === "approve" || params.decision === "deny"
                        ? params.decision
                        : undefined;

                if (!action_id || !decision) {
                    return jsonToolResult({
                        success: false,
                        error: "INVALID_INPUT",
                        message: "action_id and decision (approve|deny) are required.",
                    });
                }

                try {
                    await post(`/approve/${action_id}`, {
                        decision: decision === "approve" ? "YES" : "NO",
                    });
                } catch {}
                const resolve = pending.get(action_id);
                if (resolve) {
                    resolve(decision);
                    pending.delete(action_id);
                    return jsonToolResult({
                        success: true,
                        message: decision === "approve" ? "✅ Approved." : "🚫 Blocked.",
                    });
                }
                return jsonToolResult({ success: false, message: "Action not found." });
            },
        });
        log("info", "agent_lock_respond tool registered");

        // Auth Status Tool
        api.registerTool({
            name: "agent_lock_auth_status",
            label: "Agent-Lock Auth Status",
            description: "Shows current Agent-Lock auth status and connected user account.",
            parameters: {
                type: "object",
                properties: {},
                additionalProperties: false,
            },
            execute: async () => {
                try {
                    const status = await get("/auth/me", undefined, SUBJECT_TOKEN) as any;
                    const isAuthed = Boolean(status?.authenticated);
                    const userSub = typeof status?.sub === "string" ? status.sub : "";
                    const email =
                        typeof status?.claims?.email === "string"
                            ? status.claims.email
                            : (typeof status?.email === "string" ? status.email : "");
                    return jsonToolResult({
                        success: true,
                        authenticated: isAuthed,
                        user: {
                            sub: userSub || null,
                            email: email || null,
                        },
                        login_url: `${activeBackendUrl}/auth/login`,
                        logout_url: `${activeBackendUrl}/auth/logout`,
                    });
                } catch (error: any) {
                    return jsonToolResult({
                        success: false,
                        error: "AUTH_STATUS_FAILED",
                        message: error?.message ?? "Failed to read auth status",
                    });
                }
            },
        });
        log("info", "agent_lock_auth_status tool registered");

        // Services Status Tool
        api.registerTool({
            name: "agent_lock_services",
            label: "Agent-Lock Services",
            description: "Shows provider connection status (Google/GitHub/Slack) for current user session.",
            parameters: {
                type: "object",
                properties: {},
                additionalProperties: false,
            },
            execute: async () => {
                try {
                    const services = await get("/auth/services", undefined, SUBJECT_TOKEN) as any;
                    return jsonToolResult({
                        success: true,
                        authenticated: Boolean(services?.authenticated),
                        reason: typeof services?.reason === "string" ? services.reason : null,
                        sub: typeof services?.sub === "string" ? services.sub : null,
                        email: typeof services?.email === "string" ? services.email : null,
                        source: typeof services?.source === "string" ? services.source : null,
                        providers: Array.isArray(services?.providers) ? services.providers : [],
                    });
                } catch (error: any) {
                    return jsonToolResult({
                        success: false,
                        error: "SERVICES_STATUS_FAILED",
                        message: error?.message ?? "Failed to read services status",
                    });
                }
            },
        });
        log("info", "agent_lock_services tool registered");

        // Provider Status Tool
        api.registerTool({
            name: "agent_lock_provider_status",
            label: "Agent-Lock Provider Status",
            description: "Shows status for one provider connection (google, github, slack).",
            parameters: {
                type: "object",
                properties: {
                    provider: { type: "string", enum: ["google", "github", "slack"] },
                },
                required: ["provider"],
                additionalProperties: false,
            },
            execute: async (_toolCallId: string, params: Record<string, unknown>) => {
                const provider = typeof params.provider === "string" ? params.provider.toLowerCase() : "";
                if (!["google", "github", "slack"].includes(provider)) {
                    return jsonToolResult({
                        success: false,
                        error: "INVALID_PROVIDER",
                        message: "provider must be one of: google, github, slack",
                    });
                }
                try {
                    const status = await get(`/auth/providers/${provider}/status`, undefined, SUBJECT_TOKEN) as any;
                    return jsonToolResult({
                        success: true,
                        provider,
                        details: status,
                    });
                } catch (error: any) {
                    return jsonToolResult({
                        success: false,
                        error: "PROVIDER_STATUS_FAILED",
                        message: error?.message ?? "Failed to read provider status",
                    });
                }
            },
        });
        log("info", "agent_lock_provider_status tool registered");

        // Provider Login Helper Tool
        api.registerTool({
            name: "agent_lock_provider_login",
            label: "Agent-Lock Provider Login",
            description: "Returns provider login URL to connect google/github/slack.",
            parameters: {
                type: "object",
                properties: {
                    provider: { type: "string", enum: ["google", "github", "slack"] },
                },
                required: ["provider"],
                additionalProperties: false,
            },
            execute: async (_toolCallId: string, params: Record<string, unknown>) => {
                const provider = typeof params.provider === "string" ? params.provider.toLowerCase() : "";
                if (!["google", "github", "slack"].includes(provider)) {
                    return jsonToolResult({
                        success: false,
                        error: "INVALID_PROVIDER",
                        message: "provider must be one of: google, github, slack",
                    });
                }
                const connection = provider === "google" ? "google-oauth2" : provider;
                const query = new URLSearchParams({ connection, force_success: "true" });
                if (SUBJECT_TOKEN && String(SUBJECT_TOKEN).trim()) {
                    query.set("subject_token", String(SUBJECT_TOKEN).trim());
                }
                const loginUrl = `${activeBackendUrl}/auth/login?${query.toString()}`;
                return jsonToolResult({
                    success: true,
                    provider,
                    login_url: loginUrl,
                    message: `Open this URL to connect ${provider} to Agent-Lock.`,
                });
            },
        });
        log("info", "agent_lock_provider_login tool registered");

        // Provider Logout Tool
        api.registerTool({
            name: "agent_lock_provider_logout",
            label: "Agent-Lock Provider Logout",
            description: "Disconnects one provider (google, github, slack) from current session.",
            parameters: {
                type: "object",
                properties: {
                    provider: { type: "string", enum: ["google", "github", "slack"] },
                },
                required: ["provider"],
                additionalProperties: false,
            },
            execute: async (_toolCallId: string, params: Record<string, unknown>) => {
                const provider = typeof params.provider === "string" ? params.provider.toLowerCase() : "";
                if (!["google", "github", "slack"].includes(provider)) {
                    return jsonToolResult({
                        success: false,
                        error: "INVALID_PROVIDER",
                        message: "provider must be one of: google, github, slack",
                    });
                }
                try {
                    const response = await post(`/auth/providers/${provider}/logout`, {}, undefined, SUBJECT_TOKEN, true) as any;
                    return jsonToolResult({
                        success: true,
                        provider,
                        details: response,
                    });
                } catch (error: any) {
                    return jsonToolResult({
                        success: false,
                        error: "PROVIDER_LOGOUT_FAILED",
                        message: error?.message ?? "Failed to logout provider",
                    });
                }
            },
        });
        log("info", "agent_lock_provider_logout tool registered");

        // Auth Logout Tool
        api.registerTool({
            name: "agent_lock_auth_logout",
            label: "Agent-Lock Auth Logout",
            description: "Forces Agent-Lock logout so next sensitive action requires login again.",
            parameters: {
                type: "object",
                properties: {},
                additionalProperties: false,
            },
            execute: async () => {
                try {
                    // Prefer explicit logout endpoint call with subject identity.
                    await post("/auth/logout", {}, undefined, SUBJECT_TOKEN);
                } catch {
                    try {
                        await get("/auth/logout", undefined, SUBJECT_TOKEN);
                    } catch (error: any) {
                        return jsonToolResult({
                            success: false,
                            error: "LOGOUT_FAILED",
                            message: error?.message ?? "Failed to logout",
                        });
                    }
                }

                return jsonToolResult({
                    success: true,
                    message: "✅ Agent-Lock session logged out. Next protected action should require login.",
                    login_url: `${activeBackendUrl}/auth/login`,
                });
            },
        });
        log("info", "agent_lock_auth_logout tool registered");

        // ── Policy Control Tool ──────────────────────────────────────────────────
        api.registerTool({
            name: "agent_lock_policy",
            label: "Agent-Lock Policy",
            description: "Change the approval mode for a specific tool at runtime. Use 'auto' to skip confirmation, 'ask' to always require it, or 'default' to restore normal behaviour.",
            parameters: {
                type: "object",
                properties: {
                    tool_name: {
                        type: "string",
                        description: "The exact name of the tool to configure (e.g. 'agent_lock_calendar', 'exec')",
                    },
                    mode: {
                        type: "string",
                        enum: ["auto", "ask", "default"],
                        description: "'auto' = never ask, run automatically. 'ask' = always ask me first. 'default' = back to normal Gemini+rules logic.",
                    },
                },
                required: ["tool_name", "mode"],
            },
            execute: async (_toolCallId: string, params: Record<string, unknown>) => {
                const tool_name = String(params.tool_name || "");
                const mode = String(params.mode || "");

                if (!tool_name || !["auto", "ask", "default"].includes(mode)) {
                    return jsonToolResult({ success: false, error: "INVALID_INPUT", message: "tool_name and mode (auto|ask|default) are required." });
                }

                log("info", `Policy override requested`, { tool_name, mode });

                try {
                    const response = await post("/policy/override", {
                        tool_name,
                        mode,
                        set_by: "agent",
                    }) as any;

                    const modeLabel: Record<string, string> = {
                        auto: "🟢 Auto-approve (no confirmation needed)",
                        ask: "🔴 Always ask before executing",
                        default: "⚙️ Back to default rules",
                    };

                    return jsonToolResult({
                        success: true,
                        message: `✅ Policy updated for ${tool_name}: ${modeLabel[mode] ?? mode}`,
                        details: response,
                    });
                } catch (error: any) {
                    log("error", "Policy override failed", { error: error?.message });
                    return jsonToolResult({ success: false, error: "BACKEND_ERROR", message: `❌ Failed to update policy: ${error?.message}` });
                }
            },
        });
        log("info", "agent_lock_policy tool registered");

        // ── Token Vault Tools ─────────────────────────────────────────────────────

        // ── Gmail Central Tool ───────────────────────────────────────────────────
        api.registerTool({
            name: "agent_lock_gmail",
            label: "Agent-Lock Gmail",
            description: "Interact with Gmail via Agent-Lock Token Vault (zero-config, secure)",
            parameters: {
                type: "object",
                properties: {
                    action: { type: "string", enum: ["send"], description: "The Gmail action to perform" },
                    to: { type: "string", description: "Recipient email" },
                    subject: { type: "string", description: "Email subject" },
                    body_text: { type: "string", description: "Email body" },
                },
                required: ["action", "to", "subject", "body_text"],
            },
            execute: async (_toolCallId: string, params: Record<string, unknown>) => {
                const action = String(params.action || "");
                const to = String(params.to || "");
                const subject = String(params.subject || "");
                const body_text = String(params.body_text || "");

                log("info", `Gmail ${action} via Token Vault`, { to, subject });
                const authMsg = await authInfoMessage("agent_lock_gmail");
                if (authMsg) return authMsg;

                if (action === "send") {
                    if (!to || !subject || !body_text) {
                        return jsonToolResult({ success: false, error: "INVALID_INPUT", message: "to, subject and body_text are required." });
                    }
                    try {
                        const response = await post("/vault/google/gmail/send", { to, subject, body_text }, undefined, SUBJECT_TOKEN, true);
                        log("info", "Gmail sent successfully", { to, message_id: (response as any).message_id });
                        return jsonToolResult({ success: true, message: `✅ Email sent to ${to}`, details: response });
                    } catch (error: any) {
                        const errorMessage = error?.message ?? "Unknown error";
                        log("error", "Gmail send failed", { to, error: errorMessage });
                        if (errorMessage.includes("401")) {
                            return jsonToolResult({ success: false, error: "AUTH_REQUIRED", message: "🔐 Authentication required. Complete Agent-Lock login and retry." });
                        }
                        return jsonToolResult({ success: false, error: "BROKER_FAILED", message: `❌ Failed to send email: ${errorMessage}` });
                    }
                }
                return jsonToolResult({ success: false, error: "UNSUPPORTED_ACTION", message: `Action '${action}' not supported.` });
            },
        });
        log("info", "agent_lock_gmail tool registered (Central)");


        // ── GitHub Central Tool ──────────────────────────────────────────────────
        api.registerTool({
            name: "agent_lock_github",
            label: "Agent-Lock GitHub",
            description: "Interact with GitHub using Agent-Lock Token Vault (secure, audited, brokered)",
            parameters: {
                type: "object",
                properties: {
                    action: { 
                        type: "string", 
                        enum: ["create_issue"], 
                        description: "The GitHub action to perform" 
                    },
                    owner: { type: "string", description: "Repository owner" },
                    repo: { type: "string", description: "Repository name" },
                    title: { type: "string", description: "Issue title (for create_issue)" },
                    body: { type: "string", description: "Issue body (for create_issue)" },
                },
                required: ["action", "owner", "repo"],
            },
            execute: async (_toolCallId: string, params: Record<string, unknown>) => {
                const action = String(params.action || "");
                const owner = String(params.owner || "");
                const repo = String(params.repo || "");
                
                log("info", `GitHub ${action} via Token Vault`, { owner, repo });
                const authMsg = await authInfoMessage("agent_lock_github");
                if (authMsg) return authMsg;

                if (action === "create_issue") {
                    const title = String(params.title || "");
                    const body = String(params.body || "");
                    if (!title) {
                        return jsonToolResult({ success: false, error: "INVALID_INPUT", message: "title is required for create_issue." });
                    }
                    try {
                        const response = await post("/vault/github/issues/create", {
                            owner,
                            repo,
                            title,
                            body,
                        }, undefined, SUBJECT_TOKEN, true);

                        log("info", "GitHub issue created successfully", { issue_url: (response as any).issue_url });
                        return jsonToolResult({
                            success: true,
                            message: `✅ Issue created: ${(response as any).issue_url ?? "created"}`,
                            details: response,
                        });
                    } catch (error: any) {
                        return jsonToolResult({ success: false, error: "BROKER_FAILED", message: `❌ Failed: ${error?.message ?? "unknown"}` });
                    }
                }

                return jsonToolResult({ success: false, error: "UNSUPPORTED_ACTION", message: `Action '${action}' is not yet supported.` });
            },
        });
        log("info", "agent_lock_github tool registered (Central)");


        // ── Slack Central Tool ───────────────────────────────────────────────────
        api.registerTool({
            name: "agent_lock_slack",
            label: "Agent-Lock Slack",
            description: "Interact with Slack using Agent-Lock Token Vault (zero-config)",
            parameters: {
                type: "object",
                properties: {
                    action: { type: "string", enum: ["send_message"], description: "The Slack action to perform" },
                    channel: { type: "string", description: "Channel ID or name" },
                    text: { type: "string", description: "Message text" },
                },
                required: ["action", "channel", "text"],
            },
            execute: async (_toolCallId: string, params: Record<string, unknown>) => {
                const action = String(params.action || "");
                const channel = String(params.channel || "");
                const text = String(params.text || "");

                log("info", `Slack ${action} via Token Vault`, { channel });
                const authMsg = await authInfoMessage("agent_lock_slack");
                if (authMsg) return authMsg;

                if (action === "send_message") {
                    if (!channel || !text) {
                        return jsonToolResult({ success: false, error: "INVALID_INPUT", message: "channel and text are required." });
                    }
                    try {
                        const response = await post("/vault/slack/messages/send", { channel, text }, undefined, SUBJECT_TOKEN, true);
                        log("info", "Slack message sent successfully", { channel });
                        return jsonToolResult({ success: true, message: `✅ Message sent to ${channel}`, details: response });
                    } catch (error: any) {
                        const errorMessage = error?.message ?? "Unknown error";
                        log("error", "Slack send failed", { error: errorMessage });
                        return jsonToolResult({ success: false, error: "BROKER_FAILED", message: `❌ Failed to send message: ${errorMessage}` });
                    }
                }
                return jsonToolResult({ success: false, error: "UNSUPPORTED_ACTION", message: `Action '${action}' not supported.` });
            },
        });
        log("info", "agent_lock_slack tool registered (Central)");


        // ── Calendar Central Tool ────────────────────────────────────────────────
        api.registerTool({
            name: "agent_lock_calendar",
            label: "Agent-Lock Calendar",
            description: "Interact with Google Calendar using Agent-Lock Token Vault (zero-config)",
            parameters: {
                type: "object",
                properties: {
                    action: { type: "string", enum: ["create_event"], description: "The Calendar action to perform" },
                    summary: { type: "string", description: "Event title" },
                    start_time: { type: "string", description: "Start time (ISO 8601)" },
                    end_time: { type: "string", description: "End time (ISO 8601)" },
                    description: { type: "string", description: "Event description" },
                },
                required: ["action", "summary", "start_time", "end_time"],
            },
            execute: async (_toolCallId: string, params: Record<string, unknown>) => {
                const action = String(params.action || "");
                const summary = String(params.summary || "");
                const start_time = String(params.start_time || "");
                const end_time = String(params.end_time || "");
                const description = String(params.description || "");

                log("info", `Calendar ${action} via Token Vault`, { summary });
                const authMsg = await authInfoMessage("agent_lock_calendar");
                if (authMsg) return authMsg;

                if (action === "create_event") {
                    if (!summary || !start_time || !end_time) {
                        return jsonToolResult({ success: false, error: "INVALID_INPUT", message: "summary, start_time and end_time are required." });
                    }
                    try {
                        const response = await post("/vault/google/calendar/events", { summary, start_time, end_time, description }, undefined, SUBJECT_TOKEN, true);
                        log("info", "Calendar event created successfully", { event_link: (response as any).event_link });
                        return jsonToolResult({ success: true, message: `✅ Event created: ${summary}`, details: response });
                    } catch (error: any) {
                        const errorMessage = error?.message ?? "Unknown error";
                        log("error", "Calendar creation failed", { error: errorMessage });
                        return jsonToolResult({ success: false, error: "BROKER_FAILED", message: `❌ Failed to create event: ${errorMessage}` });
                    }
                }
                return jsonToolResult({ success: false, error: "UNSUPPORTED_ACTION", message: `Action '${action}' not supported.` });
            },
        });
        log("info", "agent_lock_calendar tool registered (Central)");

    }
    // ── Intercept tool calls ──────────────────────────────────────────────────
    api.on("before_tool_call", async (event: any) => {
        const toolName: string = event.toolName ?? event.tool_name ?? "unknown";
        // OpenClaw puts args in event.params (confirmed by production testing)
        const args: Record<string, unknown> = event.params ?? event.args ?? {};

        // Debug-only hook trace
        log("debug", "before_tool_call fired", { tool_name: toolName });

        if (toolName === "agent_lock_respond" || toolName === "agent_lock_auth_status" || toolName === "agent_lock_auth_logout" || toolName === "agent_lock_services" || toolName === "agent_lock_provider_status" || toolName === "agent_lock_provider_login" || toolName === "agent_lock_provider_logout" || toolName === "agent_lock_policy") return undefined;


        const sessionKey = sessionOf(event);

        const userIntent = getIntent(sessionKey);

        const rawCommand =
            typeof args.command === "string" ? args.command :
            typeof args.code === "string" ? args.code :
            typeof args.script === "string" ? args.script : undefined;

        log("info", "Tool intercepted", {
            tool_name: toolName,
            session_key: sessionKey,
            plugin_version: PLUGIN_VERSION,
        });

        // Enforce login-first for user-owned provider tools.
        // If logged out, trigger AUTH_REQUIRED (login notification flow) and skip approval flow.
        if (isAuthGatedTool(toolName)) {
            try {
                const me = await get("/auth/me", undefined, SUBJECT_TOKEN) as any;
                const isAuthed = Boolean(me?.authenticated);
                if (!isAuthed) {
                    const authRequired = await post(`/intercept`, {
                        tool_name: toolName,
                        args,
                        user_intent: userIntent,
                        agent_id: "openclaw",
                        session_key: sessionKey,
                        raw_command: rawCommand,
                        subject_token: "",
                    }, undefined, undefined, true);
                    const loginUrl =
                        typeof authRequired?.login_url === "string" && authRequired.login_url.trim().length > 0
                            ? authRequired.login_url
                            : `${activeBackendUrl}/auth/login?subject_token=${encodeURIComponent(SUBJECT_TOKEN || "default")}`;
                    return jsonToolResult({
                        success: true,
                        requires_login: true,
                        message: `🔵 Debes iniciar sesión antes de ejecutar ${toolName}.`,
                        next_step: "Abre login_url, completa login y vuelve a intentar.",
                        login_url: loginUrl,
                    });
                }
            } catch (error: any) {
                const loginUrl = `${activeBackendUrl}/auth/login?subject_token=${encodeURIComponent(SUBJECT_TOKEN || "default")}`;
                log("warn", "Login precheck failed for auth-gated tool", {
                    tool_name: toolName,
                    error: error?.message ?? "unknown",
                });
                return jsonToolResult({
                    success: true,
                    requires_login: true,
                    message: `🔵 No pude confirmar tu sesión para ${toolName}.`,
                    next_step: "Abre login_url, completa login y vuelve a intentar.",
                    login_url: loginUrl,
                });
            }
        }

        let result: any;
        try {
            const interceptStart = Date.now();
            result = await post(`/intercept`, {
                tool_name: toolName,
                args,
                user_intent: userIntent,
                agent_id: "openclaw",
                session_key: sessionKey,
                raw_command: rawCommand,
                subject_token: SUBJECT_TOKEN,
            });
            log("debug", "Intercept response received", {
                tool_name: toolName,
                status: result?.status,
                action_id: result?.action_id,
                latency_ms: Date.now() - interceptStart,
            });
        } catch {
            log("error", "Backend unavailable, fail-closed block", {
                tool_name: toolName,
                session_key: sessionKey,
                plugin_version: PLUGIN_VERSION,
            });
            return { block: true, blockReason: "🦞 Agent-Lock backend unavailable — action blocked (fail-closed)." };
        }

        const { action_id, status, analysis, auth_token } = result;
        let effectiveStatus = status as string;
        log("info", "Intercept decision", {
            action_id,
            tool_name: toolName,
            status: effectiveStatus,
            plugin_version: PLUGIN_VERSION,
        });

        if (effectiveStatus === "AUTH_REQUIRED") {
            const loginUrl =
                typeof result?.login_url === "string" && result.login_url.trim().length > 0
                    ? result.login_url
                    : `${activeBackendUrl}/auth/login`;
            const gateKey = `${toolName}:${action_id}`;
            const now = Date.now();
            const last = authRequiredLogGate.get(gateKey) ?? 0;
            if (now - last >= AUTH_REQUIRED_LOG_COOLDOWN_MS) {
                authRequiredLogGate.set(gateKey, now);
                log("warn", "User authentication required before tool execution", {
                    action_id,
                    tool_name: toolName,
                    plugin_version: PLUGIN_VERSION,
                    login_url: loginUrl,
                });
            }

            // Wait for auth completion for this action before blocking.
            const authResolution = await new Promise<"approved" | "pending" | "timeout">((resolve) => {
                const startedAt = Date.now();
                let polls = 0;
                const fastInterval = Math.max(100, STATUS_POLL_MS);
                let slowMode = false;
                let timer: ReturnType<typeof setInterval> | undefined;

                const stop = (state: "approved" | "pending" | "timeout") => {
                    if (timer) clearInterval(timer);
                    resolve(state);
                };

                const tick = async () => {
                    try {
                        const s = await get(`/status/${action_id}`);
                        if (s.status === "APPROVED" || s.status === "AUTO_APPROVED") {
                            const token = s.auth_token as string | undefined;
                            if (token && typeof token === "string" && token.length > 0) {
                                const params = (event.params ?? event.args ?? {}) as any;
                                const headers = (params.headers ?? {}) as any;
                                headers["Authorization"] = `Bearer ${token}`;
                                params.headers = headers;
                                params.authToken = token;
                                params.auth_token = token;
                                params.access_token = token;
                                params.__agent_lock_token = token;
                                event.params = params;
                            }
                            log("info", "Auth completed; resuming tool call", {
                                action_id,
                                tool_name: toolName,
                                polls,
                            });
                            stop("approved");
                            return;
                        }
                        if (s.status === "PENDING") {
                            log("info", "Auth completed; awaiting user approval", {
                                action_id,
                                tool_name: toolName,
                                polls,
                            });
                            stop("pending");
                            return;
                        }
                    } catch {}

                    polls += 1;
                    if (!slowMode && polls >= 10 && STATUS_POLL_MS < STATUS_POLL_MS_MAX) {
                        slowMode = true;
                        if (timer) clearInterval(timer);
                        timer = setInterval(tick, STATUS_POLL_MS_MAX);
                    }
                    if (Date.now() - startedAt >= AUTH_REQUIRED_WAIT_MS) {
                        log("warn", "Auth wait timeout", {
                            action_id,
                            tool_name: toolName,
                            timeout_ms: AUTH_REQUIRED_WAIT_MS,
                            polls,
                        });
                        stop("timeout");
                    }
                };

                timer = setInterval(tick, fastInterval);
            });

            if (authResolution === "approved") return undefined;
            if (authResolution === "pending") {
                effectiveStatus = "PENDING";
            } else {
                return { block: true, blockReason: "🦞 Agent-Lock: authentication required. Check your secure channel and retry." };
            }
        }

        // If the backend already returned an injectable Auth0 token (AUTO_APPROVED path),
        // attach it to the tool call so downstream integrations (e.g. Gmail) can rely
        // on Agent-Lock-managed authentication instead of their own OAuth plugins.
        if (auth_token && typeof auth_token === "string" && auth_token.length > 0) {
            const token = auth_token;
            const params = (event.params ?? event.args ?? {}) as any;
            const headers = (params.headers ?? {}) as any;

            // Standard Authorization header for HTTP / Gmail-style tools.
            headers["Authorization"] = `Bearer ${token}`;

            // Expose multiple canonical fields for tools that expect a token parameter.
            params.headers = headers;
            params.authToken = token;
            params.auth_token = token;
            params.access_token = token;
            params.__agent_lock_token = token;

            event.params = params;

            log("debug", "Auth token injected", {
                action_id,
                tool_name: toolName,
                source: "AUTO_APPROVED",
            });
        }

        if (effectiveStatus === "AUTO_APPROVED" || effectiveStatus === "APPROVED") return undefined;

        if (effectiveStatus === "PENDING") {
            const decision = await new Promise<"approve" | "deny">((resolve) => {
                pending.set(action_id, resolve);
                let polls = 0;
                const iv = setInterval(async () => {
                    try {
                        const s = await get(`/status/${action_id}`);
                        if (s.status !== "PENDING") {
                            clearInterval(iv);
                            pending.delete(action_id);
                            log("info", "Pending decision resolved", {
                                action_id,
                                tool_name: toolName,
                                final_status: s.status,
                                polls,
                            });
                            // If the action is now approved, inject the token (if any) before resuming.
                            if (s.status === "APPROVED" || s.status === "AUTO_APPROVED") {
                                const token = s.auth_token as string | undefined;
                                if (token && typeof token === "string" && token.length > 0) {
                                    const params = (event.params ?? event.args ?? {}) as any;
                                    const headers = (params.headers ?? {}) as any;

                                    headers["Authorization"] = `Bearer ${token}`;
                                    params.headers = headers;
                                    params.authToken = token;
                                    params.auth_token = token;
                                    params.access_token = token;
                                    params.__agent_lock_token = token;

                                    event.params = params;

                                    log("debug", "Auth token injected", {
                                        action_id,
                                        tool_name: toolName,
                                        source: "APPROVED",
                                    });
                                }
                                resolve("approve");
                            } else {
                                resolve("deny");
                            }
                        }
                    } catch {}
                    polls += 1;

                    // After a few fast polls, back off to reduce load.
                    // (setInterval can't change its delay; this is a best-effort fallback)
                    if (polls === 10 && STATUS_POLL_MS < STATUS_POLL_MS_MAX) {
                        clearInterval(iv);
                        log("debug", "Switching to slower polling cadence", {
                            action_id,
                            from_ms: STATUS_POLL_MS,
                            to_ms: STATUS_POLL_MS_MAX,
                        });
                        const slowIv = setInterval(async () => {
                            try {
                                const s = await get(`/status/${action_id}`);
                                if (s.status !== "PENDING") {
                                    clearInterval(slowIv);
                                    pending.delete(action_id);
                                    log("info", "Pending decision resolved", {
                                        action_id,
                                        tool_name: toolName,
                                        final_status: s.status,
                                        polls,
                                    });
                                    resolve(s.status === "APPROVED" || s.status === "AUTO_APPROVED" ? "approve" : "deny");
                                }
                            } catch {}
                        }, STATUS_POLL_MS_MAX);
                    }
                }, Math.max(100, STATUS_POLL_MS));
            });
            if (decision === "approve") return undefined;
            log("warn", "Tool call blocked after pending flow", {
                action_id,
                tool_name: toolName,
            });
            return { block: true, blockReason: `🦞 Agent-Lock blocked: ${analysis}` };
        }

        log("warn", "Tool call blocked by immediate decision", {
            action_id,
            tool_name: toolName,
            status,
        });
        return { block: true, blockReason: `🦞 Agent-Lock blocked: ${analysis}` };
    });

    // Version banner in blue + backend info
    logBlue(`version v${PLUGIN_VERSION}`);
    log("info", `🦞 Agent-Lock Plugin v${PLUGIN_VERSION} | Backend: ${activeBackendUrl}`);
    if (DASHBOARD_BRIDGE_TOKEN) {
        logBlue(`dashboard channel: ${PREFERRED_CHANNEL} (pairing enabled)`);
    } else {
        logBlue("dashboard channel: not linked (no pairing token)");
    }
    
    // Detailed config in debug mode only
    log("debug", "Plugin configuration", {
        backend_url: activeBackendUrl,
        backend_local_url: LOCAL_BACKEND_URL,
        backend_cloud_url: CLOUD_BACKEND_URL,
        poll_ms: STATUS_POLL_MS,
        poll_ms_max: STATUS_POLL_MS_MAX,
        auth_wait_ms: AUTH_REQUIRED_WAIT_MS,
        log_level: LOG_LEVEL,
    });
}
