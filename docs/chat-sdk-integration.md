# Shoal + Vercel Chat SDK — Architecture Evolution

**Date:** 2026-02-24 | **Status:** Exploration
**Trigger:** [Vercel Chat SDK launch](https://vercel.com/changelog/chat-sdk) (Feb 23, 2026)

---

## Executive Brief

The current Shoal v0.1 spec wraps OpenClaw as its AI runtime and channel layer. But OpenClaw is explicitly designed as a **single-user, multi-agent personal assistant** — one user, their agents, their workspace. Shoal's vision is a **multi-user, multi-agent org governance layer**. This is a fundamental mismatch.

Vercel's new Chat SDK (`npm i chat`) provides the multi-channel plumbing (Slack, Teams, Discord, Google Chat, GitHub, Linear) as a lightweight library, not an opinionated runtime. Combined with a minimal agent core built on the Pi/AI SDK ecosystem, Shoal can own its full stack without fighting OpenClaw's single-user assumptions around auth, sessions, memory, and permissions.

---

## The Problem with OpenClaw as Foundation

| OpenClaw Assumption | Shoal Needs |
|---|---|
| Single user (Dave) owns all agents | Multiple org users, each with different permissions |
| Sessions belong to one person | Sessions belong to users, teams, or org-scoped agents |
| Memory is personal workspace | Memory is org-scoped, access-controlled, auditable |
| Config is one flat file | Per-agent, per-user, per-role config with policy overlay |
| Channel identity = the user | Channel identity = org bot, attributed to requesting user |
| Agent = personal assistant | Agent = org capability with governance boundary |
| Plugin SDK = hooks on a personal runtime | Need first-class multi-tenant governance, not hooks |

The plugin approach (intercepting OpenClaw hooks) works for a demo but creates long-term coupling to a system that doesn't share Shoal's multi-user DNA. Every new OpenClaw release could break assumptions. Every governance feature requires working around single-user design.

---

## Vercel Chat SDK — What It Provides

**Repo:** [vercel/chat](https://github.com/vercel/chat) | **Docs:** [chat-sdk.dev](https://chat-sdk.dev)

### Core Capabilities

| Capability | Details |
|---|---|
| **Multi-platform adapters** | Slack, Teams, Discord, Google Chat, GitHub, Linear — write once |
| **Event handlers** | `onNewMention`, `onMessage`, `onReaction`, `onButtonClick`, `onSlashCommand` |
| **JSX Cards & Modals** | Native-rendered UI per platform (buttons, forms, cards) |
| **AI SDK streaming** | Direct integration with Vercel AI SDK — stream LLM responses to any channel |
| **State management** | Pluggable: Redis, ioredis, in-memory |
| **TypeScript-first** | Full type safety across events, cards, state |

### What It Doesn't Do (Shoal's Value)

- ❌ Agent orchestration / tool execution
- ❌ Governance, policy enforcement, approval gates
- ❌ User identity / RBAC
- ❌ Audit trails
- ❌ Content filtering
- ❌ Multi-agent coordination
- ❌ Memory / knowledge management

This is exactly the right boundary. Chat SDK handles the ears and mouth. Shoal handles the brain and the rules.

---

## Proposed Architecture: Shoal v0.2

```
┌─────────────────────────────────────────────────────────┐
│                    Chat Platforms                         │
│   Slack · Teams · Discord · Google Chat · GitHub · Linear│
└──────────────────────┬──────────────────────────────────┘
                       ↕
┌──────────────────────┴──────────────────────────────────┐
│              Vercel Chat SDK (adapters)                   │
│   Events · JSX Cards · Streaming · State (Redis)         │
└──────────────────────┬──────────────────────────────────┘
                       ↕
┌──────────────────────┴──────────────────────────────────┐
│              Shoal Gateway (the brain stem)               │
│                                                          │
│  ┌─────────────┐  ┌──────────────┐  ┌───────────────┐   │
│  │ Identity &   │  │  Policy      │  │  Audit        │   │
│  │ Auth (ARISE) │  │  Engine      │  │  Trail        │   │
│  │              │  │              │  │               │   │
│  │ • User→agent │  │ • Tool gates │  │ • Every action│   │
│  │   mapping    │  │ • Content    │  │ • Cost track  │   │
│  │ • RBAC       │  │   filters    │  │ • Reasoning   │   │
│  │ • MFA        │  │ • Approval   │  │   capture     │   │
│  │ • SSO/SAML   │  │   workflows  │  │ • Immutable   │   │
│  └─────────────┘  └──────────────┘  └───────────────┘   │
│                                                          │
│  ┌─────────────┐  ┌──────────────┐  ┌───────────────┐   │
│  │ Agent Pool   │  │  Session     │  │  Knowledge    │   │
│  │              │  │  Manager     │  │  Store        │   │
│  │ • Pi runtime │  │              │  │               │   │
│  │ • Tool exec  │  │ • Per-user   │  │ • Org docs    │   │
│  │ • Sandboxed  │  │ • Per-agent  │  │ • Vector DB   │   │
│  │ • Model route│  │ • Branching  │  │ • Access ctrl │   │
│  └─────────────┘  └──────────────┘  └───────────────┘   │
│                                                          │
└──────────────────────┬──────────────────────────────────┘
                       ↕
              PostgreSQL + Redis
                       ↕
              Admin Dashboard (Next.js)
```

### Key Differences from v0.1

| v0.1 (OpenClaw wrapper) | v0.2 (Chat SDK + own runtime) |
|---|---|
| OpenClaw owns channel I/O | Chat SDK provides channel adapters — Shoal owns the integration |
| Plugin hooks for governance | First-class governance in the request pipeline |
| Single-user session model | Multi-user session manager with attribution |
| OpenClaw's memory system | Org-scoped knowledge store with access control |
| Pinned to OpenClaw releases | Independent release cycle |
| Agent config in OpenClaw YAML | Agent config in Shoal DB, managed via dashboard |
| Pi agent embedded in OpenClaw | Pi agent as library (`@mariozechner/pi-agent-core`) — direct SDK usage |

---

## Agent Runtime: Pi as Library, Not CLI

The Pi monorepo (`badlogic/pi-mono`) ships as composable packages:

| Package | Use in Shoal |
|---|---|
| `@mariozechner/pi-ai` | Unified LLM API (Anthropic, OpenAI, Google, etc.) |
| `@mariozechner/pi-agent-core` | Agent runtime with tool calling + state management |
| `@mariozechner/pi-coding-agent` | Reference for building specialized agents |

Shoal doesn't need the Pi CLI or TUI. It needs the **runtime SDK** — the agent loop, tool execution, and streaming. Pi's SDK mode is explicitly designed for this (OpenClaw itself uses it this way).

```typescript
import { Chat, Card, Actions, Button } from "chat";
import { createSlackAdapter } from "@chat-adapter/slack";
import { createTeamsAdapter } from "@chat-adapter/teams";
import { Agent } from "@mariozechner/pi-agent-core";
import { ShoalGovernance } from "@shoal/governance";

const bot = new Chat({
  userName: "shoal-agent",
  adapters: {
    slack: createSlackAdapter(),
    teams: createTeamsAdapter(),
  },
  state: createRedisState(),
});

bot.onNewMention(async (thread, message) => {
  // 1. Identity — who is this user?
  const user = await shoal.resolveUser(message.sender);
  
  // 2. Policy — are they allowed to use this agent?
  const agent = await shoal.resolveAgent(thread.channel);
  await shoal.enforcePolicy(user, agent, message);
  
  // 3. Content filter — inbound
  await shoal.filterInput(message);
  
  // 4. Agent execution — with governance-aware tool wrapper
  const result = await agent.stream({
    prompt: message.text,
    tools: shoal.wrapTools(agent.tools, { user, auditLog: true }),
  });
  
  // 5. Content filter — outbound
  const filtered = await shoal.filterOutput(result);
  
  // 6. Audit
  await shoal.audit({ user, agent, message, result: filtered });
  
  // 7. Respond — streams to whatever platform they're on
  await thread.post(filtered.textStream);
});
```

---

## Approval Gates with Native UI

This is where Chat SDK really shines for Shoal. When an agent action requires approval:

```tsx
// Agent tries to execute a high-impact tool
bot.onApprovalRequired(async (thread, request) => {
  await thread.post(
    <Card title={`🛡️ Approval Required`}>
      <CardText>
        Agent **{request.agent.name}** wants to: {request.action.description}
      </CardText>
      <CardText>
        Requested by: {request.user.name} | Cost estimate: ${request.cost}
      </CardText>
      <Actions>
        <Button id={`approve:${request.id}`} style="primary">✅ Approve</Button>
        <Button id={`reject:${request.id}`} style="danger">❌ Reject</Button>
        <Button id={`details:${request.id}`}>📋 Details</Button>
      </Actions>
    </Card>
  );
});

bot.onButtonClick("approve:*", async (thread, action) => {
  const requestId = action.id.split(":")[1];
  await shoal.approveAction(requestId, action.user);
  await thread.post(`✅ Approved by ${action.user.name}`);
});
```

This renders **native Slack buttons, native Teams cards, native Discord components**. No custom UI needed. The approver clicks a real button in their real chat app. ARISE G.AC (Accountability) built right into the platform people already use.

---

## What Changes in the Stack

| Layer | v0.1 | v0.2 |
|---|---|---|
| **Channel I/O** | OpenClaw connectors | Vercel Chat SDK |
| **Agent Runtime** | OpenClaw (wrapping Pi) | Pi SDK directly (`pi-agent-core`) |
| **LLM API** | OpenClaw model routing | Pi AI SDK (`pi-ai`) or Vercel AI SDK |
| **Governance** | Shoal plugin hooks | First-class middleware in Shoal Gateway |
| **Session/Memory** | OpenClaw sessions | Shoal-owned, multi-user, org-scoped |
| **Dashboard** | Next.js (same) | Next.js (same) |
| **DB/Cache** | Postgres + Redis (same) | Postgres + Redis (same) |
| **Auth** | Auth.js (same) | Auth.js (same) |
| **Deployment** | Docker Compose (same) | Docker Compose (same) |

---

## What We Keep from v0.1

The v0.1 spec was right about a lot:

- ✅ Single-tenant per instance (still correct)
- ✅ Docker Compose deployment (still correct)
- ✅ ARISE 5 controls for MVP (still correct)
- ✅ NestJS + tRPC + Drizzle + Next.js stack (still correct)
- ✅ "Don't Build" list (still correct — no chat UI, no K8s, no ELK)
- ✅ Dogfood first, sell second (still correct)
- ✅ Data model (Users, Agents, Policies, AuditEntries, ApprovalRequests, Documents)

What changes is the **foundation layer** — replacing the OpenClaw dependency with Chat SDK + Pi SDK. The governance logic, admin dashboard, and ARISE controls all stay the same.

---

## Migration Path

This isn't a rewrite. It's swapping the plumbing while keeping the house:

1. **Phase 1:** Stand up Chat SDK with one adapter (Slack). Wire to existing Shoal governance engine.
2. **Phase 2:** Replace OpenClaw agent runtime with `pi-agent-core` SDK. Port tool wrapping + audit hooks.
3. **Phase 3:** Add adapters (Teams, Discord) — should be near-zero effort with Chat SDK.
4. **Phase 4:** Build org-scoped session/memory manager. Multi-user from day one.

OpenClaw remains Dave's personal assistant. Shoal becomes its own thing.

---

## Open Questions

- [ ] Chat SDK maturity — it's public beta. How stable are the adapters? Test Slack adapter first.
- [ ] Pi SDK stability — `pi-agent-core` is designed for embedding but OpenClaw is the main consumer. Any rough edges?
- [ ] Signal/WhatsApp/Telegram — Chat SDK doesn't have these adapters (yet). Need custom adapters or skip for enterprise (Slack/Teams cover 90% of org use cases).
- [ ] Vercel AI SDK vs Pi AI SDK — some overlap. Pick one for LLM calls. Pi AI SDK has more provider coverage.
- [ ] Licensing — Chat SDK is MIT. Pi is MIT. Clean for O'Saasy wrapper.

---

## Decision

**Recommendation:** Adopt this architecture for Shoal v0.2. The OpenClaw-as-foundation approach in v0.1 was a pragmatic starting point, but it creates coupling to a single-user system that will fight every multi-user governance feature. Chat SDK + Pi SDK gives Shoal clean ownership of its full stack while leveraging battle-tested open source for the hard parts (channel adapters, agent runtime, LLM APIs).

**Next step:** Spike the Chat SDK Slack adapter + Pi agent-core with a single governance-wrapped agent. Prove the pipeline works end-to-end before committing to the architecture change.

---

*"The octopus doesn't need the whale's skeleton. It builds its own."* 🐙
