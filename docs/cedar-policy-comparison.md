# Cedar Policy Engine: Comparison to Shoal's Current Architecture

**Date:** 2026-02-19  
**Reference:** Phil Windley, "Beyond Denial: Using Policy Constraints to Guide OpenClaw Planning"  
https://www.technometria.com/p/beyond-denial-using-policy-constraints  
**Demo repo:** https://github.com/windley/openclaw-cedar-policy-demo

---

## Executive Brief

Shoal's current policy engine (`packages/api/src/policies/engine.ts`) is a reactive, TypeScript-native evaluator — it works correctly for v0.1 but operates only as a gate: the agent acts, Shoal checks, Shoal blocks. Windley's Cedar integration demonstrates a qualitatively different model: **constraint-aware planning**, where agents query what's _allowed_ before proposing actions rather than discovering limits by hitting them.

For v0.1, Shoal's engine is the right call — simple, testable, no external dependencies. For v0.2+, Cedar adoption would unlock the architectural story that matters most for enterprise buyers: _"Your agents plan within policy boundaries — not just get corrected after the fact."_

---

## Shoal Today: What's Built

### Policy Engine (`engine.ts`)

Three pure TypeScript evaluation functions:

```
evaluateContentPolicies(text, rulesList)
  → { allowed, reasons, matchedTerms }
  Logic: blocked term matching (substring) + PII regex detection

evaluateToolPolicies(toolName, role, rulesList)
  → { allowed, reasons }
  Logic: denylist check + allowlist check + role check (flat: admin/member/viewer)

evaluateApprovalPolicies(actionType, toolName, role, rulesList)
  → { requiresApproval, reasons }
  Logic: action type + tool name + role matching against approval rules
```

### Governance Service (`governance/service.ts`)

Orchestrates the three evaluators in sequence per tool call:

1. Check tool policies → block or continue
2. Check approval policies → block + create `approval_requests` row or continue
3. Log to `audit_entries` either way

### Schema

- `policies` table: `type` (content_filter | tool_restriction | approval_required) + `rulesJson` (JSONB blob)
- `approvalRequests`: state machine `pending → approved | rejected | expired`
- `auditEntries`: append-only log

### Mode of Operation

**Purely reactive.** Every evaluation happens post-hoc, at tool call time. The agent has no visibility into constraints during planning — it only discovers limits when it hits a deny.

---

## Cedar: What It Adds

### What Cedar Is

Cedar is an open-source, AWS-developed policy language and evaluation engine. Policies are declarative, type-safe, and external to application code. Key properties:

- **Deterministic** — same inputs always produce the same decision
- **Auditable** — policy text is readable, versionable, diffable
- **Attribute-based** — decisions based on principal, action, resource, and context attributes
- **Formally verified** — Cedar's evaluator has mathematical correctness proofs

### The Windley Architecture

**Phase 1: Constraint-aware planning (NEW)**

Before proposing an action, the agent queries Cedar via **Typed Partial Evaluation (TPE)**:

> "Given this principal and this action type, what constraints apply?"

Cedar evaluates the policy with some inputs fixed (principal, action) and others symbolic (resource, attributes), returning a _residual constraint_ — a description of the allowable space. This constraint is injected into the agent's system prompt, so the agent reasons within policy-defined bounds before committing to a plan.

**Phase 2: Runtime enforcement (unchanged)**

Every tool invocation still hits the Policy Enforcement Point (PEP) for a concrete authorization check. The LLM never enforces policy — Cedar does, deterministically.

```
Planning phase:  agent → /query-constraints → Cedar TPE → constraint expression → system prompt
Execution phase: agent → proposes action → PEP → Cedar → permit/deny → tool executes or deny feeds replanning
```

---

## Gap Analysis

| Dimension                       | Shoal Today                           | Cedar (Windley model)                                 |
| ------------------------------- | ------------------------------------- | ----------------------------------------------------- |
| **Policy language**             | JSON blobs in DB (`rulesJson`)        | Cedar DSL — declarative, typed, version-controlled    |
| **Evaluation mode**             | Reactive only (check at call time)    | Reactive + proactive (TPE before planning)            |
| **Agent planner awareness**     | None — agent doesn't know constraints | Agent gets constraint expression before planning      |
| **Role model**                  | Flat strings (admin/member/viewer)    | ABAC — principal + resource + context attributes      |
| **Policy authoring**            | Raw JSON, developer-authored          | Cedar syntax, policy-admin-readable                   |
| **Determinism**                 | Yes — pure TS functions               | Yes — Cedar evaluation is formally verified           |
| **Auditability**                | Audit log entries                     | Full policy evaluation trace + policy text            |
| **External policy store**       | PostgreSQL (`policies` table)         | Cedar policy files (git-versionable)                  |
| **Inter-policy expressiveness** | None — each rule is isolated          | Cedar supports forbid > permit precedence, conditions |
| **Dependency**                  | None (self-contained)                 | Cedar Rust/WASM library                               |

