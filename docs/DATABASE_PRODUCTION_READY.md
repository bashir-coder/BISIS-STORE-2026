# BİŞIŞ V1 — DATABASE_PRODUCTION_READY

**تاريخ المراجعة:** 25 أغسطس 2026  
**البيئة المفحوصة:** Supabase disposable test project فقط.  
**Production status:** غير مفحوصة وغير منشورة.  
**الحكم:** **Database hardening verified on test؛ Production database ليست READY حتى يتم clean migration rehearsal مستقل.**

## Canonical migration checklist

| # | Migration | حالة الملف | قاعدة التنفيذ |
|---:|---|---|---|
| 001 | `001_launch_contract.sql` | canonical base | أول ملف على قاعدة فارغة |
| 002 | `002_v1_runtime_reconciliation.sql` | canonical reconciliation | بعد 001 |
| 003 | `003_services_metadata_reconciliation.sql` | canonical reconciliation | بعد 002 |
| 004 | `004_public_catalog_rls_reconciliation.sql` | canonical RLS/catalog | بعد 003 |
| 005 | `005_execution_engine.sql` | canonical execution engine | بعد 004 |
| 006 | `006_service_delivery_engine.sql` | canonical Service Delivery | بعد 005 |
| 007 | `007_execution_client_isolation_hotfix.sql` | canonical security hotfix | بعد 006 |
| 008 | `008_project_aware_tickets.sql` | canonical ticket isolation | بعد 007 |
| 009 | `009_tickets_policy_isolation_hotfix.sql` | canonical ticket hotfix | بعد 008 |
| 010 | `010_production_security_hardening.sql` | additive hardening | بعد 009 وبعد اعتماد release |

`005_execution_engine_policies.sql` ملف auxiliary للتشغيل/التوثيق في SQL Editor، وليس migration ثانية. `database/legacy/schema.sql` مستبعد من V1.

## Live schema evidence

استعلام metadata الحي بعد تطبيق 010 أعاد **32 public tables، 32 RLS-enabled، و0 RLS-disabled**. جميع الجداول التي لا تملك policy مخصصة تعمل deny-by-default بسبب RLS وعدم وجود grants client مناسبة؛ لا ينبغي تفسير advisor `rls_enabled_no_policy` كـpublic read تلقائيًا.

| الفحص | النتيجة |
|---|---:|
| public tables | 32 |
| tables with RLS enabled | 32 |
| tables with RLS disabled | 0 |
| tables with one or more RLS policies | 25 |
| RLS-enabled tables without policies | 7، وهي catalog/legacy surfaces أو `table_name`، وتحتاج owner classification |
| `public.table_name` client SELECT | false |
| `public.table_name` service-role read/write | true |

الجداول التشغيلية الأساسية `users`, `workspaces`, `workspace_members`, `orders`, `conversations`, `messages`, `invoices`, `notifications`, `order_files`, `projects`, `project_tasks`, `project_requirements`, `project_deliveries`, و`tickets` مفعّل عليها RLS. وقد اجتازت client isolation وIDOR checks في live smoke السابق والنهائي.

## Policies and grants

بعد 010، الجدول `public.table_name` لا يملك policy ولكنه محمي بـRLS، وتم سحب SELECT/INSERT/UPDATE/DELETE من anon وauthenticated مع إبقاء service-role. هذا hardening غير تدميري؛ لم يتم حذف الجدول أو الصفوف.

الـexecution helpers بقيت قابلة للتنفيذ من `authenticated` لأن policies الحالية تستخدمها، مع منع anon المباشر. `handle_supabase_auth_user` و`verify_payment_and_order` أصبحا غير قابلين للتنفيذ من anon/authenticated، مع إبقاء server/service-role execution حيث يلزم. هذا يزيل anonymous RPC surface دون كسر مسار RLS الحالي.

| Function family | anon | authenticated | service_role | Reason |
|---|---:|---:|---:|---|
| `execution_role`, `execution_is_staff` | false | true | true | RLS helper path |
| `execution_can_access_project`, `execution_client_can_access_project` | false | true | true | RLS helper path |
| `handle_supabase_auth_user` | false | false | true | trigger/server boundary |
| `verify_payment_and_order` | false | false | true | payment server boundary |

## Functions, triggers, and search paths

