# Agent-Lock Stabilization Roadmap

Status: Draft for execution before new features
Date: 2026-03-23

## Objective
Ship a stable, external-friendly baseline with clear architecture boundaries, predictable operations, and observable logs.

## Scope Boundary
In scope:
- Reliability and startup consistency
- Documentation and onboarding clarity
- Dashboard clarity for operators
- Log quality and triage speed

Out of scope:
- New product features not required for stability
- New provider integrations

## Workstreams

### 1) Architecture and Docs Hardening
Goal: Make component boundaries explicit for external teams.

Tasks:
- Keep README as entrypoint with explicit integration modes.
- Keep MCP and OpenClaw docs separate and cross-linked.
- Add operator runbook with startup order and smoke checks.
- Add troubleshooting matrix for top 10 failure modes.

Exit criteria:
- A new user can run backend + one integration mode in under 20 minutes.
- No ambiguity about MCP Gateway vs OpenClaw Plugin responsibilities.

### 2) Dashboard as Single Source of Truth
Goal: Operators can diagnose state from dashboard without reading code.

Tasks:
- Show component status cards: backend, MCP gateway, OpenClaw plugin heartbeat.
- Show timing and overhead metrics for recent actions.
- Add detail view sections: request, decision, execution, timings, errors.
- Add setup and architecture page for external onboarding.

Exit criteria:
- Operator can answer: what failed, where, and when from dashboard only.

### 3) Logging and Observability
Goal: Fast triage with consistent structured logs.

Tasks:
- Structured logs in plugin with level control and context.
- Correlation fields across logs: action_id, session_key, tool_name.
- Standardize backend log lines by lifecycle stage.
- Define log retention and redaction policy.

Exit criteria:
- One failing action can be traced end-to-end in under 2 minutes.

### 4) Runtime Stability and Hygiene
Goal: Fewer environment-related incidents.

Tasks:
- Canonical startup scripts for Windows and CI.
- Health checks for backend and gateway connectivity.
- Ensure generated artifacts are ignored and untracked.
- Add restart and recovery commands to runbook.

Exit criteria:
- Clean git status during normal dev.
- Repeatable start/stop without manual cleanup.

## Priority Backlog
P0:
- Docs split and onboarding clarity
- Structured plugin logs with level control
- Dashboard timing visibility

P1:
- Runbook and troubleshooting matrix
- Status cards for each component
- Correlation-id consistency across backend and plugin logs

P2:
- Exportable incident bundle (recent logs + action detail)
- SLO metrics and alert thresholds

## Suggested Milestones
- Milestone A (1-2 days): P0 complete and verified
- Milestone B (2-4 days): P1 complete with smoke test checklist
- Milestone C (1 week): P2 operational polish

## Verification Checklist
- Backend starts and serves health endpoint.
- Selected integration mode starts and intercepts a read-only action.
- Dashboard records the action with timing data.
- HIGH-risk action enters approval flow and resolves correctly.
- Audit log contains signed entry for resolved actions.
- Plugin logs include action_id and session context at info level.
