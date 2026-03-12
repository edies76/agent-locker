/**
 * Agent-Lock Plugin — Versión DIAGNÓSTICA con dump completo del evento
 */
import * as fs from "fs";

const BACKEND_URL = process.env.AGENT_LOCK_URL ?? "http://localhost:8000";
const pending = new Map<string, (decision: "approve" | "deny") => void>();
let lastKnownUserMessage = "";
const DUMP_PATH = "C:\\Users\\ediva\\agent-lock-event-dump.json";

function dumpEvent(label: string, data: any) {
    try {
        const entry = `\n\n===== ${label} @ ${new Date().toISOString()} =====\n${JSON.stringify(data, (key, val) => {
            if (typeof val === "function") return "[Function]";
            return val;
        }, 2)}\n`;
        fs.appendFileSync(DUMP_PATH, entry, "utf-8");
    } catch (e) {
        console.log("[Agent-Lock] ⚠️ No se pudo escribir dump:", e);
    }
}

async function callBackend(url: string, opts?: RequestInit) {
    const res = await fetch(url, { headers: { "Content-Type": "application/json" }, ...opts });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
}

function extractUserIntent(event: any): string {
    const candidates = [
        event.userIntent, event.userMessage, event.user_intent, event.user_message,
        event.prompt, event.input, event.message, event.text, event.query,
        event.context?.userMessage, event.context?.lastUserMessage, event.context?.prompt,
        event.conversation?.lastUserMessage, event.conversation?.input,
        event.session?.lastUserMessage,
    ];
    for (const c of candidates) {
        if (typeof c === "string" && c.trim().length > 2) return c.trim();
    }
    return lastKnownUserMessage;
}

const plugin = {
    id: "agent-lock",
    name: "Agent-Lock",
    register(api: any) {

        // Escuchar cualquier evento posible para capturar el mensaje del usuario
        const userEvents = ["user_message", "message", "input", "prompt", "chat_message", "chat:message"];
        for (const evtName of userEvents) {
            try {
                api.on(evtName, async (event: any) => {
                    const msg = event.message ?? event.text ?? event.content ?? event.input ?? "";
                    if (typeof msg === "string" && msg.trim().length > 2) {
                        lastKnownUserMessage = msg.trim();
                        console.log(`[Agent-Lock] 📝 Intent capturado via '${evtName}': "${lastKnownUserMessage.slice(0, 60)}"`);
                        dumpEvent(`USER_EVENT:${evtName}`, event);
                    }
                    return undefined;
                });
            } catch { /* evento no soportado */ }
        }

        api.on("before_tool_call", async (event: any) => {
            const toolName = event.toolName ?? event.tool_name ?? event.tool ?? "unknown";
            const args     = event.args ?? event.arguments ?? event.params ?? event.input ?? {};

            // ── DUMP COMPLETO del evento ────────────────────────────────────────
            dumpEvent(`TOOL_CALL:${toolName}`, {
                toolName,
                args,
                raw_event_keys: Object.keys(event),
                full_event: event,
            });
            console.log(`[Agent-Lock] 🔍 Tool: ${toolName} | Args keys: [${Object.keys(args).join(", ")}] | Intent: "${(extractUserIntent(event)).slice(0, 50)}"`);

            if (toolName === "agent_lock_respond") return undefined;

            const userIntent = extractUserIntent(event);
            
            // Intentar reconstruir el comando desde cualquier lugar del evento
            const rawCommand =
                args.command ?? args.code ?? args.script ?? args.query ??
                args.statement ?? args.expression ?? args.shell ??
                (typeof args === "string" ? args : null);

            let interceptResult: any;
            try {
                interceptResult = await callBackend(`${BACKEND_URL}/intercept`, {
                    method: "POST",
                    body: JSON.stringify({
                        tool_name: toolName,
                        args: typeof args === "object" ? args : { raw: args },
                        user_intent: userIntent || "",
                        agent_id: event.agentId ?? event.agent_id ?? "openclaw",
                        session_key: event.sessionKey ?? event.session_key,
                        raw_command: rawCommand,
                    }),
                });
            } catch {
                console.warn("[Agent-Lock] ⚠️ Backend no disponible — dejando pasar:", toolName);
                return undefined;
            }

            const { action_id, status, analysis } = interceptResult;

            if (status === "AUTO_APPROVED" || status === "APPROVED") return undefined;

            if (status === "PENDING") {
                const decision = await new Promise<"approve" | "deny">((resolve) => {
                    pending.set(action_id, resolve);
                    const interval = setInterval(async () => {
                        try {
                            const s = await callBackend(`${BACKEND_URL}/status/${action_id}`);
                            if (s.status !== "PENDING") {
                                clearInterval(interval);
                                pending.delete(action_id);
                                resolve(s.status === "APPROVED" || s.status === "AUTO_APPROVED" ? "approve" : "deny");
                            }
                        } catch {}
                    }, 2000);
                });
                return decision === "approve"
                    ? undefined
                    : { block: true, blockReason: `🦞 Agent-Lock bloqueó: ${analysis}` };
            }

            return { block: true, blockReason: `🦞 Agent-Lock bloqueó: ${analysis}` };
        });

        console.log(`🦞 Agent-Lock activo | Dump en: ${DUMP_PATH}`);
    },
};

export default plugin;
