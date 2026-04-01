# 🔍 Diagnóstico: Tools No Se Exponen al Modelo

## ✅ Lo que FUNCIONA:

1. **Plugin se carga correctamente:**
   ```
   [Agent-Lock][INFO] Agent-Lock v1.0.6 loaded
   ```

2. **Tools se registran correctamente:**
   ```
   [Agent-Lock][INFO] agent_lock_gmail_send tool registered (Token Vault)
   [Agent-Lock][INFO] agent_lock_github_create_issue tool registered (Token Vault)
   [Agent-Lock][INFO] agent_lock_slack_send tool registered (Token Vault)
   [Agent-Lock][INFO] agent_lock_calendar_create tool registered (Token Vault)
   ```

3. **El schema es idéntico a agent_lock_respond** (que sí funciona)

---

## ❌ Lo que NO FUNCIONA:

1. **El modelo NO intenta usar nuestras tools**
   - No hay logs de "before_tool_call"
   - No hay logs de "Intent captured"
   - No hay logs de "Tool intercepted"

2. **El agente responde con error de schema**
   - "schema must be object or boolean"
   - Pero ese error NO aparece en logs de OpenClaw
   - Significa que el error ocurre ANTES del plugin

---

## 🧠 Hipótesis Principal:

**OpenClaw NO ESTÁ EXPONIENDO nuestras tools al modelo.**

### Evidencia:

1. **Tools se registran** → `api.registerTool()` se ejecuta sin errores
2. **Tools NO llegan al before_tool_call** → El modelo nunca las intenta usar
3. **agent_lock_respond SÍ funciona** → Usa la misma API de registro

### Posibles causas:

#### A) OpenClaw filtra tools basándose en algún criterio
- ¿Nombre? (agent_lock_* vs agent_lock_respond)
- ¿Descripción?
- ¿Configuración en openclaw.json?

#### B) Tools necesitan declaración explícita
- ¿En openclaw.plugin.json?
- ¿En algún registro central?
- ¿En configuración del agente?

#### C) El modelo (qwen-portal/coder-model) tiene limitaciones
- ¿No soporta custom tools?
- ¿Solo usa "skills" predefinidas?
- ¿Necesita configuración especial?

---

## 🔬 Pruebas Realizadas:

### ✅ Schema Validation
```typescript
// agent_lock_respond (FUNCIONA)
inputSchema: {
  type: "object",
  properties: {
    action_id: { type: "string", description: "..." },
    decision: { type: "string", enum: ["approve", "deny"] }
  },
  required: ["action_id", "decision"]
}

// agent_lock_gmail_send (NO FUNCIONA)
inputSchema: {
  type: "object",
  properties: {
    to: { type: "string", description: "..." },
    subject: { type: "string", description: "..." },
    body_text: { type: "string", description: "..." }
  },
  required: ["to", "subject", "body_text"]
}
```
**Resultado:** Idéntico formato ✅

### ✅ Compilación
- Build exitoso
- No errores TypeScript
- Código compilado correcto

### ✅ Instalación
- Plugin copiado a `.openclaw/extensions/agent-lock/`
- Versión correcta (1.0.6)
- openclaw.json lista el plugin como habilitado

---

## 🎯 Próximos Pasos:

### 1. Investigar OpenClaw internamente
- Buscar source code de OpenClaw
- Ver implementación de `api.registerTool()`
- Entender cómo se exponen tools al modelo

### 2. Comparar con agent_lock_respond
- ¿Por qué esa tool SÍ funciona?
- ¿Hay alguna diferencia que no vemos?
- ¿Se registró de manera especial?

### 3. Probar simplificación extrema
```typescript
api.registerTool({
  name: "test_tool",
  description: "Test",
  inputSchema: {
    type: "object",
    properties: {
      message: { type: "string" }
    },
    required: ["message"]
  },
  handler: async () => ({ success: true })
});
```

### 4. Verificar logs del modelo
- ¿Hay logs de qwen-portal que muestren tools disponibles?
- ¿El modelo recibe la lista de tools?
- ¿Hay un log de "tools registered" a nivel de modelo?

---

## 💡 Teoría Alternativa:

**¿Y si el problema es que necesitamos exponer las tools ANTES de que el modelo se inicialice?**

Posibilidad: Las tools se registran DESPUÉS de que el modelo ya cargó su lista de tools disponibles.

Solución: Registrar tools en el momento correcto del lifecycle del plugin.

---

## 📝 Acción Inmediata:

**Esperar resultados del agente de investigación** que está buscando:
- OpenClaw source code
- Plugin API documentation
- Ejemplos de tools funcionando
- Implementación de registerTool

**Luego decidir:**
- ¿Modificamos el approach?
- ¿Usamos una API diferente?
- ¿Necesitamos configuración adicional?

---

**Status:** Investigando 🔍
**Versión:** 1.0.6
**Última actualización:** 2026-04-01 14:16 UTC
