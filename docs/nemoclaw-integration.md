# NemoClaw Integration — Shoal Security Enhancement

**Date:** 2026-03-16
**Status:** Research / planning
**Context:** [NVIDIA NemoClaw](https://github.com/NVIDIA/NemoClaw) is an open-source (Apache-2.0) stack that sandboxes OpenClaw agents using [NVIDIA OpenShell](https://github.com/NVIDIA/OpenShell). This doc maps how NemoClaw's infrastructure-level security complements Shoal's application-level governance, and defines the work to integrate them.

---

## TL;DR

Shoal enforces **policy** (who can do what, what needs approval, audit everything). NemoClaw enforces **containment** (sandbox, network egress, filesystem, syscalls). Together they provide defense in depth: even if an agent bypasses Shoal's plugin hooks, NemoClaw's kernel-level sandbox prevents real damage.

```
┌─────────────────────────────────────────────────────┐
│  Channels (Signal / Discord / Slack / etc.)         │
├─────────────────────────────────────────────────────┤
│  Shoal Dashboard (Next.js)                          │
│  Users · Roles · Policies · Audit · Approvals       │
├─────────────────────────────────────────────────────┤
│  Shoal Plugin (OpenClaw hooks)                      │
│  message_received → content filter                  │
│  before_tool_call → permission + approval gate      │
│  tool_result_persist → audit log                    │
│  message_sending → output filter                    │
├─────────────────────────────────────────────────────┤
│  OpenClaw Agent Runtime                             │
├─────────────────────────────────────────────────────┤
│  NemoClaw / OpenShell Sandbox                       │
│  Landlock (filesystem) · seccomp (syscalls)         │
│  netns (network isolation) · inference routing      │
└─────────────────────────────────────────────────────┘
```

---

## What NemoClaw Provides (That Shoal Doesn't)

| Layer | NemoClaw | Shoal Today |
|-------|----------|-------------|
| **Filesystem** | Landlock: agent can only access `/sandbox` and `/tmp`. Locked at sandbox creation. | No filesystem enforcement. `before_tool_call` can block tool names, but can't prevent a shell command from reading `/etc/passwd`. |
| **Network egress** | netns: all outbound blocked by default. Allowlist per host. Hot-reloadable at runtime. Unknown hosts surface in TUI for operator approval. | No network enforcement. Content filters catch PII in output, but can't prevent the HTTP request itself. |
| **Syscalls** | seccomp: blocks privilege escalation and dangerous syscalls. Locked at creation. | Not addressed. |
| **Inference routing** | All model API calls intercepted by OpenShell and routed to configured provider. Agent never calls APIs directly. | Not addressed. Shoal trusts OpenClaw's model config. |

### Key insight

Shoal's plugin hooks are **application-level gates** — they run inside the OpenClaw process. A sufficiently creative agent (or a bug in the hook chain) could bypass them. NemoClaw's enforcement is **kernel-level** — Landlock, seccomp, and network namespaces are enforced by Linux regardless of what the application does.

---

## What Shoal Provides (That NemoClaw Doesn't)

| Capability | Shoal | NemoClaw |
|-----------|-------|----------|
| **User/role management** | Auth.js + roles (admin/member/viewer) | None — no concept of users |
| **Policy engine** | Drizzle-backed policies, content filters (PII, toxicity, blocklists), tool restrictions per agent/role | Static network allowlists only |
| **Approval gates** | `before_tool_call` → create ApprovalRequest → block until human ✅ | Operator approval for unknown hosts only |
| **Audit trail** | Append-only log: every agent action, tool call, cost, reasoning | Blueprint logs only |
| **Content filtering** | Inbound + outbound text analysis (PII detection, blocklists) | None |
| **ARISE alignment** | 5 controls mapped (P.IM, P.AC, V.IA, G.AC, D.CM) | None |
| **Multi-agent governance** | Agent provisioning, per-agent policies, channel assignment | One agent per sandbox, no coordination |
| **Dashboard** | Full admin UI for all governance operations | CLI only (`nemoclaw <name> status/connect/logs`) |

---

## Integration Architecture

### Deployment: Shoal + NemoClaw

```yaml
# Modified docker-compose.yml concept
# NemoClaw replaces the bare OpenClaw container with a sandboxed one

services:
  dashboard:
    # Shoal dashboard — unchanged
    image: ghcr.io/lfg/shoal-dashboard:latest
    ports: ['3000:3000']

  api:
    # Shoal API — unchanged
    image: ghcr.io/lfg/shoal-api:latest
    ports: ['3001:3001']
    environment:
      DATABASE_URL: postgres://...
      REDIS_URL: redis://...
      OPENCLAW_URL: http://openclaw-sandbox:8080

  openclaw-sandbox:
    # NemoClaw-managed OpenClaw instance (replaces bare openclaw container)
    # Runs inside OpenShell sandbox with Landlock + seccomp + netns
    # Shoal plugin installed inside the sandbox
    image: ghcr.io/nvidia/nemoclaw:latest
    environment:
      NEMOCLAW_PROFILE: default  # or nim-local, vllm
      SHOAL_GOVERNANCE_API_URL: http://api:3001
    volumes:
      - shoal-plugin:/opt/openclaw/plugins/shoal

  postgres:
    image: postgres:17
  redis:
    image: redis:7-alpine
```

### Plugin Loading Inside Sandbox

The Shoal plugin (`packages/plugin`) needs to run inside the NemoClaw sandbox. This requires:

1. **Network egress allowlist** must include the Shoal API (`http://api:3001`) — the plugin calls `callGovernance()` on every hook
2. **Plugin mount** — the compiled plugin JS needs to be available inside the sandbox filesystem
3. **Environment variable** — `SHOAL_GOVERNANCE_API_URL` must be set inside the sandbox

The plugin already handles governance API unreachability gracefully (returns `{ error: 'governance_unreachable' }` and passes through), so a misconfigured network policy degrades to ungoverned rather than crashing.

---

## Implementation Tasks

### Phase 1: Validate compatibility (1-2 days)

- [ ] Install NemoClaw on Poza following their quickstart
- [ ] Verify OpenClaw runs correctly inside OpenShell sandbox
- [ ] Test Shoal plugin loading inside sandbox
- [ ] Confirm plugin can reach Shoal API through network namespace (add allowlist entry)
- [ ] Run existing Shoal test suite against sandboxed OpenClaw

### Phase 2: Network policy integration (2-3 days)

Adopt NemoClaw's network egress model into Shoal's policy engine.

- [ ] Add `network_egress` policy type to Shoal schema (alongside existing `content_filter` and `tool_restriction`)
- [ ] Dashboard UI for managing egress allowlists (host + port + description)
- [ ] Sync Shoal egress policies → NemoClaw network policy (hot-reload via OpenShell API)
- [ ] Audit log entries when egress is blocked or operator-approved
- [ ] Surface NemoClaw's "unknown host approval" requests in Shoal's Approval Queue (not just OpenShell TUI)

```typescript
// New policy type in schema
{
  type: 'network_egress',
  rulesJson: {
    allowlist: [
      { host: 'api.anthropic.com', port: 443, description: 'Claude API' },
      { host: 'api.openai.com', port: 443, description: 'OpenAI API' },
    ],
    defaultAction: 'block',  // or 'approve' (routes to approval queue)
  }
}
```

### Phase 3: Inference routing integration (1-2 days)

- [ ] Surface NemoClaw's inference profile (cloud/NIM/vLLM) in Shoal dashboard
- [ ] Allow admins to switch inference profiles from dashboard (calls `openshell inference set`)
- [ ] Audit log model/provider changes
- [ ] Cost tracking per inference profile

### Phase 4: Sandbox lifecycle in dashboard (2-3 days)

- [ ] Shoal dashboard shows sandbox status (health, resource usage, uptime)
- [ ] Start/stop/restart sandbox from dashboard (calls `nemoclaw` CLI)
- [ ] Blueprint version display + upgrade flow
- [ ] Sandbox filesystem policy display (read-only, informational)

---

## Design Decisions

| Decision | Rationale |
|----------|-----------|
| NemoClaw wraps OpenClaw, Shoal wraps NemoClaw | Layered security. Plugin runs inside sandbox. Dashboard manages both layers. |
| Shoal API runs OUTSIDE the sandbox | The governance API is the control plane — it must not be confined by the sandbox it governs. |
| Egress policies managed in Shoal, synced to NemoClaw | Single source of truth in Shoal's Postgres. NemoClaw is the enforcement engine. |
| Graceful degradation if NemoClaw unavailable | Shoal plugin already handles API unreachability. Same pattern: governance still enforces at application level even without sandbox. |
| Don't fork NemoClaw | Use as upstream dependency. Contribute back if we extend. Apache-2.0 is compatible with O'Saasy. |

---

## Risks

| Risk | Mitigation |
|------|-----------|
| NemoClaw is alpha — APIs may change | Pin to specific blueprint version. Isolate NemoClaw calls behind an adapter interface. |
| Network namespace may block Shoal plugin → API calls | Phase 1 validates this immediately. Allowlist entry is the fix. |
| OpenShell is NVIDIA-specific — could lock us into their ecosystem | Shoal works without NemoClaw (current state). NemoClaw is an optional hardening layer, not a dependency. |
| Performance overhead of sandbox + governance hooks | Benchmark in Phase 1. Plugin HTTP calls already add latency; sandbox overhead is likely negligible in comparison. |

---

## References

- [NemoClaw repo](https://github.com/NVIDIA/NemoClaw)
- [NVIDIA OpenShell](https://github.com/NVIDIA/OpenShell)
- [NemoClaw docs](https://docs.nvidia.com/nemoclaw/latest)
- [Shoal v0.1 spec](../shoal-v0.1-spec.md)
- [Shoal plugin source](../packages/plugin/src/index.ts)
- [Governance service](../packages/api/src/governance/service.ts)
