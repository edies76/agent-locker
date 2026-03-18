# 📄 PRODUCT REQUIREMENTS DOCUMENT (PRD)
## Agent-Lock: The Governance Layer for AI Agents

**Document Status:** Draft  
**Version:** 1.0  
**Date:** March 11, 2026  

---

## 1. Executive Summary

**Product Name:** Agent-Lock  
**Tagline:** "The guardian that makes AI agents trustworthy"  

**One-line description:** A security middleware that sits between AI agents and their tools to validate intentions, manage tokens securely, and enforce human approval for risky actions.

### The Problem
AI agents (like OpenClaw) have access to sensitive systems but lack understanding of context, risk, and user intent. They can delete databases, expose secrets, or be manipulated—all with good intentions but disastrous results.

### The Solution
Agent-Lock intercepts every action an agent attempts, validates it against the user's original intent, secures tokens via Auth0 Token Vault, and requests human approval when actions are risky or don't match what the user asked for.

---

## 2. Problem Statement

### Current Reality
- AI agents execute commands literally without understanding context
- Users give agents broad permissions (API keys, tokens) that can be misused
- No system validates if an agent's intended action matches what the user actually meant
- Critical mistakes happen silently and irreversibly

### Recent Evidence
A March 7, 2026 study showed autonomous agents:
- Leaked sensitive data when asked to "forward" instead of "share"
- Deleted entire email servers trying to "protect" a single secret
- Fell into 9-day resource-consuming loops
- Were manipulated through emotional pressure

Existing solutions (like ClawBands) only ask "execute this?" without understanding context. No universal governance layer exists for AI agents.

---

## 3. Target Users

### Primary: Individual Developers
- Use OpenClaw or similar agents for personal projects
- Want automation without risking their data or systems
- Technical but not security experts

### Secondary: Development Teams
- Multiple developers using agents in shared environments
- Need audit trails and policy enforcement
- Concerned about compliance (SOC2, ISO27001)

### Tertiary: Enterprises (future)
- Deploy agents at scale
- Require governance, access control, and risk management
- Will pay for enterprise features

---

## 4. User Personas

| Persona | Description | Pain Points | Goals |
|---|---|---|---|
| Dev Diego | Solo developer, uses OpenClaw for coding help | Afraid agent will delete production data | Safe automation without constant watching |
| Tech Lead Tanya | Leads 10 devs, all using agents | No visibility into what agents do | Audit logs and policy enforcement |
| CTO Carlos | Makes purchasing decisions | Compliance requirements for agent usage | Enterprise-ready security controls |

---

## 5. Product Vision

Agent-Lock will become the standard governance layer for AI agents—the trusted middleware that every agent uses to interact safely with the world. Just as OAuth became the standard for user authentication, Agent-Lock will become the standard for agent authorization and intent validation.

---

## 6. Core Features (MVP)

### Feature 1: Token Isolation via Auth0 Token Vault
- Agent NEVER has direct access to tokens
- All tokens stored encrypted in Auth0 Token Vault
- Tokens requested only when needed, with minimum scope
- Tokens expire immediately after use

### Feature 2: Intent Validation Engine
- Captures user's original instruction
- Captures agent's intended action
- Compares semantic meaning
- Flags mismatches for review

### Feature 3: Risk Classification
- Classifies actions as LOW, HIGH, or CRITICAL
- LOW: Auto-execute (read-only, safe operations)
- HIGH: Ask for approval (modifications, deletions)
- CRITICAL: Always ask with warning (destructive, production changes)

### Feature 4: Human Approval System
- Sends notifications via Telegram/WhatsApp/SMS
- Shows clear explanation of what will happen
- Provides Approve/Deny buttons
- Includes context (what user said vs what agent will do)

### Feature 5: Audit Logging
- Records every intercepted action
- Logs decisions (approved/denied)
- Immutable logs for compliance
- Timestamp and agent ID

---

## 7. User Flow

1. User gives instruction to agent
2. Agent decides what to do (calls a tool)
3. Agent-Lock intercepts (preToolExecution hook)
4. Intent Validation Engine analyzes match
5. Risk Classification determines risk level
6. If LOW risk → Auto-execute with scoped token
7. If HIGH/CRITICAL → Send notification to user
8. User approves/denies
9. If approved: Get token from Auth0 Vault → Execute → Token expires
10. If denied: Block execution → Log decision

---

## 8. Use Cases

### Use Case 1: Safe Database Optimization
**User says:** "Optimize the database, identify bottlenecks and eliminate them"  
**Agent intends:** DROP TABLE logs_antiguos  

Agent-Lock:
- Detects mismatch (35% match)
- Classifies as CRITICAL
- Notifies user: "You said optimize, but agent wants to DELETE a table. Sure?"
- User says NO

**Outcome:** Data saved

### Use Case 2: Production Code Change
**User says:** "Increase MAX_CONNECTIONS to 500 in config.py and push to main"  
**Agent intends:** Edit file + push to production  

Agent-Lock:
- Validates match (95% match)
- Classifies as HIGH (production change)
- Notifies user with diff preview
- User approves

**Outcome:** Change executed safely

### Use Case 3: Secret Exposure Attempt
**User says:** "Show me all API keys in the codebase"  
**Agent intends:** grep -r "API_KEY" .  

Agent-Lock:
- Detects sensitive operation
- Classifies as CRITICAL
- Notifies user with warning
- User denies

**Outcome:** Secrets protected

---

## 9. Constraints & Assumptions

### Constraints
- Must use Auth0 Token Vault (hackathon requirement)
- Initial version only for OpenClaw
- Must work with existing OpenClaw architecture

