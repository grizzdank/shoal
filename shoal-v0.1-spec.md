# Shoal v0.1 — MVP Specification
**Version:** 0.1.1 | **Date:** 2026-02-13 | **License:** O'Saasy

---

## What It Is

A self-hosted, single-tenant org deployment of OpenClaw with security governance (ARISE) baked in. Clean IP, ARISE-aligned, and built for consulting delivery.

Shoal is **not** a chat app. Users interact through their existing channels (Slack, Discord, Signal, Teams, WhatsApp) via OpenClaw's channel connectors. Shoal is the admin/governance layer that makes OpenClaw deployable, manageable, and auditable for an organization.

## Why It Exists

1. **Clean IP.** We own every line. O'Saasy licensed.
2. **ARISE partnership.** Ed & Graeme (framework authors) need a reference implementation. We're building the first ARISE-aligned platform, together.
3. **Dogfood → consulting.** Internal tool first, then deploy for clients as a consulting engagement.

## What OpenClaw Already Does (We Don't Rebuild)

- ✅ AI agent runtime (model calls, tool execution, sessions, memory)
- ✅ Channel connectors (Slack, Discord, Signal, Teams, WhatsApp, Telegram, webchat)
- ✅ Agent configuration and skills
- ✅ Real-time messaging through channels
- ✅ Node pairing (devices, services)
- ✅ Cron/scheduling

## What Shoal Adds

- 🔒 User & role management (who can access what)
- 🤖 Agent provisioning & lifecycle (create, configure, assign to channels, retire)
- 📋 Governance policies (content filters, tool restrictions, approval gates)
- 📊 Audit trail (every agent action, tool call, cost, reasoning)
- ✅ Approval gates (high-impact actions require human sign-off)
- 🛡️ ARISE control alignment (5 controls for v0.1, more over time)
- 📁 File/document management (org knowledge for agent context)
- 🖥️ Admin dashboard (web UI for all of the above)

---

## Architecture

```
Users on Slack/Discord/Signal/Teams/WhatsApp/etc.
                    ↕
              OpenClaw (pinned)
         agents · channels · tools
                    ↕
               Shoal (governance)
     users · roles · policies · audit
                    ↕
            PostgreSQL + Redis
                    ↕
          Admin Dashboard (Next.js)
```

- **OpenClaw = brain.** Handles all AI reasoning, channel I/O, tool execution.
- **Shoal = org wrapper.** Manages users, governs agent behavior, logs everything.
- **Admin dashboard = control plane.** Web UI for org admins to manage agents, view audit logs, set policies.
- **Single-tenant.** One org per Shoal instance. Multi-org = multiple instances.

---

## v0.1 Scope (90 Days, 2 People)

### Build

| Feature | Details |
|---------|---------|
| **Admin Dashboard** | Next.js web UI for managing the org's Shoal instance |
| **User Management** | Invite users, assign roles (admin/member/viewer), manage permissions |
| **Agent Management** | Create/configure/deploy agents, assign to channels, set tool permissions |
| **Governance Policies** | Content filters (PII, toxicity, blocklists), tool restrictions per agent/role |
| **Approval Gates** | High-impact agent actions require human ✅ before executing |
| **Audit Trail** | Append-only log of all agent actions, tool calls, costs, reasoning |
| **Search** | Hybrid vector + regex search across audit logs and documents (Profundo-style) |
| **File Management** | Upload org documents for agent context (PDF, MD, TXT) |
| **OpenClaw Integration** | Shoal wraps OpenClaw — intercepts agent I/O for governance + logging |
| **Deployment** | Single `docker compose up`. OpenClaw + Shoal + Postgres + Redis. |

### Don't Build

| Killed | Why |
|--------|-----|
| Chat UI | Users stay in Slack/Discord/Signal/etc. OpenClaw handles channels. |
| Socket.io messaging | No chat = no real-time messaging layer needed |
| Channels/DMs/threads | OpenClaw + existing platforms handle this |
| Schema-per-tenant / RLS | Single-tenant. One DB per instance. No isolation complexity. |
| Keycloak / Vault | Auth.js + env vars. 2-person team. |
| K8s / Terraform / Istio | Docker Compose. Period. |
| ELK / Prometheus / Grafana | Structured logging to stdout. |
| Fairlearn / AIF360 | Meaningless for API-based LLMs. |
| LangChain | OpenClaw handles AI orchestration. |
| Rich text editor | Admin dashboard only — standard form inputs. |
| Mobile app | Responsive web dashboard. Users are on mobile via their channels already. |
| Agent-to-agent delegation | v0.2. Get single-agent governance right first. |
| Knowledge Base / RAG | v0.2. File uploads provide raw context for now. |
| Rate limiting | Check if OpenClaw handles this already. Add later if needed. |

---

## Tech Stack

| Layer | Choice | Why |
|-------|--------|-----|
| Monorepo | pnpm workspaces | Shared types between API + dashboard. Turborepo is overkill for 2 people. |
| Backend API | NestJS | Modular, well-structured, good for governance logic |
| API Layer | tRPC | End-to-end type safety |
| ORM | Drizzle | Lightweight, TS-first, great migrations |
| DB | PostgreSQL | Single-tenant, no RLS needed |
| Cache | Redis | Sessions, queues |
| Dashboard | Next.js (App Router) | SSR admin pages, React components |
| Styling | Tailwind + shadcn/ui | Fast, consistent, accessible |
| AI Runtime | OpenClaw (pinned) | The engine. We wrap it, not replace it. |
| Auth | Auth.js | OAuth + email for admin dashboard access |

---

## ARISE Integration (v0.1 — 5 Controls)

