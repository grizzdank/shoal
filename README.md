# Shoal MVP

Shoal is a governance/admin layer for OpenClaw. It is not a chat app. Users continue to operate through existing channels (Slack/Discord/Signal) while Shoal adds policy enforcement, auditability, approvals, and admin workflows.

## Monorepo Architecture

```text
shoal/
├── packages/
│   ├── api/        # NestJS + tRPC + Drizzle + PostgreSQL + Redis
│   ├── dashboard/  # Next.js App Router + Tailwind + shadcn/ui-style components
│   ├── shared/     # Shared TypeScript types/enums
│   └── plugin/     # OpenClaw plugin hooks for governance lifecycle checks
├── docker-compose.yml
└── pnpm-workspace.yaml
```

## Core Components

- **API (`@shoal/api`)**
  - NestJS app modules: auth, users, agents, policies, audit, approvals, documents
  - tRPC router with basic CRUD scaffolds for all entities
  - Drizzle schema: `users`, `agents`, `policies`, `audit_entries`, `approval_requests`, `documents`
  - Auth.js placeholder config for Google OAuth + email
  - Pino logging and `/health` endpoint

- **Dashboard (`@shoal/dashboard`)**
  - Next.js App Router scaffold
  - Sidebar nav for Dashboard, Agents, Users, Policies, Audit Log, Approvals, Documents
  - Placeholder section pages
  - Auth.js session provider wrapper
  - tRPC client configured for API endpoint

- **Plugin (`@shoal/plugin`)**
  - OpenClaw plugin manifest (`openclaw.plugin.json`)
  - Hook pass-through handlers for:
    - `message_received`
    - `message_sending`
    - `before_tool_call`
    - `tool_result_persist`
    - `before_agent_start`

## Getting Started

### 1) Install deps

```bash
pnpm install
```

### 2) Start infrastructure/services via Docker (recommended)

```bash
docker compose up --build
```

This boots:
- `dashboard` on `http://localhost:3000`
- `api` on `http://localhost:3001`
- `postgres` on `localhost:5432`
- `redis` on `localhost:6379`
- `openclaw` on `http://localhost:8080`

Compose now includes healthchecks and startup ordering:
- `api` waits for Postgres + Redis health
- `dashboard` waits for API health

### 3) Run workspace dev servers locally

```bash
pnpm dev
```

### Useful scripts

```bash
pnpm build
pnpm test
pnpm typecheck
pnpm lint
pnpm db:migrate
pnpm db:check
pnpm ci:check
```

## Notes

- TypeScript strict mode is enabled from root config.
- ESM is used across all packages.
- Plugin package intentionally avoids OpenClaw runtime dependency and uses local type stubs.
- Docker images build from monorepo root context with package-specific Dockerfiles.
