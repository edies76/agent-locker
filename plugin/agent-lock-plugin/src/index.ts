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
import pkg from "../package.json";

type AgentLockFileConfig = {
    backend_url?: string;
    status_poll_ms?: number;
    status_poll_ms_max?: number;
    log_level?: string;
    subject_token?: string;
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
let activeBackendUrl = LOCAL_BACKEND_URL;
let cloudFallbackAnnounced = false;

const STATUS_POLL_MS = Number(process.env.AGENT_LOCK_STATUS_POLL_MS ?? FILE_CONFIG.status_poll_ms ?? "500");
const STATUS_POLL_MS_MAX = Number(process.env.AGENT_LOCK_STATUS_POLL_MS_MAX ?? FILE_CONFIG.status_poll_ms_max ?? "2000");
const LOG_LEVEL = (process.env.AGENT_LOCK_LOG_LEVEL ?? FILE_CONFIG.log_level ?? "info").toLowerCase();
const PLUGIN_VERSION = (pkg as { version?: string }).version ?? "unknown";

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

function log(
    level: "debug" | "info" | "warn" | "error",
    message: string,
    context?: Record<string, unknown>,
): void {
    if (!shouldLog(level)) return;
    const suffix = context ? ` | ${JSON.stringify(context)}` : "";
    const line = `[Agent-Lock][${level.toUpperCase()}] ${message}${suffix}`;
    if (level === "warn") {
        console.warn(line);
        return;
    }
    if (level === "error") {
        console.error(line);
        return;
    }
    console.log(line);
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

async function post(url: string, body: unknown, customHeaders?: Record<string, string>) {
    const start = Date.now();
    const extraAuth = process.env.AGENT_LOCK_SUBJECT_TOKEN ?? FILE_CONFIG.subject_token;

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
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        activeBackendUrl = baseUrl;
        return r;
    };

    try {
        const response = await attempt(LOCAL_BACKEND_URL);
        if (cloudFallbackAnnounced) {
            cloudFallbackAnnounced = false;
            log("info", "Local backend recovered", { backend_url: LOCAL_BACKEND_URL });
        }
        log("debug", "HTTP POST completed", {
            url: `${LOCAL_BACKEND_URL}${url}`,
            status: response.status,
            latency_ms: Date.now() - start,
        });
        return response.json();
    } catch (localErr) {
        if (CLOUD_BACKEND_URL === LOCAL_BACKEND_URL) {
            throw localErr;
        }

        const response = await attempt(CLOUD_BACKEND_URL);
        if (!cloudFallbackAnnounced) {
            cloudFallbackAnnounced = true;
            log("warn", "Local backend unavailable, using cloud fallback", {
                local_backend_url: LOCAL_BACKEND_URL,
                cloud_backend_url: CLOUD_BACKEND_URL,
            });
        }
        log("debug", "HTTP POST completed", {
            url: `${CLOUD_BACKEND_URL}${url}`,
            status: response.status,
            latency_ms: Date.now() - start,
        });
        return response.json();
    }
}

async function get(url: string) {
    const start = Date.now();
    const attempt = async (baseUrl: string) => {
        const r = await fetch(`${baseUrl}${url}`);
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        activeBackendUrl = baseUrl;
        return r;
    };

    try {
        const response = await attempt(LOCAL_BACKEND_URL);
        if (cloudFallbackAnnounced) {
            cloudFallbackAnnounced = false;
            log("info", "Local backend recovered", { backend_url: LOCAL_BACKEND_URL });
        }
        log("debug", "HTTP GET completed", {
            url: `${LOCAL_BACKEND_URL}${url}`,
            status: response.status,
            latency_ms: Date.now() - start,
        });
        return response.json();
    } catch (localErr) {
        if (CLOUD_BACKEND_URL === LOCAL_BACKEND_URL) {
            throw localErr;
        }

        const response = await attempt(CLOUD_BACKEND_URL);
        if (!cloudFallbackAnnounced) {
            cloudFallbackAnnounced = true;
            log("warn", "Local backend unavailable, using cloud fallback", {
                local_backend_url: LOCAL_BACKEND_URL,
                cloud_backend_url: CLOUD_BACKEND_URL,
            });
        }
        log("debug", "HTTP GET completed", {
            url: `${CLOUD_BACKEND_URL}${url}`,
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
    // ── Capture user intent from inbound messages ───────────────────────────
    // OpenClaw WhatsApp emits `message_received` with (message, meta)
    try {
        api.on("message_received", (msg: any, meta: any) => {
            const text = msg?.content;
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
            description: "Records the user's decision for a pending Agent-Lock action.",
            inputSchema: {
                type: "object",
                properties: {
                    action_id: { type: "string", description: "ID of the pending action" },
                    decision: { type: "string", enum: ["approve", "deny"] },
                },
                required: ["action_id", "decision"],
            },
            handler: async ({ action_id, decision }: { action_id: string; decision: "approve" | "deny" }) => {
                try {
                    await post(`/approve/${action_id}`, {
                        decision: decision === "approve" ? "YES" : "NO",
                    });
                } catch {}
                const resolve = pending.get(action_id);
                if (resolve) {
                    resolve(decision);
                    pending.delete(action_id);
                    return { success: true, message: decision === "approve" ? "✅ Approved." : "🚫 Blocked." };
                }
                return { success: false, message: "Action not found." };
            },
        });
        log("info", "agent_lock_respond tool registered");

        // ── Token Vault Tools ─────────────────────────────────────────────────────
        // Gmail Send Tool (calls backend broker endpoint)
        api.registerTool({
            name: "agent_lock_gmail_send",
            description: "Send email via Gmail using Agent-Lock Token Vault (zero-config, audited, secure)",
            inputSchema: {
                type: "object",
                properties: {
                    to: { type: "string", description: "Recipient email" },
                    subject: { type: "string", description: "Email subject" },
                    body_text: { type: "string", description: "Email body" },
                },
                required: ["to", "subject", "body_text"],
            },
            handler: async (args: any) => {
                log("info", "Gmail send via Token Vault", { to: args.to, subject: args.subject });
                
                try {
                    const response = await post("/vault/gmail/send", {
                        to: args.to,
                        subject: args.subject,
                        body_text: args.body_text,
                    });
                    
                    log("info", "Gmail sent successfully via Token Vault", { 
                        to: args.to, 
                        message_id: response.message_id 
                    });
                    
                    return {
                        success: true,
                        message: `✅ Email sent to ${args.to} via Agent-Lock Token Vault`,
                        details: response,
                    };
                } catch (error: any) {
                    log("error", "Gmail send failed", { 
                        to: args.to, 
                        error: error.message 
                    });
                    
                    return {
                        success: false,
                        error: "BROKER_FAILED",
                        message: `❌ Failed to send email: ${error.message}`,
                    };
                }
            },
        });
        log("info", "agent_lock_gmail_send tool registered (Token Vault)");

        // GitHub Create Issue Tool
        api.registerTool({
            name: "agent_lock_github_create_issue",
            description: "Create GitHub issue using Agent-Lock Token Vault (zero-config)",
            inputSchema: {
                type: "object",
                properties: {
                    owner: { type: "string", description: "Repository owner" },
                    repo: { type: "string", description: "Repository name" },
                    title: { type: "string", description: "Issue title" },
                },
                required: ["owner", "repo", "title"],
            },
            handler: async (args: any) => {
                log("info", "GitHub issue creation via Token Vault", { owner: args.owner, repo: args.repo });
                
                try {
                    const response = await post("/vault/github/issue", {
                        owner: args.owner,
                        repo: args.repo,
                        title: args.title,
                        body: args.body || "",
                    });
                    
                    log("info", "GitHub issue created successfully", { 
                        issue_url: response.html_url 
                    });
                    
                    return {
                        success: true,
                        message: `✅ Issue created: ${response.html_url}`,
                        details: response,
                    };
                } catch (error: any) {
                    log("error", "GitHub issue creation failed", { error: error.message });
                    
                    return {
                        success: false,
                        error: "BROKER_FAILED",
                        message: `❌ Failed to create issue: ${error.message}`,
                    };
                }
            },
        });
        log("info", "agent_lock_github_create_issue tool registered (Token Vault)");

        // Slack Send Tool
        api.registerTool({
            name: "agent_lock_slack_send",
            description: "Send Slack message using Agent-Lock Token Vault (zero-config)",
            inputSchema: {
                type: "object",
                properties: {
                    channel: { type: "string", description: "Channel ID or name" },
                    text: { type: "string", description: "Message text" },
                },
                required: ["channel", "text"],
            },
            handler: async (args: any) => {
                log("info", "Slack message via Token Vault", { channel: args.channel });
                
                try {
                    const response = await post("/vault/slack/send", {
                        channel: args.channel,
                        text: args.text,
                    });
                    
                    log("info", "Slack message sent successfully", { 
                        channel: args.channel 
                    });
                    
                    return {
                        success: true,
                        message: `✅ Message sent to ${args.channel}`,
                        details: response,
                    };
                } catch (error: any) {
                    log("error", "Slack send failed", { error: error.message });
                    
                    return {
                        success: false,
                        error: "BROKER_FAILED",
                        message: `❌ Failed to send message: ${error.message}`,
                    };
                }
            },
        });
        log("info", "agent_lock_slack_send tool registered (Token Vault)");

        // Calendar Create Tool
        api.registerTool({
            name: "agent_lock_calendar_create",
            description: "Create Google Calendar event using Agent-Lock Token Vault (zero-config)",
            inputSchema: {
                type: "object",
                properties: {
                    summary: { type: "string", description: "Event title" },
                    start_time: { type: "string", description: "Start time (ISO 8601)" },
                    end_time: { type: "string", description: "End time (ISO 8601)" },
                },
                required: ["summary", "start_time", "end_time"],
            },
            handler: async (args: any) => {
                log("info", "Calendar event creation via Token Vault", { summary: args.summary });
                
                try {
                    const response = await post("/vault/calendar/create", {
                        summary: args.summary,
                        start_time: args.start_time,
                        end_time: args.end_time,
                        description: args.description || "",
                    });
                    
                    log("info", "Calendar event created successfully", { 
                        event_link: response.htmlLink 
                    });
                    
                    return {
                        success: true,
                        message: `✅ Event created: ${args.summary}`,
                        details: response,
                    };
                } catch (error: any) {
                    log("error", "Calendar creation failed", { error: error.message });
                    
                    return {
                        success: false,
                        error: "BROKER_FAILED",
                        message: `❌ Failed to create event: ${error.message}`,
                    };
                }
            },
        });
        log("info", "agent_lock_calendar_create tool registered (Token Vault)");
    }
    // ── Intercept tool calls ──────────────────────────────────────────────────
    api.on("before_tool_call", async (event: any) => {
        const toolName: string = event.toolName ?? event.tool_name ?? "unknown";
        // OpenClaw puts args in event.params (confirmed by production testing)
        const args: Record<string, unknown> = event.params ?? event.args ?? {};

        // Log ALL tool calls including agent_lock_* tools
        console.log(`[Agent-Lock][DEBUG] before_tool_call fired: ${toolName}`);

        if (toolName === "agent_lock_respond") return undefined;

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
                subject_token: process.env.AGENT_LOCK_SUBJECT_TOKEN ?? FILE_CONFIG.subject_token,
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
        log("info", "Intercept decision", {
            action_id,
            tool_name: toolName,
            status,
            plugin_version: PLUGIN_VERSION,
        });

        if (status === "AUTH_REQUIRED") {
            const loginUrl =
                typeof result?.login_url === "string" && result.login_url.trim().length > 0
                    ? result.login_url
                    : `${activeBackendUrl}/auth/login`;
            log("warn", "User authentication required before tool execution", {
                action_id,
                tool_name: toolName,
                plugin_version: PLUGIN_VERSION,
                login_url: loginUrl,
            });
            return {
                block: true,
                blockReason: `🦞 Agent-Lock requires user authentication first. Login: ${loginUrl}`,
            };
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

        if (status === "AUTO_APPROVED" || status === "APPROVED") return undefined;

        if (status === "PENDING") {
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

    // Simple version log on startup
    log("info", `Agent-Lock v${PLUGIN_VERSION} loaded`);
    
    // Detailed config in debug mode only
    log("debug", "Plugin configuration", {
        backend_url: activeBackendUrl,
        backend_local_url: LOCAL_BACKEND_URL,
        backend_cloud_url: CLOUD_BACKEND_URL,
        poll_ms: STATUS_POLL_MS,
        poll_ms_max: STATUS_POLL_MS_MAX,
        log_level: LOG_LEVEL,
    });
}