Built with Ed & Graeme (framework authors at Assessed Intelligence).

| Control | What We Actually Build |
|---------|----------------------|
| **P.IM (Identity)** | Auth.js with MFA for admin dashboard. Every action tied to authenticated user. |
| **P.AC (Access Control)** | Role-based permissions. Agent tool restrictions per policy. |
| **V.IA (Audit)** | Append-only log of all agent actions, tool calls, reasoning, cost. |
| **G.AC (Accountability)** | Approval gates for high-impact agent actions. Human-in-the-loop. |
| **D.CM (Content Monitoring)** | Input/output filters on agent I/O: PII detection, toxicity, configurable policies. |

---

## Data Model

| Entity | Key Fields |
|--------|-----------|
| **User** | `id`, `email`, `name`, `role` (admin/member/viewer), `auth_provider` |
| **Agent** | `id`, `name`, `system_prompt`, `model`, `channels`, `tool_permissions`, `status` |
| **Policy** | `id`, `type` (content_filter/tool_restriction/approval_required), `rules_json`, `enabled` |
| **AuditEntry** | `id`, `actor_id`, `actor_type` (user/agent), `action`, `detail`, `cost_tokens`, `created_at` |
| **ApprovalRequest** | `id`, `agent_id`, `action_type`, `params`, `state` (pending/approved/rejected/expired), `requested_at`, `decided_by` |
| **Document** | `id`, `filename`, `mime_type`, `size`, `uploaded_by`, `storage_path`, `created_at` |

No `tenant_id` anywhere. Single-tenant. Clean and simple.

---

## OpenClaw Integration Strategy

Shoal registers as an **OpenClaw plugin** using the native Plugin SDK. No fork, no proxy — direct lifecycle hooks.

### Plugin Hooks (confirmed via source code research)

| Hook | Shoal Uses It For |
|------|------------------|
| `message_received` | Inbound content filters — PII detection, toxicity, blocklists |
| `message_sending` | Outbound content filters — can mutate or cancel agent responses |
| `before_tool_call` | Permission checks + approval gates (block execution until human ✅) |
| `after_tool_call` / `tool_result_persist` | Audit logging, cost tracking, result redaction |
| `before_agent_start` | Inject governance context into agent system prompt |

### Agent Configuration

OpenClaw config is file-based (JSON/YAML) but programmable via:
- `openclaw config` CLI for read/write
- Gateway RPC/WebSocket for runtime management

Shoal's admin dashboard uses these to create, modify, and manage agents programmatically.

### Architecture

```
Channels (Signal/Discord/Slack/etc.)
        ↕
   OpenClaw Runtime
   ┌─────────────────────────┐
   │  message_received ←── Shoal Plugin (filter input)
   │  before_agent_start ←── Shoal Plugin (inject governance)
   │  Agent ←→ Model API
   │  before_tool_call ←── Shoal Plugin (permissions + approval gate)
   │  tool_result_persist ←── Shoal Plugin (audit log)
   │  message_sending ←── Shoal Plugin (filter output)
   └─────────────────────────┘
        ↕
   Shoal Admin Dashboard (Next.js)
   ┌─────────────────────────┐
   │  Users · Roles · Policies
   │  Agent Management
   │  Audit Trail Viewer
   │  Approval Queue
   │  Document Uploads
   └─────────────────────────┘
        ↕
   PostgreSQL + Redis
```

---

## Deployment

```yaml
services:
  shoal:
    image: ghcr.io/lfg/shoal:latest
    environment:
      DATABASE_URL: postgres://...
      REDIS_URL: redis://...
      OPENCLAW_URL: http://openclaw:3000
    ports: ["3001:3001"]  # Admin dashboard
  openclaw:
    image: ghcr.io/openclaw/openclaw:latest
    ports: ["3000:3000"]  # OpenClaw webchat + API
  postgres:
    image: postgres:17
  redis:
    image: redis:7-alpine
```

---

## Success Criteria (90 Days)

- [ ] Dave and team use Shoal-managed OpenClaw daily on Poza
- [ ] Agents deployed to 2+ channels (e.g., Signal + Discord) via admin dashboard
- [ ] Audit trail captures every agent action with cost
- [ ] Approval gate blocks a real action and logs the decision
- [ ] Content filter catches PII in agent output
- [ ] Ed/Graeme review and confirm ARISE alignment on 5 controls
- [ ] `docker compose up` works cold on a fresh machine
- [ ] File upload works for providing agent context

---

## What's Next (v0.2+)

- Knowledge Base / RAG (org-scoped, using uploaded documents)
- Agent-to-agent delegation with governance routing
- More ARISE controls (prioritized with Ed & Graeme)
- Analytics dashboard (token cost, agent performance per channel)
- Multi-tenant option (for MSP/consulting scale)
- SSO/SAML (Okta, Azure AD)

---

## Decisions Log

| Decision | Rationale |
|----------|-----------|
| Single-tenant, not multi-tenant | One org per instance. Consulting GTM = separate instance per client. Eliminates RLS complexity entirely. |
| No chat UI | OpenClaw handles channels. Users stay in Slack/Discord/Signal. Shoal is governance + admin. |
| Auth.js, not Keycloak | 2-person team can't ops Keycloak |
| Modular monolith, not microservices | Split when you earn it |
| 5 ARISE controls, not 128 | Framework authors are partners — they help prioritize |
| Direct OpenClaw integration, not LangChain | OpenClaw IS the AI layer. No abstraction on top of abstraction. |
| O'Saasy license | CYA not growth strategy. Clean IP. |
| Dogfood first, sell second | 37signals playbook. |

---

*"Four arms on the keyboard, four arms on the product."* 🐙
