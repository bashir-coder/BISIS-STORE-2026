# BİŞIŞ V1 — Migration Reproducibility Checklist

## Boundary

نفّذ هذا الإجراء على قاعدة Supabase disposable جديدة أو فرع Staging مخصص فقط. لا تستخدم Production، ولا تنفذ reset أو destructive cleanup على أي بيئة غير مصنفة بوضوح. لا تعدّل migrations `001–007`، ولا تستخدم `database/legacy/schema.sql`.

## Canonical source

السلسلة المعتمدة هي:

```text
001_launch_contract.sql
002_v1_runtime_reconciliation.sql
003_services_metadata_reconciliation.sql
004_public_catalog_rls_reconciliation.sql
005_execution_engine.sql
006_service_delivery_engine.sql
007_execution_client_isolation_hotfix.sql
008_project_aware_tickets.sql
009_tickets_policy_isolation_hotfix.sql
010_production_security_hardening.sql
011_performance_foreign_key_indexes.sql
```

`005_execution_engine_policies.sql` ملف مساعد فقط، وليس migration إضافية.

## Preflight

من جذر المستودع:

```bash
npm run migration:check
npm run env:check
npm run secrets:check
```

سجّل hashes التي يطبعها `migration:check` داخل release record. لا تسجل أي secret أو database URL كامل في artifact عام.

## Fresh database procedure

1. أنشئ أو اختر قاعدة disposable منفصلة وسجّل هويتها في سجل داخلي غير عام.
2. طبّق migrations `001` إلى `011` بالترتيب، باستخدام آلية migration معتمدة تحفظ ledger قابلًا للمراجعة.
3. لا تشغّل ملف `005_execution_engine_policies.sql` مستقلًا.
4. لا تشغّل seed أو Auth fixtures قبل نجاح schema migration.
5. افحص read-only: tables/columns، primary keys، foreign keys، unique/check constraints، indexes، RLS state، policies، functions، triggers، وmigration ledger.
6. شغّل Supabase security/performance advisors، وسجّل severity والـremediation URLs دون identifiers حساسة.
7. نفّذ Auth smoke لـCustomer A/B على Staging فقط، ثم RLS/IDOR tests بجلسات client حقيقية وpublishable/anon key، واستخدم service-role فقط للـfixture setup/cleanup.
8. شغّل backend integration/API smoke، ثم cleanup marker-scoped وتحقيق counts read-only.

## Acceptance criteria

| Gate | Required result |
|---|---|
| File chain | 001–011 present, ordered, hashed، لا unexpected numbered SQL |
| Historical boundary | 001–007 unchanged، legacy schema غير مستخدم |
| Ledger | كل migration مطبقة عبر آلية تحفظ migration history قابلة للمراجعة |
| Schema | expected tables, FKs, constraints, indexes, functions, triggers موجودة |
| Security | RLS/policies مطابقة للعقد، ولا anonymous sensitive access غير مقصود |
| Auth | Auth ID يساوي `public.users.id`، role العميل `client`، email مطابق |
| Isolation | Customer A/B لا يتبادلان resources أو files أو conversations أو invoices أو notifications |
| Runtime | `/api/live`، `/api/ready`، API smoke، وSocket authorization ناجحة |
| Cleanup | لا تبقى fixtures التي أنشأها الاختبار |

## If Supabase CLI or fresh database is unavailable

لا تدّعِ clean reproducibility. شغّل فقط `npm run migration:check`، واستخدم SQL Editor أو MCP على Staging وفق موافقة المالك، وسجّل أن ledger/fresh reset **OPEN / EXTERNAL INFRASTRUCTURE REQUIRED**. لا تحوّل نجاح تطبيق migration على قاعدة موجودة إلى دليل fresh-chain.

## Release record

احتفظ داخليًا بتاريخ التنفيذ، target classification، migration hashes، ledger result، advisor summary، test commands/results، cleanup result، واسم release commit. لا تحفظ في المستودع العام secrets أو project refs الخاصة أو customer UUIDs أو raw Auth evidence.
