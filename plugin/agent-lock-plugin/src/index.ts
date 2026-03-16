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

const BACKEND_URL = process.env.AGENT_LOCK_URL ?? "http://localhost:8000";

const STATUS_POLL_MS = Number(process.env.AGENT_LOCK_STATUS_POLL_MS ?? "500");
const STATUS_POLL_MS_MAX = Number(process.env.AGENT_LOCK_STATUS_POLL_MS_MAX ?? "2000");

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

async function post(url: string, body: unknown) {
    const r = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
    });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return r.json();
}

async function get(url: string) {
    const r = await fetch(url);
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return r.json();
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

                if (storedPrimary) {
                    console.log(`[Agent-Lock] 📝 Intent captured: "${text.slice(0, 80)}"`);
                } else if (storedFallback) {
                    console.log(`[Agent-Lock] 📝 Intent captured: "${text.slice(0, 80)}"`);
                }
            }
            return undefined;
        });
    } catch {
        // If this OpenClaw build doesn't support the event, intent capture falls back to defaults.
    }

    // ── Strategy 4: manual response tool ──────────────────────────────────────
    if (typeof api.registerTool === "function") {
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
                    await post(`${BACKEND_URL}/approve/${action_id}`, {
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
        console.log("[Agent-Lock] ✅ agent_lock_respond tool registered");
    }

    // ── Intercept tool calls ──────────────────────────────────────────────────
    api.on("before_tool_call", async (event: any) => {
        const toolName: string = event.toolName ?? event.tool_name ?? "unknown";
        // OpenClaw puts args in event.params (confirmed by production testing)
        const args: Record<string, unknown> = event.params ?? event.args ?? {};

        if (toolName === "agent_lock_respond") return undefined;

        const sessionKey = sessionOf(event);

        const userIntent = getIntent(sessionKey);

        const rawCommand =
            typeof args.command === "string" ? args.command :
            typeof args.code === "string" ? args.code :
            typeof args.script === "string" ? args.script : undefined;

        const intentPreview = userIntent
            ? `"${userIntent.slice(0, 60)}"`
            : "(not captured — Gemini semantic validation will be skipped)";

        console.log(
            `[Agent-Lock] 🔍 ${toolName}(${(rawCommand ?? JSON.stringify(args)).slice(0, 80)}) ` +
            `| intent: ${intentPreview}`
        );

        let result: any;
        try {
            result = await post(`${BACKEND_URL}/intercept`, {
                tool_name: toolName,
                args,
                user_intent: userIntent,
                agent_id: "openclaw",
                session_key: sessionKey,
                raw_command: rawCommand,
            });
        } catch {
            console.warn(`[Agent-Lock] ⚠️ Backend unavailable — skipping check: ${toolName}`);
            return undefined;
        }

        const { action_id, status, analysis } = result;
        console.log(`[Agent-Lock] → ${status} | ${String(analysis).slice(0, 80)}`);

        if (status === "AUTO_APPROVED" || status === "APPROVED") return undefined;

        if (status === "PENDING") {
            const decision = await new Promise<"approve" | "deny">((resolve) => {
                pending.set(action_id, resolve);
                let polls = 0;
                const iv = setInterval(async () => {
                    try {
                        const s = await get(`${BACKEND_URL}/status/${action_id}`);
                        if (s.status !== "PENDING") {
                            clearInterval(iv);
                            pending.delete(action_id);
                            resolve(s.status === "APPROVED" || s.status === "AUTO_APPROVED" ? "approve" : "deny");
                        }
                    } catch {}
                    polls += 1;

                    // After a few fast polls, back off to reduce load.
                    // (setInterval can't change its delay; this is a best-effort fallback)
                    if (polls === 10 && STATUS_POLL_MS < STATUS_POLL_MS_MAX) {
                        clearInterval(iv);
                        const slowIv = setInterval(async () => {
                            try {
                                const s = await get(`${BACKEND_URL}/status/${action_id}`);
                                if (s.status !== "PENDING") {
                                    clearInterval(slowIv);
                                    pending.delete(action_id);
                                    resolve(s.status === "APPROVED" || s.status === "AUTO_APPROVED" ? "approve" : "deny");
                                }
                            } catch {}
                        }, STATUS_POLL_MS_MAX);
                    }
                }, Math.max(100, STATUS_POLL_MS));
            });
            if (decision === "approve") return undefined;
            return { block: true, blockReason: `🦞 Agent-Lock blocked: ${analysis}` };
        }

        return { block: true, blockReason: `🦞 Agent-Lock blocked: ${analysis}` };
    });

    console.log("🦞 Agent-Lock active | backend=" + BACKEND_URL);
}
