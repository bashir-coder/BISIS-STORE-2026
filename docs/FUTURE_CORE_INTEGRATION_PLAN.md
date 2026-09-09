# BİŞIŞ Future Core Integration Plan

هذه الخطة تحدد كيف ينتقل Future Core من local tested foundations إلى منتج مستقبلي، ولا تنفذ أي database/provider/deployment step بذاتها.

## Required sequence

```text
Future Core
  → PostgreSQL persistence
  → additive migrations 012+
  → service layer hardening
  → authenticated API routes
  → feature-flagged frontend
  → queues/workers
  → external providers
  → observability
  → production rollout
```

## Gate 0 — Product and security approval

اعتمد domain واحدًا وowner واحدًا وsuccess metrics وdata classification وthreat model وcost/latency budgets. ارفض أي capability لا تملك kill switch أو rollback أو human-approval policy عند الحاجة.

## Gate 1 — PostgreSQL persistence

حوّل `InMemoryRepository` إلى repository implementation يحافظ على tenant scope، optimistic/row locking عند الحاجة، unique idempotency keys، immutable audit records، وtransaction boundaries. لا تُنسخ البيانات عشوائيًا من V1 ولا يُفترض schema قبل contract review.

## Gate 2 — Migrations 012+

أنشئ migration additive فقط عندما يثبت أن persistence لا تعمل من دونها. وثّق owners، indexes، RLS، policies، grants، rollback/forward-fix، وmetadata comparison. طبّقها على disposable Staging أولًا، ولا تطبقها على Production ضمن هذه الخطة.

## Gate 3 — Service layer hardening

أضف domain services فوق repositories مع input schemas، authorization decisions، idempotency، retries bounded، audit events، safe errors، pagination، وrate-limit budgets. اختبر happy path، invalid input، cross-tenant denial، concurrency، failure، وreplay.

## Gate 4 — Authenticated API routes

استخدم namespace versioned منفصلًا عن V1، مثل `/api/v2/future/<domain>`. أعد استخدام JWT/session validation الحالية، اشتق tenant من session/server context، لا من body، وأرجع stable error codes وrequest IDs. لا تُفعّل routes قبل contract tests وbrowser acceptance.

## Gate 5 — Frontend integration

أضف صفحات صغيرة feature-flagged بعد ثبات API. لا تظهر في V1 navigation عند غياب العلم، ولا تستخدم real-looking production claims أو fake analytics. كل mutation يجب أن تعرض pending/review/approved/failed states وتتعامل مع reduced motion وRTL/localization.

## Gate 6 — Workers and queues

انقل execution خارج request lifecycle إلى queue مع execution IDs، lease/timeout، exponential backoff، retry limit، cancellation، dead-letter queue، deduplication، وmanual replay. افصل worker credentials عن web process، وامنح كل tool scope محدودًا.

## Gate 7 — External providers

أضف adapters خلف contracts فقط. لكل provider يلزم sandbox account، scopes، secret manager، rotation، timeout، circuit breaker، webhook signature/replay protection، cost limit، provider contract tests، وrollback. لا تُضمّن credentials في repository أو test fixtures.

## Gate 8 — Observability and recovery

أضف structured redacted logs، metrics للـlatency/error/queue depth/cost، traces مع tenant-safe correlation IDs، alerts، retention، backup/restore، وincident runbook. لا تعتبر logging console وحده observability production.

## Gate 9 — Production rollout

نفّذ fresh migration rehearsal، RLS/IDOR/Auth tests، image scan، TLS/DNS/HTTPS/WebSocket checks، canary، monitoring، restore drill، ثم release approval. أبقِ `BİŞİŞ_FUTURE_ENABLED=false` حتى يمر كل gate الخاص بالنسخة المحددة.

## Definition of integration-ready

يصبح domain integration-ready فقط عند وجود repository implementation، API contract، auth/tenant tests، failure/idempotency tests، feature flag، observability، rollback، وowner sign-off. وجود class محلية أو adapter interface وحده لا يساوي Production readiness.
