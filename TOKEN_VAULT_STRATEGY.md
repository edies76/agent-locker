# Token Vault Strategy: El Problema y La Solución

## El Problema Fundamental

### ¿Por qué Token Vault no funciona con tools existentes?

Cuando un agente (como OpenClaw) usa plugins tradicionales de Gmail, GitHub, o Slack, estos plugins **ya tienen su propia gestión de OAuth**:

```
OpenClaw + Gmail Plugin:
  ├─ Plugin tiene configurado: client_id, client_secret, access_token
  ├─ Agente llama: gmail_send(to="...", subject="...")
  └─ Plugin usa su token internamente y llama Gmail API
```

**Agent-Lock intercepta la llamada**, pero:
- ❌ Solo ve: `tool_name="gmail_send"` y `args={...}`
- ❌ NO ve el token (está dentro del plugin)
- ❌ NO puede aplicar Token Vault (el plugin ya autenticó)
- ❌ Token Vault queda como "feature decorativa"

### El problema de autenticación distribuida

En un setup tradicional:
```
Plugins individuales manejan sus propios tokens:
  ├─ Gmail Plugin → tiene token de Google
  ├─ GitHub Plugin → tiene token de GitHub  
  ├─ Slack Plugin → tiene token de Slack
  └─ Agent-Lock → solo audita, no controla tokens
```

**Resultado:** Token Vault no agrega valor porque los tokens ya están en los plugins.

---

## La Solución: Agent-Lock como Proveedor Único de Tools

### Cambio de paradigma

En lugar de que Agent-Lock sea un "auditor pasivo", se convierte en el **proveedor activo de capabilities**:

```
OpenClaw → Agent-Lock MCP Server → Agent-Lock Backend + Token Vault → External APIs
```

### Arquitectura propuesta