---

## Key Architectural Gaps in Shoal's Engine

### 1. No Planner Visibility (Most Important)

The agent gets no signal about constraints during planning. It operates in an unconstrained space and discovers policy boundaries reactively. This creates:

- **Wasted cycles** — agent proposes → denied → replans → proposes again
- **Weaker compliance story** — "we deny bad actions" vs "agents operate within defined boundaries"

Cedar TPE solves this. Shoal's `evaluateToolPolicies` could theoretically expose a "what's allowed?" query, but the rulesJson schema doesn't support partial evaluation — it's designed for concrete input matching only.

### 2. Flat Role Model

Current: `role: string | null` checked against `rolesAllowed: string[]`

This can't express:

- "members can use `web_search` but only for external domains"
- "admins can approve actions, but not their own agent's actions"
- "agents with `trusted` attribute can skip content filtering"

Cedar's ABAC model handles this natively.

### 3. JSON Rules Are Opaque

`rulesJson` is a freeform JSONB blob. There's no schema enforcement, no readable policy syntax, and no way for a non-developer governance admin to author or audit rules. Cedar policies are human-readable text with IDE support and syntax validation.

### 4. No Formal Precedence Model

Shoal iterates all matching rules and ORs the results. Cedar has a `forbid > permit` precedence model — an explicit deny always wins, regardless of evaluation order. This is critical for security: today a misconfigured rule ordering could accidentally permit a denied action.

---

## Recommended Path

### v0.1 (Current): Keep as is ✅

The TypeScript engine is correct, testable, and has zero external dependencies. It satisfies ARISE control alignment for v0.1. Don't change it.

### v0.2: Cedar as Optional Policy Backend

Add Cedar as a pluggable policy backend behind a feature flag:

```typescript
// governance/service.ts
const policyBackend = config.cedar.enabled
  ? new CedarPolicyBackend(config.cedar.policyPath)
  : new NativePolicyEngine();
```

Introduce a `CedarPolicyBackend` that:

1. Loads `.cedar` policy files from disk (git-tracked, not DB)
2. Evaluates using `@cedar-policy/cedar-wasm` (WASM build, no native deps)
3. Exposes a `/query-constraints` endpoint for TPE queries

Existing `policies` table and `engine.ts` remain as fallback.

### v0.3: TPE + Constraint-Aware Planning

Implement Windley's planning phase:

- OpenClaw plugin queries `/query-constraints` before generating plans
- Constraint expression injected into agent system prompt
- Runtime enforcement unchanged

This is the story that differentiates Shoal for enterprise: **agents that understand their operational envelope, not just get corrected when they leave it.**

---

## Integration Points with Current Code

| Shoal Component         | Cedar Integration Point                               |
| ----------------------- | ----------------------------------------------------- |
| `engine.ts`             | Replace/wrap with `CedarPolicyBackend.evaluate()`     |
| `governance/service.ts` | Add TPE query call before `evaluateToolCall()`        |
| `policies` DB table     | Add `cedar_policy_path` column; Cedar policies in git |
| OpenClaw plugin         | Add pre-planning hook: call `/query-constraints`      |
| Admin dashboard         | Policy editor showing Cedar syntax (v0.3)             |

---

## ARISE Alignment Note

Cedar's deterministic, externally-auditable evaluation model strengthens ARISE control compliance:

- **Control documentation**: Cedar policy text IS the policy documentation
- **Auditability**: Every evaluation is traceable to a specific policy rule
- **Separation of duty**: Policy authorship (Cedar files) separate from enforcement (runtime)

Ed + Graeme should be involved in mapping ARISE controls to Cedar policy patterns — that mapping becomes a deliverable/template for Shoal customers.

---

## References

- Cedar policy language: https://www.cedarpolicy.com
- Cedar WASM (npm): `@cedar-policy/cedar-wasm`
- Cedar Typed Partial Evaluation: https://www.cedarpolicy.com/blog/partial-evaluation
- Windley demo repo: https://github.com/windley/openclaw-cedar-policy-demo
- Windley prior post (reactive PEP): https://www.windley.com/archives/2026/02/a_policy-aware_agent_loop_with_cedar_and_openclaw.shtml
