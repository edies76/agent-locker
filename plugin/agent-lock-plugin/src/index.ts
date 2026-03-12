/**
 * Agent-Lock Plugin para OpenClaw
 *
 * NOTA SOBRE USER INTENT:
 * El evento before_tool_call de OpenClaw solo contiene { toolName, params }.
 * El mensaje del usuario NO es parte del evento. Intentamos capturarlo
 * registrando handlers para todas las variantes posibles de eventos de mensaje.
 */

const BACKEND_URL = process.env.AGENT_LOCK_URL ?? "http://localhost:8000";

// Cache: sesión → último mensaje del usuario
const intentCache = new Map<string, string>();
let intentGlobal = ""; // Fallback sin sessionKey

function store(key: string, msg: string) {
    if (!msg || msg.trim().length < 3) return;
    const clean = msg.trim();
    intentCache.set(key, clean);
    intentGlobal = clean;
    console.log(`[Agent-Lock] 📝 Intent capturado: "${clean.slice(0, 80)}"`);
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

// ── Extrae sessionKey de un contexto de evento ────────────────────────────────
function sessionOf(ctx: any): string {
    return ctx?.sessionKey ?? ctx?.session_key ?? ctx?.sessionId ??
           ctx?.session?.id ?? ctx?.session?.key ?? "default";
}

// ── Extrae texto de un objeto de mensaje ─────────────────────────────────────
function bodyOf(msg: any): string {
    if (!msg) return "";
    if (typeof msg === "string") return msg;
    return msg.body ?? msg.text ?? msg.content ?? msg.message ?? msg.input ?? "";
}

export default function register(api: any) {

    // ── Estrategia 1: api.onMessage (SDK oficial) ────────────────────────────
    if (typeof api.onMessage === "function") {
        api.onMessage((ctx: any) => {
            store(sessionOf(ctx), bodyOf(ctx.message ?? ctx));
        });
        console.log("[Agent-Lock] ✅ api.onMessage OK");
    }

    // ── Estrategia 2: api.on con múltiples nombres de evento ─────────────────
    const msgEvents = [
        "message", "user_message", "chat_message", "chat:message",
        "input", "user_input", "prompt", "before_completion",
        "before_model_call", "on_message", "incoming_message",
    ];
    for (const evtName of msgEvents) {
        try {
            api.on(evtName, (ctx: any) => {
                const text = bodyOf(ctx?.message ?? ctx?.input ?? ctx);
                if (text) {
                    store(sessionOf(ctx), text);
                    console.log(`[Agent-Lock] ✅ Evento '${evtName}' recibido`);
                }
                return undefined;
            });
        } catch { /* evento no soportado */ }
    }

    // ── Estrategia 3: api.registerPlugin con before_prompt_build ────────────
    // Según los docs, este hook tiene ctx.session.messages[] con el historial
    if (typeof api.registerPlugin === "function") {
        api.registerPlugin({
            id: "agent-lock",
            name: "Agent-Lock",
            hooks: {
                before_prompt_build: async (ctx: any) => {
                    const messages: any[] = ctx?.session?.messages ?? ctx?.messages ?? [];
                    const lastUser = [...messages]
                        .reverse()
                        .find((m: any) => m.role === "user" || m.type === "user");
                    const text = bodyOf(lastUser ?? null);
                    store(sessionOf(ctx), text);
                    return undefined; // no modifica el prompt
                },
                before_model_call: async (ctx: any) => {
                    const messages: any[] = ctx?.messages ?? ctx?.session?.messages ?? [];
                    const lastUser = [...messages]
                        .reverse()
                        .find((m: any) => m.role === "user");
                    const text = bodyOf(lastUser ?? null);
                    store(sessionOf(ctx), text);
                    return undefined;
                },
            },
        });
        console.log("[Agent-Lock] ✅ api.registerPlugin OK (before_prompt_build hook activo)");
    } else {
        console.log("[Agent-Lock] ⚠️ api.registerPlugin no disponible en esta versión de OpenClaw");
    }

    // ── Estrategia 4: tool de respuesta manual ───────────────────────────────
    if (typeof api.registerTool === "function") {
        api.registerTool({
            name: "agent_lock_respond",
            description: "Registra la decisión del usuario para una acción pendiente de Agent-Lock.",
            inputSchema: {
                type: "object",
                properties: {
                    action_id: { type: "string", description: "ID de la acción pendiente" },
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
                    return { success: true, message: decision === "approve" ? "✅ Aprobado." : "🚫 Bloqueado." };
                }
                return { success: false, message: "Acción no encontrada." };
            },
        });
        console.log("[Agent-Lock] ✅ tool agent_lock_respond registrada");
    }

    // ── Interceptar tool calls ────────────────────────────────────────────────
    api.on("before_tool_call", async (event: any) => {
        const toolName: string = event.toolName ?? event.tool_name ?? "unknown";
        // OpenClaw pone los args en event.PARAMS (confirmado por dump)
        const args: Record<string, unknown> = event.params ?? event.args ?? {};

        if (toolName === "agent_lock_respond") return undefined;

        const sessionKey = sessionOf(event);
        const userIntent = getIntent(sessionKey);

        const rawCommand =
            typeof args.command === "string" ? args.command :
            typeof args.code === "string" ? args.code :
            typeof args.script === "string" ? args.script : undefined;

        console.log(
            `[Agent-Lock] 🔍 ${toolName}(${(rawCommand ?? JSON.stringify(args)).slice(0, 80)}) ` +
            `| intent: "${userIntent.slice(0, 60)}"`
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
            console.warn(`[Agent-Lock] ⚠️ Backend no disponible — dejando pasar: ${toolName}`);
            return undefined;
        }

        const { action_id, status, analysis } = result;
        console.log(`[Agent-Lock] → ${status} | ${String(analysis).slice(0, 80)}`);

        if (status === "AUTO_APPROVED" || status === "APPROVED") return undefined;

        if (status === "PENDING") {
            const decision = await new Promise<"approve" | "deny">((resolve) => {
                pending.set(action_id, resolve);
                const iv = setInterval(async () => {
                    try {
                        const s = await get(`${BACKEND_URL}/status/${action_id}`);
                        if (s.status !== "PENDING") {
                            clearInterval(iv);
                            pending.delete(action_id);
                            resolve(s.status === "APPROVED" || s.status === "AUTO_APPROVED" ? "approve" : "deny");
                        }
                    } catch {}
                }, 2000);
            });
            if (decision === "approve") return undefined;
            return { block: true, blockReason: `🦞 Agent-Lock bloqueó: ${analysis}` };
        }

        return { block: true, blockReason: `🦞 Agent-Lock bloqueó: ${analysis}` };
    });

    console.log("🦞 Agent-Lock activo | backend=" + BACKEND_URL);
}
