# BİŞIŞ Future Core Architecture

**Status:** Implemented local foundations; disabled by default; not mounted into V1 routes.

## Domain map

```text
backend/src/future/
├── shared/       contracts, tenant context, repository boundary
├── ai/           LocalProvider, model selection, prompts, evaluation, memory, tools
├── workflows/    workflow engine/service, state transitions, approvals
├── crm/          scoring, clients, leads, notes, follow-ups
├── finance/      minor-unit ledger, invoices, transactions, expenses, reports
├── analytics/    metrics, trends, confidence, anomaly baseline
├── automation/  schedules, triggers, webhook verification and normalization
├── security/     scoped policy, audit/security events, anomaly baseline
├── enterprise/   organizations, teams, memberships, identity contract
├── marketplace/  listings, reviews, moderation state, commission, payout boundary
├── integrations/ provider-neutral contracts and local adapters
├── cloud/        resource planning without provisioning
├── decision/     proposals, risk scores, approval boundary
└── reporting/    composition of CRM/finance/analytics summaries
```

`core.js` and `services.js` contain the implementation source; domain `index.js` files are focused public barrels, and the root `index.js` preserves the original import compatibility surface. No Future module is imported by `server.js` or current V1 routes.

## Dependency direction

```text
Domain logic
    ↓
Services / policies
    ↓
Repository and provider interfaces
    ↓
In-memory/local adapters for tests
    ↓
Future infrastructure adapters (not implemented)
```

The future code does not depend on Express, Supabase, Stripe, OpenAI, browser APIs, or V1 route files. External effects must enter through an adapter and remain disabled until configured and approved.

## Repository boundary

`InMemoryRepository` implements `save`, `findById`, `list`, and `delete` with a tenant-scoped key. The repository is intentionally persistence-ready, not persistence-complete. A PostgreSQL implementation can replace it by preserving the same contract, deriving tenant scope from authenticated server context, using parameterized queries/RLS, and adding transaction boundaries for idempotency and immutable records.

No speculative migration was created. If durable persistence becomes necessary, a future additive migration 012+ must be reviewed, tested on disposable Staging, and kept out of Production until a separate release gate passes.

## Provider and adapter boundary

The `AIProvider`, `PaymentProvider`, `CRMProvider`, `CommunicationProvider`, `ProjectManagementProvider`, `StorageProvider`, `IdentityProvider`, `CloudProvider`, and `LocalMockAdapter` contracts isolate external systems. The local provider is deterministic and cost-free; named integration adapters report `not-configured` and perform no network calls by default. Payout and payment interfaces fail closed when not configured.

## Tenant isolation model

Every service/repository method that handles business data requires `{ tenantId, actorId, permissions }`. Records are keyed and filtered by tenant. Cross-tenant lookups fail as not found or return no records. Authorization is explicit and never inferred from client-provided resource ownership.

## Approval model

High-impact operations follow:

```text
PROPOSED → REVIEW_REQUIRED → APPROVED → EXECUTED
                         └→ REJECTED
```

The current implementation stops at approval or produces a proposed action. Tool execution requires permission and, by default, human approval. Agent planning returns `approval_required` and has an empty side-effect list.

## Workflow state model

The supported local lifecycle is:

```text
queued → approved → running → completed
                         └→ failed
```

Runs have tenant-scoped execution IDs, idempotency keys, history, and captured failure states. Durable queue, timeout, cancellation, retry worker, and dead-letter infrastructure remain unimplemented.

## AI boundary

`LocalProvider` supports deterministic tests without a provider key. `ModelSelector`, `PromptEngine`, `EvaluationEngine`, `ScopedMemoryStore`, `ToolRegistry`, and `AgentExecutor` provide the boundary for later providers. No custom model, RAG, training, real inference, prompt dataset, or destructive tool execution exists here.

## Financial boundary

Financial services normalize amounts to integer minor units. Invoices calculate line totals deterministically; transactions and expenses are immutable by contract; reports calculate revenue, debits, expenses, and net values. This is not accounting or tax compliance, and it is not connected to payment networks or V1 financial tables.

## Integration boundary

The integration registry and local adapters model health, enabled state, and method dispatch. An adapter must be explicitly enabled, tenant-scoped, permission-checked, rate-limited, audited, and tested against a provider contract before any external call is permitted.

## API mounting later

Future API routes should be versioned and separate from V1, for example `/api/v2/future/<domain>`. They must reuse V1 authentication validation without bypassing it, derive tenant scope server-side, expose typed errors and request IDs, support pagination and idempotency, and remain feature-flagged. No route is mounted now.

## Explicitly not implemented

Durable PostgreSQL repositories, migrations 012+, Express routes, frontend pages, queue workers, cron runtime, real AI providers, RAG, SSO/OAuth, real payment/payout, cloud provisioning, Storage contract, marketplace moderation operations, accounting compliance, observability sink, backup/restore integration, and Production rollout are not implemented.