metadata الحي يثبت وجود auth provisioning trigger على `auth.users` إلى `public.handle_supabase_auth_user`. كما أن الوظائف الحساسة المفحوصة تحمل `search_path=public` بعد migration 010، بما في ذلك `get_services_by_persona(integer)`, `update_updated_at_column()`, `handle_supabase_auth_user()`, و`verify_payment_and_order(...)`.

بقاء بعض authenticated SECURITY DEFINER warnings مقصود ومفتوح للمراجعة، لأن تحويل helpers إلى invoker أو private schema يحتاج إعادة تصميم واختبارات RLS؛ لم يُنفذ سحب عشوائي قد يكسر authorization.

## Foreign keys and indexes

`list_tables(verbose=true)` يثبت وجود primary keys وforeign-key relationships الأساسية، بما فيها ownership chain `projects → orders → users/workspaces`، وعلاقات execution وtickets وfiles وnotifications. Supabase performance advisors ما زالت تشير إلى foreign keys غير مغطاة بفهرس في عدة جداول، وإلى auth RLS init-plan warnings. هذه ليست integrity failures، لكنها performance follow-up قبل التوسع، ولا يجوز إضافة indexes غير مقاسة إلى release gate الحالي دون workload/EXPLAIN evidence.

## Security advisor status after 010

| Advisor category | Current state |
|---|---|
| RLS disabled table | أُغلق للجدول `public.table_name`؛ لا يوجد RLS-disabled public table في direct count |
| RLS enabled without policy | بقي في 7 جداول؛ deny-by-default ويحتاج classification |
| anon SECURITY DEFINER execute | أُغلق للـfunctions التي عالجها 010 |
| authenticated SECURITY DEFINER execute | بقي للـexecution helpers المستخدمة من RLS؛ قرار معماري مفتوح |
| mutable search path | أُغلق للوظائف المحددة في 010 |
| leaked password protection | إعداد Auth خارجي ما زال يحتاج تفعيلًا من owner |
| unindexed FKs/RLS init plans | performance findings باقية وتحتاج قياس production-like |

## Verification commands and evidence

| Check | Result | Evidence |
|---|---|---|
| apply 010 on disposable test | PASS | Supabase apply result `success=true` |
| public table/RLS count | PASS | 32/32 RLS-enabled، 0 disabled |
| table_name grants | PASS | anon/authenticated false، service-role true |
| function ACL verification | PASS جزئي | anon direct false؛ authenticated execution helpers true by design |
| search_path verification | PASS | `search_path=public` للوظائف المحددة |
| live Service Delivery/RLS smoke | PASS | `SERVICE_DELIVERY_LIVE_SMOKE_PASS`، cleanup true |
| populated browser E2E | PASS | 28 checks، cleanup true |
| marker cleanup verifier | PASS | users/workspaces/orders/projects/templates = 0 |
| clean 001–010 rehearsal | NOT VERIFIED | لا توجد Supabase CLI project/ledger تاريخية كاملة في checkout |

## Production database gate

قبل نقل هذه القاعدة إلى Production، يجب تشغيل السلسلة 001–010 على Supabase staging/fresh project، ثم مقارنة tables, columns, constraints, FKs, indexes, functions, triggers, RLS, policies, grants، وsecurity/performance advisors. يجب حفظ migration ledger من أداة الإصدار، لا الاكتفاء بلصق SQL في SQL Editor. بعد ذلك تُشغّل seeds والـverification scripts، ثم browser/RLS smoke، ثم restore drill إلى مشروع منفصل.

هذا الملف يثبت أن hardening الداخلي قابل للمراجعة على test environment. لا يثبت أن Production Supabase موجودة، ولا يثبت OAuth/payment/TLS/backup أو deployment. لذلك يبقى قرار Production **NO-GO** حتى إغلاق owner/infrastructure gates.

## References

[1]: [BİŞIŞ V1 Canonical Migration Order](BISIS_V1_CANONICAL_MIGRATION_ORDER.md)  
[2]: [Migration 010 production security hardening](../database/migrations/010_production_security_hardening.sql)  
[3]: [Supabase Row Level Security](https://supabase.com/docs/guides/database/postgres/row-level-security)  
[4]: [Supabase Database Backups](https://supabase.com/docs/guides/platform/backups)  
