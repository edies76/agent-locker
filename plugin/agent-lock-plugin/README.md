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

## Connect Dashboard Channel (token-based)

Generate a pairing token in Dashboard (`/plugin`), then link OpenClaw with:

```bash
agent-lock connect-channel
```

Or non-interactive:

```bash
agent-lock connect-channel --token <PAIRING_TOKEN>
```

This command verifies:

1. OpenClaw CLI is installed
2. Agent-Lock plugin is installed and registered
3. Token is accepted by backend heartbeat

After success:

- `agent-lock.config.json` stores `dashboard_bridge_token`
- preferred channel is set to `agentlock_dashboard`
- dashboard should show the pairing as `online` after gateway restart