```
┌─────────────────────────────────────────────────────────────────┐
│  OPENCLAW (Agente)                                               │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  1. Plugin Agent-Lock (governance layer)                  │  │
│  │     - Intercepta TODAS las tool calls                     │  │
│  │     - Envía a backend para validación                     │  │
│  │     - Maneja AUTH_REQUIRED, PENDING, DENIED               │  │
│  └──────────────────────────────────────────────────────────┘  │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  2. MCP Server Client (conectado a Agent-Lock MCP)       │  │
│  │     - Provee tools "empoderadas" con Token Vault          │  │
│  │     - agent_lock__gmail_send                              │  │
│  │     - agent_lock__github_create_issue                     │  │
│  │     - agent_lock__slack_send_message                      │  │
│  └──────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────────┐
│  AGENT-LOCK MCP SERVER                                           │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  Management Tools (exposed vía MCP protocol)              │  │
│  │  - agent_lock__vault_gmail_send                           │  │
│  │  - agent_lock__vault_github_create_issue                  │  │
│  │  - agent_lock__vault_slack_send                           │  │
│  │  - agent_lock__vault_calendar_create_event                │  │
│  │                                                            │  │
│  │  Estas tools llaman a broker endpoints del backend        │  │
│  └──────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────────┐
│  AGENT-LOCK BACKEND                                              │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  Broker Endpoints (/vault/*)                              │  │
│  │  1. Reciben llamada con subject_token del usuario         │  │
│  │  2. Llaman Token Vault exchange:                          │  │
│  │     Auth0 user token → Provider token (Google/GitHub/etc) │  │
│  │  3. Ejecutan acción en provider API server-side           │  │
│  │  4. Devuelven resultado (SIN exponer provider token)      │  │
│  └──────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────────┐
│  AUTH0 TOKEN VAULT                                               │
│  - Exchange: user access_token → provider access_token          │
│  - Connected accounts: Google, GitHub, Slack                     │
│  - Scoped, short-lived tokens (1 hour típicamente)              │
└─────────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────────┐
│  EXTERNAL APIS (Gmail, GitHub, Slack, Calendar)                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## Roles de cada componente

### 1. Plugin Agent-Lock (OpenClaw)
**Responsabilidad:** Governance layer - interceptar y validar

**Qué hace:**
- Intercepta TODAS las tool calls del agente (sin importar el origen)
- Envía a backend `/intercept` para validación de riesgo + intent
- Maneja respuestas:
  - `AUTH_REQUIRED` → Notifica usuario vía Telegram con login URL
  - `PENDING` → Notifica usuario para aprobación manual
  - `AUTO_APPROVED` → Permite ejecución
  - `DENIED` → Bloquea ejecución
- **NO ejecuta tools** - solo audita y valida

**Configuración:**
```json
{
  "backend_url": "http://localhost:8000",
  "telegram_bot_token": "...",
  "telegram_chat_id": "..."
}
```

### 2. MCP Server Agent-Lock
**Responsabilidad:** Tool provider - exponer capabilities con Token Vault

**Qué hace:**
- Expone tools vía MCP protocol
- Tools disponibles para el agente:
  - `agent_lock__vault_gmail_send` - Enviar emails
  - `agent_lock__vault_github_create_issue` - Crear issues en GitHub
  - `agent_lock__vault_slack_send_message` - Enviar mensajes a Slack
  - `agent_lock__vault_calendar_create_event` - Crear eventos en Calendar
- Cada tool llama a broker endpoint del backend
- Pasa `subject_token` del usuario automáticamente

**Configuración:**
```json
{
  "backend_url": "http://localhost:8000",
  "subject_token": "eyJhbGc..."  // Auth0 user access token
}
```

### 3. Backend Agent-Lock
**Responsabilidad:** Orchestrator - validación, Token Vault exchange, API calls

**Qué hace:**
- **Intercept endpoint** (`/intercept`):
  - Risk classification (LOW/MEDIUM/HIGH)
  - Intent validation con Gemini
  - Provider detection (Gmail, GitHub, Slack)
  - Auth requirement detection
  
- **Broker endpoints** (`/vault/*`):
  - `/vault/google/gmail/send` - Enviar email vía Gmail API
  - `/vault/github/issues/create` - Crear issue vía GitHub API
  - `/vault/slack/message/send` - Enviar mensaje vía Slack API
  - `/vault/google/calendar/create` - Crear evento vía Calendar API
  
- **Token Vault integration**:
  - Exchange: Auth0 user token → Provider token
  - Grant type: `federated-connection-access-token`
  - Tokens NUNCA se exponen al agente
  - Execution server-side con tokens ephemeral

---

## Flujo Completo: Usuario → Resultado

### Escenario: "Envía un email a juan@example.com"

```
[1] Usuario en chat de OpenClaw:
    "Envía un email a juan@example.com diciendo que la reunión es mañana"

[2] OpenClaw (agente Claude):
    - Ve tool disponible: agent_lock__vault_gmail_send
    - Decide usarla: agent_lock__vault_gmail_send(
        to="juan@example.com",
        subject="Reunión mañana",
        body_text="..."
      )

[3] Plugin Agent-Lock intercepta:
    - Captura: tool_name, args, user_intent
    - POST /intercept al backend
    - Payload: {
        tool_name: "agent_lock__vault_gmail_send",
        args: {...},
        user_intent: "Envía un email...",
        subject_token: null  // Primera vez, no hay token aún
      }

[4] Backend (intercept.py):
    - Risk: LOW (enviar email es bajo riesgo)
    - Intent match: ✓ (user pidió email, tool es email)
    - Requires auth: ✓ (provider tool detectado)
    - subject_token: null → AUTH_REQUIRED
    - Response: {
        status: "AUTH_REQUIRED",
        login_url: "http://localhost:8000/auth/login?connection=google-oauth2"
      }

[5] Plugin recibe AUTH_REQUIRED:
    - Envía notificación Telegram:
      "🔐 Se requiere autenticación para agent_lock__vault_gmail_send
       Click aquí para conectar tu cuenta de Google: [link]"
    - Tool call queda pausado

[6] Usuario hace click en link:
    - Abre navegador → Auth0 login
    - Conecta cuenta de Google
    - Acepta permisos: Gmail send
    - Auth0 callback → Backend guarda access_token en sesión
    - Cookie: agent_lock_session=xyz...

[7] Usuario en Telegram o chat:
    "Retry" / "Intenta de nuevo"

[8] Plugin retry con auth:
    - Extrae subject_token de cookie/sesión
    - POST /intercept con subject_token presente
    - Backend: AUTO_APPROVED (LOW risk + auth OK)
    - Response: { status: "AUTO_APPROVED", auth_token: null }
      (auth_token null porque es broker mode)

[9] MCP tool ejecuta:
    - agent_lock__vault_gmail_send se ejecuta
    - Llama a: POST /vault/google/gmail/send
    - Headers: Authorization: Bearer {subject_token}
    - Body: { to: "...", subject: "...", body_text: "..." }

[10] Backend broker endpoint:
     - Extrae subject_token del header
     - Llama Token Vault exchange:
       POST https://tenant.auth0.com/oauth/token
       {
         grant_type: "urn:auth0:params:oauth:grant-type:token-exchange:federated-connection-access-token",
         subject_token: "eyJhbGc...",  // User token
         connection: "google-oauth2"
       }
     - Auth0 responde: { access_token: "ya29.a0..." }  // Google token
     - Backend construye email MIME
     - POST https://gmail.googleapis.com/gmail/v1/users/me/messages/send
       Headers: Authorization: Bearer ya29.a0...
     - Gmail API responde: { id: "18d8a1b...", threadId: "..." }
     - Backend responde al MCP: { ok: true, message_id: "18d8a1b..." }

[11] MCP tool devuelve resultado al agente:
     "Email enviado exitosamente. Message ID: 18d8a1b..."

[12] OpenClaw responde al usuario:
     "✓ He enviado el email a juan@example.com sobre la reunión de mañana."
```

---

## Diferencia Clave: Plugin vs MCP

### Plugin Agent-Lock
- **Rol:** Interceptor / Auditor
- **Actúa sobre:** TODAS las tools del agente (sin importar origen)
- **Propósito:** Governance layer (validar risk, intent, auth)
- **NO ejecuta actions** - solo aprueba/rechaza

### MCP Server Agent-Lock
- **Rol:** Tool Provider
- **Expone:** Tools específicas con Token Vault integration
- **Propósito:** Proveer capabilities seguras (Gmail, GitHub, Slack)
- **SÍ ejecuta actions** - vía broker endpoints

### ¿Por qué necesitas ambos?

**Sin plugin:** No hay governance layer
- Agente podría llamar tools sin validación
- No hay approval flow ni audit trail
- No hay protección contra misuse

**Sin MCP server:** No hay Token Vault integration
- Tendrías que usar plugins tradicionales (cada uno con su OAuth)
- Token Vault quedaría sin uso
- No hay centralización de autenticación

**Con ambos:**
- Plugin audita TODAS las tools (governance)
- MCP provee tools empoderadas con Token Vault
- Flujo completo: validation + secure execution + audit

---

## Ventajas de esta arquitectura

### 1. Centralización de autenticación
- Usuario solo autentica UNA VEZ con Auth0
- Connected accounts manejadas por Token Vault
- No más N plugins con N OAuth configs

### 2. Zero-trust for agents
- Agente NUNCA ve provider tokens
- Tokens solo viven en backend (ephemeral)
- Broker mode: backend ejecuta, agente solo ve resultados

### 3. Governance completo
- Toda tool call pasa por validation
- Risk assessment + intent matching
- Audit trail de TODAS las acciones

### 4. Hackathon-ready
- ✅ Auth0 Token Vault integration real
- ✅ Connected accounts (Google, GitHub, Slack)
- ✅ Federated token exchange
- ✅ Broker mode (tokens never exposed)
- ✅ Audit + governance layer

---

## Próximos pasos para implementación

### 1. Agregar tools al MCP server
- [x] `agent_lock__vault_gmail_send` (ya existe)
- [x] `agent_lock__vault_github_create_issue` ✅
- [x] `agent_lock__vault_slack_send_message` ✅
- [x] `agent_lock__vault_calendar_create_event` ✅

### 2. Agregar broker endpoints al backend
- [x] `/vault/google/gmail/send` (ya existe)
- [x] `/vault/github/issues/create` ✅
- [x] `/vault/slack/messages/send` ✅
- [x] `/vault/google/calendar/events` ✅

### 3. Agregar tools al Plugin OpenClaw
- [x] `agent_lock_gmail_send` ✅
- [x] `agent_lock_github_create_issue` ✅
- [x] `agent_lock_slack_send` ✅
- [x] `agent_lock_calendar_create` ✅

### 3. Configurar Auth0 Connected Accounts
- [ ] Google OAuth (Gmail + Calendar)
- [ ] GitHub OAuth
- [ ] Slack OAuth

### 4. Testing end-to-end
- [ ] OpenClaw + Plugin + MCP configurados
- [ ] Usuario autentica con Auth0
- [ ] Tool call → Token Vault exchange → API call
- [ ] Verificar audit trail completo

### 5. Demo para hackathon
- [ ] Video mostrando flow completo
- [ ] Dashboard con Token Vault status
- [ ] Audit logs mostrando Token Vault metadata
- [ ] Documentación del patrón arquitectónico

---

## Conclusión

**Token Vault no es opcional en Agent-Lock - es el core.**

La propuesta transforma Agent-Lock de un "auditor pasivo" a un "proveedor activo de capabilities seguras", donde Token Vault es el mecanismo central de autenticación.

Esto hace que Agent-Lock sea útil de verdad, no solo un wrapper decorativo.
