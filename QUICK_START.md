# ⚡ INSTRUCCIONES RÁPIDAS - Token Vault Testing

## ✅ Plugin YA ESTÁ ACTUALIZADO

El plugin con las tools Token Vault corregidas ya está instalado en:
`C:\Users\ediva\.openclaw\extensions\agent-lock\`

**Timestamp:** 31/03/2026 22:59:08

---

## 🔄 PASO 1: REINICIAR OPENCLAW

**En la terminal de OpenClaw:**
```
Ctrl+C
```

**Luego:**
```
openclaw gateway
```

---

## 👀 PASO 2: VERIFICAR LOGS

**Debes ver en los logs:**
```
[Agent-Lock][INFO] agent_lock_respond tool registered
[Agent-Lock][INFO] agent_lock_gmail_send tool registered (Token Vault-powered)
[Agent-Lock][INFO] agent_lock_github_create_issue tool registered (Token Vault-powered)
[Agent-Lock][INFO] agent_lock_slack_send tool registered (Token Vault-powered)
[Agent-Lock][INFO] agent_lock_calendar_create tool registered (Token Vault-powered)
```

Si ves estas 5 líneas → ✅ Plugin cargado correctamente

---

## 📧 PASO 3: PROBAR EMAIL

**Envía vía WhatsApp:**
```
Usa agent_lock_gmail_send para enviar email a edicla9@gmail.com con subject "Test" y body "Hola desde Token Vault"
```

---

## 🎯 QUÉ VA A PASAR:

### Escenario A: Tool se ejecuta (placeholder)
```
[Agent-Lock][INFO] Token Vault tool invoked: agent_lock_gmail_send
```
El agente responderá:
```
❌ Token Vault tools must be called through backend broker endpoints, not directly.
```

**Esto significa:** La tool se registró OK pero es un placeholder.

### Escenario B: Plugin intercepta ANTES
```
[Agent-Lock][INFO] Intercepting tool call | {"tool_name":"agent_lock_gmail_send",...}
```

**Esto es lo ideal:** El plugin interceptó antes de que se ejecute el placeholder.

---

## 🐛 SI NO FUNCIONA:

### 1. Verificar que OpenClaw cargó el plugin actualizado
Busca en los logs del gateway las 5 líneas de "tool registered"

### 2. Verificar timestamp del archivo
```powershell
Get-Item "$env:USERPROFILE\.openclaw\extensions\agent-lock\index.js" | Select-Object LastWriteTime
```
Debe ser: `3/31/2026 10:59:08 PM` o más reciente

### 3. Verificar backend está corriendo
```powershell
Test-NetConnection -ComputerName localhost -Port 8000
```

---

## 🔧 PARA FUTURAS ACTUALIZACIONES:

**Si haces cambios al plugin, ejecuta:**
```powershell
cd C:\nueva-carpeta\agent-lock\plugin\agent-lock-plugin
.\update-local.ps1
```

Esto hace:
1. Build del plugin
2. Copia a OpenClaw extensions
3. Muestra archivos actualizados

**Luego reinicia OpenClaw gateway.**

---

## ✅ RESUMEN:

1. ✅ Plugin actualizado con fix de schema
2. ✅ Copiado a OpenClaw extensions
3. ⏳ REINICIAR OpenClaw gateway
4. ⏳ Verificar logs muestran 5 tools
5. ⏳ Probar con `agent_lock_gmail_send`

**Todo listo para testing. Solo falta que reinicies OpenClaw!** 🚀
