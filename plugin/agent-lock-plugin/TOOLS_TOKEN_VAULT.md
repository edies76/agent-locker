# Agent-Lock Token Vault Tools

## Overview

El plugin de Agent-Lock para OpenClaw incluye **tools empoderadas con Token Vault** que proveen capabilities de Gmail, GitHub, Slack y Calendar **sin necesidad de configurar OAuth en cada plugin**.

## Ventajas vs Plugins Tradicionales

| Aspecto | Plugin Tradicional (Gmail/GitHub/Slack) | Agent-Lock Token Vault Tools |
|---------|------------------------------------------|------------------------------|
| **Configuración** | Requiere client_id, client_secret, OAuth flow por plugin | ✅ Zero config - un solo login con Auth0 |
| **Autenticación** | Tokens guardados localmente en configs | ✅ Tokens ephemeral vía Token Vault |
| **Auditoría** | No hay registro centralizado | ✅ Audit trail completo en dashboard |
| **Governance** | Sin validación de risk o intent | ✅ Risk assessment + intent validation |
| **Seguridad** | Tokens persistentes, acceso total | ✅ Scoped + short-lived (1 hora) |
| **Multi-provider** | Configurar OAuth N veces | ✅ Connected accounts centralizadas |

## Tools Disponibles

### 1. `agent_lock_gmail_send`
Envía emails vía Gmail API con Token Vault.

**Parámetros:**
- `to` (string, required): Email del destinatario
- `subject` (string, required): Asunto del email
- `body_text` (string, required): Cuerpo del email (texto plano)
- `body_html` (string, optional): Cuerpo del email (HTML)
- `cc` (string, optional): Destinatarios CC (comma-separated)
- `bcc` (string, optional): Destinatarios BCC (comma-separated)

**Ejemplo de uso:**
```
Usuario: "Envía un email a juan@example.com diciendo que la reunión es mañana"

Agente (OpenClaw):
  - Ve tool: agent_lock_gmail_send
  - Ejecuta: agent_lock_gmail_send(
      to="juan@example.com",
      subject="Reunión mañana",
      body_text="Hola Juan, te recuerdo que la reunión es mañana a las 3pm"
    )

Plugin Agent-Lock:
  - Valida (risk: LOW, intent: OK)
  - Ejecuta vía broker (Token Vault exchange)
  - Devuelve: "✅ Email sent successfully to juan@example.com"
```

---

### 2. `agent_lock_github_create_issue`
Crea issues en GitHub con Token Vault.

**Parámetros:**
- `owner` (string, required): Dueño del repositorio
- `repo` (string, required): Nombre del repositorio
- `title` (string, required): Título del issue
- `body` (string, optional): Cuerpo del issue (markdown)
- `labels` (array, optional): Labels del issue
- `assignees` (array, optional): Usuarios asignados

**Ejemplo de uso:**
```
Usuario: "Crea un issue en microsoft/vscode reportando un bug con el debugger"

Agente:
  agent_lock_github_create_issue(
    owner="microsoft",
    repo="vscode",
    title="Debugger fails on Python 3.12",
    body="### Bug Description\n\nThe debugger crashes when...",
    labels=["bug", "debugger"]
  )

Resultado: "✅ Issue created successfully: https://github.com/microsoft/vscode/issues/12345"
```

---

### 3. `agent_lock_slack_send`
Envía mensajes a Slack con Token Vault.