### Assumptions
- OpenClaw's preToolExecution hook works reliably
- Users have Telegram/WhatsApp for notifications
- Local validation engine is fast enough

---

## 10. Future Roadmap

| Phase | Features |
|---|---|
| MVP (Hackathon) | OpenClaw plugin + Auth0 Vault + Intent validation + Telegram notifications |
| Phase 2 | **MCP Server for Claude/ChatGPT** + Web dashboard + Policy engine |
| Phase 3 | Enterprise features: SSO, compliance reports, team management |
| Phase 4 | AI-powered alternative suggestions + Anomaly detection |

---

## 10.5. MCP Integration: Agent-Lock for Claude & ChatGPT

### What is MCP?

**MCP (Model Context Protocol)** is an open standard created by Anthropic for connecting AI assistants to external tools and data sources. It solves the "N×M" integration problem by providing a universal protocol.

Key concepts:
- **MCP Server**: Exposes tools, resources, and prompts to AI clients
- **MCP Client**: Claude Desktop, ChatGPT, or any AI application that connects to MCP servers
- **Tool**: A function the AI can call (e.g., `read_file`, `execute_command`, `query_database`)

### The Opportunity

Claude Desktop and ChatGPT now support MCP servers. Users can connect these AI assistants to local tools (filesystem, databases, APIs) without custom integrations.

**Problem**: These tools have the same risks as OpenClaw agents—destructive operations, secret exposure, unintended actions.

**Solution**: Agent-Lock as an **MCP Gateway/Proxy** that intercepts tool calls before they reach the actual servers.

### Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     USER'S COMPUTER                          │
│                                                              │
│  ┌──────────────┐     ┌─────────────────────────────────┐   │
│  │ Claude       │     │     Agent-Lock MCP Server       │   │
│  │ Desktop /    │────▶│  ┌─────────────────────────┐    │   │
│  │ ChatGPT      │     │  │ Risk Classification     │    │   │
│  └──────────────┘     │  │ Intent Validation       │    │   │
│                       │  │ Approval (Telegram)     │    │   │
│                       │  └──────────┬──────────────┘    │   │
│                       │             │                    │   │
│                       │  ┌──────────▼──────────────┐    │   │
│                       │  │ Allow / Block / Pending │    │   │
│                       │  └──────────┬──────────────┘    │   │
│                       └─────────────┼────────────────────┘   │
│                                     │                        │
│                       ┌─────────────▼────────────────────┐   │
│                       │      Target MCP Servers         │   │
│                       │  ┌────────┐ ┌────────┐ ┌─────┐ │   │
│                       │  │Filesys.│ │GitHub  │ │DB   │ │   │
│                       │  └────────┘ └────────┘ └─────┘ │   │
│                       └─────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

### How It Works

1. User configures Claude Desktop to use Agent-Lock as an MCP server
2. Agent-Lock proxies all tool calls to other MCP servers (filesystem, GitHub, etc.)
3. Before each tool call:
   - Risk classification (LOW/HIGH/CRITICAL)
   - Intent validation (if user message available)
   - Approval request via Telegram for HIGH/CRITICAL
4. Tool call is allowed, blocked, or pending approval

### Implementation Plan

| Step | Description |
|---|---|
| 1 | Create MCP Server skeleton in Python using `mcp` SDK |
| 2 | Implement tool proxy pattern (receive → validate → forward) |
| 3 | Reuse existing backend: risk classifier, intent validator, Telegram bot |
| 4 | Add configuration for target MCP servers (filesystem, GitHub, etc.) |
| 5 | Package as installable MCP server for Claude Desktop |
| 6 | Document setup: Claude Desktop config, Telegram setup, policies |

### Benefits

- **Same governance layer** for Claude, ChatGPT, and OpenClaw
- **One approval flow** (Telegram) for all AI assistants
- **Unified audit log** across platforms
- **Consistent risk policies** regardless of which AI is used

### Technical Notes

- MCP uses JSON-RPC 2.0 over stdio or SSE
- Tools are defined with JSON Schema for input validation
- Agent-Lock MCP Server will expose the same tools as target servers, but wrapped with validation
- For Claude Desktop: config in `claude_desktop_config.json`

---

## 11. Extensions to the Vision: Dashboard + Activity Summary (Proposed)

To ensure Agent-Lock is a **governance layer** (not just a prompt blocker), a Dashboard/Web App should be part of the roadmap.

### Goals
- Provide a **clear summary of what the agent did** during a session (or over time)
- Offer **visibility**, **auditability**, and **policy tuning** without reading raw logs

### Proposed Dashboard Features

- **Activity Timeline**
  - Chronological list of intercepted actions
  - Filter by risk level, tool, agent, date

- **Session Summary / Recap**
  - "What happened" summary per session
  - Counts: auto-approved vs approved vs blocked
  - Highlight contradictions detected by intent engine

- **Approval Inbox**
  - Pending approvals in one place
  - Quick approve/deny with reason

- **Policy Management UI**
  - Enable/disable policies
  - Edit thresholds for escalation
  - Add allowlists for safe commands

- **Audit Log Viewer (Signed)**
  - Browse signed JSONL events
  - Verify signatures / integrity status
  - Export logs for compliance

- **Anomaly Insights (Future)**
  - Detect unusual sequences (loops, repeated failures)
  - Detect “tool drift” (agent doing actions unrelated to user intent)

### API Hooks Needed (Future)
- `GET /audit/recent` (already possible via `read_logs()`)
- `GET /sessions/{id}/summary` (aggregate recent actions)
- `GET /pending` (list pending approvals)
- Optional: `POST /policies` for dynamic policy updates
