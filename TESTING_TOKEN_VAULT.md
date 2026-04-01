# 🚀 Testing Agent-Lock Token Vault Tools - ACTUALIZADO

## ⚠️ CRÍTICO: Plugin Actualizado (31/03/2026 22:48)

### Problema Anterior:
- ❌ Error "schema must be object or boolean"
- ❌ Herramientas duplicadas (cada una registrada 2 veces)
- ❌ Sin logs en terminal OpenClaw

### Solución Aplicada:
- ✅ Tools simplificadas a placeholders
- ✅ Eliminadas duplicaciones
- ✅ Schema corregido
- ✅ Logs agregados cuando se invocan

---

## 🔄 PASO 1: REINICIAR OPENCLAW (OBLIGATORIO)

**El plugin ha sido actualizado pero OpenClaw necesita reiniciarse:**

```powershell
# En la terminal de OpenClaw:
Ctrl+C

# Luego:
openclaw gateway
```

**Deberías ver en los logs:**
```
[Agent-Lock][INFO] agent_lock_respond tool registered
[Agent-Lock][INFO] agent_lock_gmail_send tool registered (Token Vault-powered)
[Agent-Lock][INFO] agent_lock_github_create_issue tool registered (Token Vault-powered)
[Agent-Lock][INFO] agent_lock_slack_send tool registered (Token Vault-powered)
[Agent-Lock][INFO] agent_lock_calendar_create tool registered (Token Vault-powered)
```

---

## 📊 PASO 2: PROBAR LA TOOL

### Opción A: Comando Explícito (RECOMENDADO)
```
Usa la tool agent_lock_gmail_send con:
- to: edicla9@gmail.com
- subject: Test desde Agent-Lock
- body_text: Hola, esto es una prueba
```

### Opción B: Natural Language
```
Envíame un email a edicla9@gmail.com que diga "Hola desde Token Vault"
```

---

## 🔍 QUÉ ESPERAR:

### Si las tools están correctamente registradas:

**1. El agente VERÁ la tool y la intentará usar**

**2. Dos posibles flujos:**

#### A) Tool se ejecuta directamente (placeholder):
```
[Agent-Lock][INFO] Token Vault tool invoked: agent_lock_gmail_send
```
Respuesta:
```
❌ Token Vault tools must be called through backend broker endpoints, not directly.
This is a placeholder for tool discovery.
```

#### B) Plugin intercepta ANTES de ejecutar:
```
[Agent-Lock][INFO] Intercepting tool call | {"tool_name":"agent_lock_gmail_send",...}
[Agent-Lock][INFO] Decision received | {"status":"AUTO_APPROVED",...}
```

**El flujo B es el correcto para Token Vault.**

---

## 🎯 OBJETIVO ACTUAL:

**Verificar que:**
1. ✅ Tools se registran sin error de schema
2. ✅ El agente puede VER y ELEGIR usar las tools
3. ✅ Aparecen logs en la terminal de OpenClaw
4. ✅ El plugin intercepta la llamada ANTES de ejecutar

**Una vez confirmado esto, podemos:**
- Implementar la ejecución real vía broker endpoints
- O hacer que before_tool_call redirija a los broker endpoints

---

## 🐛 Si Sigue Sin Funcionar:

### 1. Verificar que el plugin se copió:
```powershell
Get-Item "C:\Users\ediva\.openclaw\extensions\agent-lock\index.js" | Select-Object LastWriteTime
```
Debe mostrar: `3/31/2026 10:48:19 PM` o más reciente

### 2. Verificar que OpenClaw cargó el nuevo plugin:
Busca en los logs del gateway las 5 líneas de "tool registered"

### 3. Verificar que el backend está corriendo:
```powershell
Test-NetConnection -ComputerName localhost -Port 8000
```

### 4. Probar con tool explícita:
```
Llama a la tool agent_lock_gmail_send
```

---

## 📝 NOTA IMPORTANTE:

**Las tools ahora son placeholders simples.** Su propósito es:
1. Aparecer en la lista de tools disponibles del modelo
2. Ser interceptadas por `before_tool_call` 
3. El interceptor debe redirigir al broker endpoint

**Esto es intencional** para evitar el error de schema y permitir que el agente las vea.

---

## ✅ Próximos Pasos Después de Verificar:

Si las tools se registran y el agente las ve:
1. Implementar redirección de `before_tool_call` → broker endpoints
2. O hacer que los handlers llamen directamente a los broker endpoints
3. Agregar logs detallados en cada paso

**Primero necesitamos confirmar que las tools se registran correctamente.**
