# Agent-Lock (OpenClaw plugin)

Install globally:

```bash
npm i -g @agentlock/agent-lock
```

Then install into OpenClaw (auto-connect included):

```bash
agent-lock install
```

`agent-lock install` now does both:

1. Installs plugin into OpenClaw extensions
2. Connects to the official global backend:
   - `https://agent-lock-backend-api-7.azurewebsites.net`

Si todo quedó bien verás `connected: true` y el CLI te mostrará:

- `🎉 Felicidades, estás conectado.`
- `openclaw restart`

You can run `agent-lock connect` later to force re-connect to the official backend.

Update end-to-end (step by step with versions):

```bash
agent-lock update
```

`agent-lock update` now shows:

1. Current global version
2. Current OpenClaw-installed version
3. npm latest version
4. Step 1: uninstall old extension
5. Step 2: install latest global package
6. Step 3: reinstall extension into OpenClaw
7. Final summary: `old -> new` versions and success/error state

Check status:

```bash
agent-lock status
```

Status should show:

- `installed: true`
- `allowed: true`
- `enabled: true`
- `backend: https://...`

Then restart OpenClaw and run one safe tool call. You should see it in Agent-Lock Dashboard (`/overview`, `/activity`, `/logs`).

