# Shoal v0.1 Spec Traceability Matrix

Source spec: `shoal-v0.1-spec.md` (version 0.1.1, dated 2026-02-13)

## Purpose
This document maps v0.1 requirements to Beads issues so implementation order and coverage are explicit.

## Scope-to-Backlog Mapping
| Spec Area | Requirement Summary | Beads Issue(s) |
|---|---|---|
| Planning | Create requirement traceability and delivery checklist | `bd-2xf` |
| Data model | Align User/Agent/Policy/AuditEntry/ApprovalRequest/Document fields to spec | `bd-3ng` |
| API | Replace scaffold responses with DB-backed tRPC CRUD + validation | `bd-2ta` |
| Identity | Auth.js dashboard auth and authenticated API context | `bd-3b4` |
| Access control | Enforce `admin` / `member` / `viewer` authorization | `bd-385` |
| Governance policies | Content filters + tool restrictions with configurable rules | `bd-14w` |
| Approval gates | Human approval flow for high-impact actions | `bd-1jp` |
| Audit | Append-only logging for actions, decisions, cost, reasoning context | `bd-2fl` |
| OpenClaw integration | Implement plugin hooks with governance services | `bd-2cq` |
| Dashboard | Users/Agents/Policies CRUD workflows | `bd-3qf` |
| Dashboard | Approval queue and audit log viewer | `bd-1a6` |
| Documents | Upload/list/manage PDF/MD/TXT metadata + storage path | `bd-3pc` |
| Search | Hybrid regex + vector search over audit and documents | `bd-1d0` |
| Deployment | Fresh-machine `docker compose up` reliability | `bd-1li` |
| Quality gates | Tests + CI gates for governance-critical behavior | `bd-31v` |
| ARISE evidence | Produce partner review evidence for v0.1 controls | `bd-2kd` |

## ARISE Control Mapping (v0.1)
| ARISE Control | Spec Intent | Implementation Issues |
|---|---|---|
| `P.IM` Identity | Authenticated actions tied to user identity | `bd-3b4`, `bd-2fl`, `bd-2kd` |
| `P.AC` Access Control | Role permissions + tool restrictions | `bd-385`, `bd-14w`, `bd-2cq`, `bd-2kd` |
| `V.IA` Audit | Append-only audit of actions, tools, reasoning, cost | `bd-2fl`, `bd-1a6`, `bd-2kd` |
| `G.AC` Accountability | Human-in-the-loop approvals for high-impact actions | `bd-1jp`, `bd-1a6`, `bd-2cq`, `bd-2kd` |
| `D.CM` Content Monitoring | Input/output content filtering (PII/toxicity/blocklists) | `bd-14w`, `bd-2cq`, `bd-2kd` |

## Success Criteria Coverage
| Success Criterion from Spec | Primary Issue(s) |
|---|---|
| Team uses Shoal-managed OpenClaw daily | `bd-1li`, `bd-2cq`, `bd-3qf`, `bd-1a6` |
| Agents deployed to 2+ channels from dashboard | `bd-3qf`, `bd-2cq` |
| Audit trail captures every agent action with cost | `bd-2fl`, `bd-1a6` |
| Approval gate blocks a real action and logs decision | `bd-1jp`, `bd-2fl`, `bd-1a6` |
| Content filter catches PII in output | `bd-14w`, `bd-2cq` |
| ARISE alignment reviewed by Ed/Graeme | `bd-2kd` |
| Cold-start `docker compose up` works | `bd-1li` |
| File upload provides agent context | `bd-3pc`, `bd-2cq` |

## Execution Order (Dependency-Driven)
1. `bd-2xf` Spec traceability
2. `bd-3ng` Data model parity
3. `bd-2ta` API CRUD + validation
4. `bd-3b4` Auth.js integration
5. `bd-385` RBAC enforcement
6. `bd-14w` Policy engine
7. `bd-1jp` Approval gates
8. `bd-2fl` Audit logging
9. `bd-2cq` OpenClaw plugin governance wiring
10. `bd-3qf` Dashboard CRUD
11. `bd-1a6` Dashboard approvals + audit viewer
12. `bd-3pc` Document management
13. `bd-1d0` Search
14. `bd-1li` Deployment hardening
15. `bd-31v` Test suite + release gates
16. `bd-2kd` ARISE evidence and sign-off
