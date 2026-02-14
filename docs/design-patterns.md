# Shoal — Design Patterns & Prior Art

Reference patterns from competitive analysis and industry research. Use as guidance when building Shoal components.

---

## Streaming Protocol: Tymbal (from Miriad/Sanity.io)

**Source:** [sanity-labs/miriad-app](https://github.com/sanity-labs/miriad-app) — MIT licensed

Tymbal is a transport-agnostic streaming protocol for agent chat. Relevant for Shoal's dashboard and audit log streaming.

### Core Ideas to Adopt

- **ULID-ordered NDJSON frames** — Messages self-sort by creation time. No sequence numbers, no coordination. Each frame is `{"i":"<ulid>", "a":"<append>"}` or `{"i":"<ulid>", "v":<complete value>}`.
- **Metadata-first rendering** — Start frames include message metadata (`type`, `sender`, `model`) so UI can render skeleton immediately before content streams in.
- **Partial sync on reconnect** — Client tracks highest timestamp seen, sends `{"request":"sync","since":"<ts>"}` on reconnect. Server replays only missed frames. No full reload.
- **Multi-agent message types** — Beyond `user`/`agent`, they define `agent_message` (inter-agent), `agent_complete` (sub-agent done), `status` (ephemeral indicators), `thinking` (reasoning trace). All with optional `sender` field for attribution.

### Shoal Application

| Tymbal Concept | Shoal Use |
|---|---|
| NDJSON streaming | Dashboard real-time agent activity feed |
| Sender attribution | Audit trail — which agent said/did what |
| Sync protocol | Admin dashboard reconnect without state loss |
| Status messages | Agent health/activity indicators in admin UI |
| Thinking traces | Governance: reasoning audit for compliance review |

---

## Agent Orchestration: The Lead Pattern

**Source:** Miriad agent prompts (MIT licensed)

Their multi-agent coordination uses a **Lead agent** as facilitator, not implementer:

### Key Principles

1. **Lead protects its context** — Never does implementation work. "Every line of code you write is context you can't use to think about the project as a whole." The Lead understands requests, creates plans, assembles teams, keeps work moving.

2. **Compare-and-swap task claiming** — Agents claim tasks atomically via `artifact_update` with `old_value`/`new_value` checks. Prevents race conditions when multiple agents grab work. Pattern:
   ```json
   {
     "slug": "implement-login",
     "changes": [
       { "field": "status", "old_value": "pending", "new_value": "in_progress" },
       { "field": "assignees", "old_value": [], "new_value": ["agent-1"] }
     ]
   }
   ```

3. **Playbook system** — Reusable workflow templates (git workflow, rapid prototyping, testing strategy, KB building) that get copied into project channels and customized. Agents check for playbooks before starting work.

4. **Role separation with clean boundaries:**
   - **Scout** = throwaway exploration, spikes, feasibility. "Don't get attached to your code."
   - **Builder** = production code, feature branches, never merges to main without approval
   - **Reviewer** = quality gate, not gatekeeper. "Assume good intent."
   - **Steward** = guardian of main, merges approved PRs, branch hygiene, CI health
   - **Contrarian** = dedicated disagreement agent. Sharpens output, catches edge cases.

### Shoal Application

- **Orchestrator agent** in Shoal should follow Lead pattern — facilitate, don't implement
- **Compare-and-swap** for task coordination in multi-agent Shoal deployments
- **Playbooks** map to enterprise workflow templates — a sellable feature for consulting engagements
- **Contrarian pattern** validates our Team of Rivals approach — adversarial review built into workflow

---

## Memory Architecture: Nuum's Fractal Compression

**Source:** [sanity-labs/nuum](https://github.com/sanity-labs/nuum) — MIT licensed

Three-tier memory mimicking human cognition:

### Architecture

```
Working Memory (recent, full detail)
    ↓ recursive distillation
Reference Memory (weeks, compressed paragraphs)  
    ↓ further compression
Core Memory (months, key facts/decisions)
```

- Recent messages stay in full detail
- Older content recursively distilled — compressed while retaining what matters
- "A week becomes a paragraph, a month becomes a sentence"
- **Sweet spot: 30-50% context utilization** — informed but not overwhelmed

### Comparison to Current Stack (Profundo)

| | Profundo | Nuum |
|---|---|---|
| **Approach** | Flat semantic search over session chunks | Temporal compression with density gradients |
| **Strength** | Good at finding specific past conversations | Better at maintaining continuous context |
| **Weakness** | No compression, no temporal weighting | More complex, requires distillation pipeline |
| **Storage** | Embeddings in vector DB | SQLite with compressed summaries |

### Shoal Application

- Enterprise agents need persistent memory across sessions
- Nuum's approach better for long-running agent deployments (weeks/months)
- Consider hybrid: Profundo for search + Nuum-style compression for working context
- Governance angle: compressed memory is auditable, traceable

---

## Model Requirements

Miriad's honest constraint: **multi-agent coordination requires Opus-class models**. Smaller models "lose the thread."

### Implications for Shoal Pricing

- Standard tier ($499) with cheaper models may not support meaningful multi-agent work
- Enterprise tier with Opus/Sonnet is where real orchestration value lives
- Position as: "You can run cheaper models for simple tasks, but coordination requires capable models"
- This is a feature, not a bug — justifies premium pricing

---

## Market Validation

Miriad provides data points for the Shoal narrative:

- **97% autonomy rate** — 625/643 messages were agent-to-agent. Humans asked 18 questions over 2 days.
- **375x faster** — 7-minute multi-agent analysis vs full-day human effort
- **Sanity.io investing** ($180M+ funded company) validates multi-agent workspace as real category
- **MIT open source** — they're exploring, not monetizing. No commercial threat.
- Miriad is agent orchestration; Shoal is the secure infrastructure layer. **Complementary, not competitive.** You could run Miriad inside Shoal.

---

*Last updated: 2026-02-14*
*Sources: Miriad design-notes (MIT), Nuum README (MIT), miriad.systems*
