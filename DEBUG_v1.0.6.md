# 🐛 DEBUG v1.0.6 - Diagnóstico de Schema Error

## ❌ Problema Actual:

Agente dice: "schema must be object or boolean"
Pero en logs de OpenClaw: **NO HAY INTENTO DE USAR LA TOOL**

Esto significa:
- Error ocurre ANTES de que la tool llegue al plugin
- OpenClaw está rechazando la tool por schema inválido
- Necesitamos ver si `before_tool_call` se dispara

---

## 🔍 v1.0.6 - Log de Debug Añadido:

Ahora TODAS las tool calls mostrarán:
```
[Agent-Lock][DEBUG] before_tool_call fired: <tool_name>
```

**Esto nos dirá:**
- ✅ Si la tool llega al plugin → problema en el handler
- ❌ Si la tool NO llega → problema en el schema/registro

---

## 🧪 Test:

1. **REINICIAR OpenClaw gateway** (Ctrl+C → `openclaw gateway`)
2. **Verificar logs de inicio:**
   ```
   [Agent-Lock][INFO] Agent-Lock v1.0.6 loaded
   [Agent-Lock][INFO] agent_lock_gmail_send tool registered (Token Vault)
   ```
3. **Enviar mensaje por WhatsApp:**
   ```
   usa agent_lock_gmail_send para mandarme un mail a edicla9@gmail.com que diga test v1.0.6
   ```

---

## 📊 Escenarios Esperados:

### Escenario A: Tool llega al plugin ✅
```
[Agent-Lock][DEBUG] before_tool_call fired: agent_lock_gmail_send
[Agent-Lock][INFO] Tool intercepted | {...}
```
**Diagnóstico:** Schema OK, problema en ejecución

### Escenario B: Tool NO llega al plugin ❌
```
(solo logs de WhatsApp, ningún log de Agent-Lock)
```
**Diagnóstico:** Schema inválido, OpenClaw rechaza antes del plugin

---

## 🎯 Si es Escenario B (más probable):

**Causa:** OpenClaw valida schema ANTES de registrar la tool

**Solución:** Necesitamos verificar:
1. ¿El inputSchema tiene algún problema?
2. ¿OpenClaw requiere algún campo adicional?
3. ¿Hay un formato específico para custom tools?

---

## 📝 Próximos Pasos:

1. Probar con mensaje por WhatsApp
2. Copiar TODOS los logs de OpenClaw aquí
3. Identificar si es Escenario A o B
4. Ajustar según diagnóstico

**Versión instalada: v1.0.6**
**Archivo: C:\Users\ediva\.openclaw\extensions\agent-lock\index.js**
