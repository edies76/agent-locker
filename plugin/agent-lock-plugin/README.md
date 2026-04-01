# Agent-Lock (OpenClaw plugin)

Install globally:

```bash
npm i -g agent-lock
```

Then install into OpenClaw (auto-connect included):

```bash
agent-lock install
```

`agent-lock install` now does both:

1. Installs plugin into OpenClaw extensions
2. Connects to the official global backend:
   - `https://agent-lock-backend.azurewebsites.net`

Si todo quedó bien verás `connected: true` y el CLI te mostrará:

- `🎉 Felicidades, estás conectado.`
- `openclaw restart`

You can run `agent-lock connect` later to force re-connect to the official backend.

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

