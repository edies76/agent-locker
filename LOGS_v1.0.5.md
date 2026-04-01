# 🎯 Nuevos Logs v1.0.5 - Clean & Simple

## ✅ Al iniciar OpenClaw gateway verás:

```
[Agent-Lock][INFO] Agent-Lock v1.0.5 loaded
[Agent-Lock][INFO] agent_lock_respond tool registered
[Agent-Lock][INFO] agent_lock_gmail_send tool registered (Token Vault)
[Agent-Lock][INFO] agent_lock_github_create_issue tool registered (Token Vault)
[Agent-Lock][INFO] agent_lock_slack_send tool registered (Token Vault)
[Agent-Lock][INFO] agent_lock_calendar_create tool registered (Token Vault)
```

**Eso es todo.** Limpio, claro, con la versión.

---

## 📊 Configuración detallada (solo en modo debug)

Para ver detalles como backend_url, poll_ms, etc:
```
AGENT_LOCK_LOG_LEVEL=debug
```

En modo `info` (default) → solo logs importantes

---

## 🔄 Sistema de Auto-Versionado

**Cada vez que ejecutes:**
```powershell
.\update-local.ps1
```

**Se auto-incrementa la versión:**
```
📈 Auto-incrementing version...
  1.0.4 → 1.0.5
```

**Ya no necesitas recordar cambiar package.json manualmente.**

---

## 📋 Resumen de cambios:

1. ✅ Log de inicio con versión clara
2. ✅ Logs de herramientas simplificados
3. ✅ Auto-incremento de versión en cada update
4. ✅ Config detallada solo en debug mode
5. ✅ Versión actual: **1.0.5**

---

## 🚀 Siguiente paso:

**REINICIAR OpenClaw y verificar que aparezcan esos 6 logs limpios.**

Si ves esos logs → Todo funciona correctamente.
