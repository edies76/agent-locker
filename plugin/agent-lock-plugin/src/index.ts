/**
 * Agent-Lock Plugin para OpenClaw
 * Usa el SDK oficial: api.on("before_tool_call") + api.registerTool()
 *
 * Flujo:
 *  LOW risk   → AUTO-APROBADO (pasa sin interrumpir)
 *  HIGH/CRITICAL → Bloquea, backend notifica en Telegram/WhatsApp,
 *                  agente espera hasta que el usuario responda
 *                  (vía botones Telegram o tool agent_lock_respond)
 */

const BACKEND_URL = process.env.AGENT_LOCK_URL ?? "http://localhost:8000";

// Mapa de promesas pendientes: action_id → resolver
const pending = new Map<string, (decision: "approve" | "deny") => void>();

async function callBackend(url: string, opts?: RequestInit) {
    const res = await fetch(url, {
        headers: { "Content-Type": "application/json" },
        ...opts,
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
}

async function pollStatus(actionId: string, intervalMs = 2000, maxAttempts = 150) {
    for (let i = 0; i < maxAttempts; i++) {
        await new Promise((r) => setTimeout(r, intervalMs));
        // Primero, revisar si el Promise fue resuelto localmente (agent_lock_respond)
        // (ya estaría resuelto, no llegaríamos aquí)
        try {
            const s = await callBackend(`${BACKEND_URL}/status/${actionId}`);
            if (s.status !== "PENDING") return s;
        } catch {
            // backend busy, reintentar
        }
    }
    return null; // timeout
}

// ── Plugin ────────────────────────────────────────────────────────────────────

const plugin = {
    id: "agent-lock",
    name: "Agent-Lock",
    description:
        "Governance layer: intercepta tool calls, analiza con Gemini Flash, " +
        "y pide aprobación humana para acciones HIGH/CRITICAL.",

    register(api: {
        on: (event: string, handler: (e: any) => Promise<any>) => void;
        registerTool?: (spec: {
            name: string;
            description: string;
            inputSchema: object;
            handler: (args: any) => Promise<any>;
        }) => void;
    }) {
        // ── 1. Registrar tool de respuesta (canal OpenClaw/WhatsApp) ───────────────
        // Cuando el usuario responde en el chat y el agente llama este tool,
        // resolvemos la promesa pendiente y la acción original se ejecuta o bloquea.
        if (api.registerTool) {
            api.registerTool({
                name: "agent_lock_respond",
                description:
                    "Registra la decisión del usuario para una acción pendiente en Agent-Lock. " +
                    "Llama este tool cuando el usuario haya respondido SÍ o NO. " +
                    "Parámetros: action_id (string), decision ('approve' | 'deny').",
                inputSchema: {
                    type: "object",
                    properties: {
                        action_id: { type: "string", description: "ID de la acción pendiente" },
                        decision: {
                            type: "string",
                            enum: ["approve", "deny"],
                            description: "Decisión del usuario",
                        },
                    },
                    required: ["action_id", "decision"],
                },
                handler: async ({ action_id, decision }: { action_id: string; decision: "approve" | "deny" }) => {
                    const resolve = pending.get(action_id);
                    if (resolve) {
                        resolve(decision);
                        pending.delete(action_id);
                        return {
                            success: true,
                            message: decision === "approve" ? "✅ Acción aprobada." : "🚫 Acción bloqueada.",
                        };
                    }
                    return { success: false, message: "No se encontró acción pendiente con ese ID." };
                },
            });
        }

        // ── 2. Interceptar TODOS los tool calls ───────────────────────────────────
        api.on("before_tool_call", async (event) => {
            const toolName: string = event.toolName;
            const args: Record<string, unknown> = event.args ?? {};

            // Dejar pasar el tool de respuesta sin análisis
            if (toolName === "agent_lock_respond") return undefined;

            // ── Llamar al backend ──────────────────────────────────────────────────
            let interceptResult: any;
            try {
                interceptResult = await callBackend(`${BACKEND_URL}/intercept`, {
                    method: "POST",
                    body: JSON.stringify({
                        tool_name: toolName,
                        args,
                        user_intent: event.userIntent ?? "[sesión OpenClaw]",
                        agent_id: event.agentId ?? "openclaw",
                    }),
                });
            } catch {
                // Backend no disponible → fail-open (no interrumpir al agente)
                console.warn("[Agent-Lock] ⚠️ Backend no disponible — dejando pasar:", toolName);
                return undefined;
            }

            const { action_id, status, risk_level, analysis } = interceptResult;
            console.log(`[Agent-Lock] ${toolName} → ${status} (${risk_level})`);

            // ── AUTO_APPROVED (LOW risk) ───────────────────────────────────────────
            if (status === "AUTO_APPROVED" || status === "APPROVED") {
                return undefined;
            }

            // ── PENDING: esperar decisión ──────────────────────────────────────────
            if (status === "PENDING") {
                // Estrategia dual:
                // A) El backend ya notificó por Telegram con botones inline
                // B) El agente puede preguntar al usuario en el chat y llamar agent_lock_respond
                //    → resuelve la promesa local sin esperar polling

                const decision = await new Promise<"approve" | "deny">((resolve) => {
                    pending.set(action_id, resolve);

                    // Racing: polling del backend (por si el usuario respondió en Telegram)
                    pollStatus(action_id).then((finalStatus) => {
                        if (!pending.has(action_id)) return; // ya fue resuelto localmente
                        pending.delete(action_id);
                        if (!finalStatus || finalStatus.status === "BLOCKED") {
                            resolve("deny");
                        } else {
                            resolve("approve");
                        }
                    });
                });

                if (decision === "approve") return undefined;
                return {
                    block: true,
                    blockReason: `🦞 Agent-Lock: acción bloqueada por el usuario. ${analysis}`,
                };
            }

            // ── BLOCKED directo ───────────────────────────────────────────────────
            return {
                block: true,
                blockReason: `🦞 Agent-Lock bloqueó: ${analysis}`,
            };
        });

        console.log("🦞 Agent-Lock activo — monitoreando todos los tool calls de OpenClaw");
    },
};

export default plugin;