**Parámetros:**
- `channel` (string, required): Canal de Slack (#general o ID C1234567890)
- `text` (string, required): Texto del mensaje
- `thread_ts` (string, optional): Timestamp del thread (para responder)

**Ejemplo de uso:**
```
Usuario: "Envía un mensaje a #engineering diciendo que el deploy está completo"

Agente:
  agent_lock_slack_send(
    channel="#engineering",
    text="🚀 Deploy to production completed successfully!"
  )

Resultado: "✅ Message sent successfully to #engineering"
```

---

### 4. `agent_lock_calendar_create`
Crea eventos en Google Calendar con Token Vault.

**Parámetros:**
- `summary` (string, required): Título del evento
- `start_time` (string, required): Hora de inicio (ISO 8601)
- `end_time` (string, required): Hora de fin (ISO 8601)
- `description` (string, optional): Descripción del evento
- `location` (string, optional): Ubicación
- `attendees` (array, optional): Emails de invitados

**Ejemplo de uso:**
```
Usuario: "Crea una reunión para mañana a las 3pm con maria@example.com"

Agente:
  agent_lock_calendar_create(
    summary="Sync con María",
    start_time="2026-03-29T15:00:00Z",
    end_time="2026-03-29T16:00:00Z",
    attendees=["maria@example.com"]
  )

Resultado: "✅ Calendar event created successfully: https://calendar.google.com/..."
```

---

## Flujo de Autenticación

### Primera vez (sin auth):

1. **Usuario pide acción** → Agente llama tool
2. **Tool responde:** `AUTH_REQUIRED` con login URL
3. **Usuario hace login** → Auth0 connected account
4. **Usuario retry** → Tool ejecuta exitosamente

### Veces siguientes (con auth):

1. **Usuario pide acción** → Agente llama tool
2. **Tool ejecuta directamente** → Token Vault exchange en background
3. **Resultado inmediato** → Sin pedir login de nuevo

---

## Configuración

### Plugin OpenClaw

Archivo `agent-lock.config.json`:

```json
{
  "backend_url": "http://localhost:8000",
  "subject_token": "eyJhbGc..."  // Tu Auth0 access token (opcional)
}
```

O via environment variable:

```bash
export AGENT_LOCK_SUBJECT_TOKEN="eyJhbGc..."
```

### Backend

Variables en `.env`:

```bash
# Auth0 Token Vault
AUTH0_DOMAIN=tu-tenant.auth0.com
AUTH0_CLIENT_ID=...
AUTH0_CLIENT_SECRET=...
AUTH0_TOKEN_VAULT_ENABLED=true

# Connected Accounts
AUTH0_GOOGLE_CONNECTION_NAME=google-oauth2
AUTH0_GITHUB_CONNECTION_NAME=github
AUTH0_SLACK_CONNECTION_NAME=slack

# Scopes
AUTH0_GOOGLE_SCOPES="https://www.googleapis.com/auth/gmail.send https://www.googleapis.com/auth/calendar"
```

---

## Governance Layer

Todas las tools pasan por el mismo governance layer que el resto de Agent-Lock:

1. **Risk Classification** (LOW/MEDIUM/HIGH)
2. **Intent Validation** (Gemini semantic matching)
3. **Approval Flow** (AUTO_APPROVED, PENDING, DENIED)
4. **Audit Trail** (logged en dashboard)

**Ejemplo de validación:**

```
Usuario: "Envía email a juan@example.com"
Tool: agent_lock_gmail_send(to="juan@example.com", ...)

Backend:
  - Risk: LOW (enviar email es bajo riesgo)
  - Intent: ✓ (user pidió email, tool envía email)
  - Decision: AUTO_APPROVED
  - Execution: Token Vault exchange + Gmail API call
```

---

## Error Handling

Las tools manejan todos los estados posibles:

### AUTH_REQUIRED
```json
{
  "success": false,
  "error": "AUTH_REQUIRED",
  "message": "🔐 Authentication required. Please login with Google: http://...",
  "login_url": "http://localhost:8000/auth/login?connection=google-oauth2"
}
```

### DENIED
```json
{
  "success": false,
  "error": "DENIED",
  "message": "🚫 Action blocked by Agent-Lock: High risk action requires manual approval"
}
```

### SUCCESS
```json
{
  "success": true,
  "message": "✅ Email sent successfully to juan@example.com",
  "message_id": "18d8a1b2c3...",
  "thread_id": "18d8a1b2c3...",
  "action_id": "act_abc123"
}
```

---

## Comparación: Tool Traditional vs Token Vault

### Plugin Gmail Tradicional

```javascript
// OpenClaw config
{
  "gmail": {
    "client_id": "...",
    "client_secret": "...",
    "refresh_token": "..."  // Token persistente en config
  }
}

// Uso
send_email(to="...", subject="...")  // Sin validación, sin audit
```

**Problemas:**
- ❌ Token hardcoded en config
- ❌ Sin audit trail
- ❌ Sin governance
- ❌ Token persistente (mayor riesgo)

### Agent-Lock Token Vault Tool

```javascript
// OpenClaw config
{
  "agent_lock": {
    "backend_url": "http://localhost:8000"
    // Sin tokens hardcoded
  }
}

// Uso
agent_lock_gmail_send(to="...", subject="...")
```

**Ventajas:**
- ✅ Zero config (un solo login)
- ✅ Audit trail completo
- ✅ Governance layer (risk + intent)
- ✅ Tokens ephemeral (1 hora)
- ✅ Broker mode (tokens nunca expuestos)

---

## Demo para Hackathon

**Script recomendado:**

1. **Mostrar OpenClaw tools disponibles:**
   ```
   agent_lock_gmail_send
   agent_lock_github_create_issue
   agent_lock_slack_send
   agent_lock_calendar_create
   ```

2. **Usuario pide:** "Envía un email a demo@example.com"

3. **Plugin responde:** AUTH_REQUIRED con login link

4. **Usuario hace login** con Google (pantalla de Auth0)

5. **Usuario retry:** Email se envía exitosamente

6. **Mostrar dashboard:** Audit log con Token Vault metadata

7. **Explicar ventajas:**
   - "Sin configurar OAuth manualmente"
   - "Tokens ephemeral via Token Vault"
   - "Audit trail completo"
   - "Governance layer automático"

---

## Arquitectura

```
OpenClaw → Plugin Agent-Lock → Backend Agent-Lock → Auth0 Token Vault → Provider API
            ↑                      ↑                    ↑
            Interceptor            Validator            Exchange
            (governance)           (risk+intent)        (user→provider token)
```

**El agente NUNCA ve tokens de Google/GitHub/Slack.**

Solo ve su propio `subject_token` (Auth0 user token), y el backend hace el exchange en su nombre.

---

## Próximos Pasos

- [ ] Configurar Auth0 Connected Accounts (Google, GitHub, Slack)
- [ ] Agregar más tools según necesidad (Calendar list, GitHub PR create, etc)
- [ ] Testing end-to-end con Auth0 real
- [ ] Video demo para hackathon

---

## Referencias

- [Auth0 Token Vault Docs](https://auth0.com/docs/secure/call-apis-on-users-behalf/token-vault)
- [Agent-Lock Architecture](../../ARCHITECTURE.md)
- [Token Vault Strategy](../../TOKEN_VAULT_STRATEGY.md)
