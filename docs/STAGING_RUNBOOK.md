# BİŞIŞ V1 — Staging Runbook

هذا الدليل مخصص لمشروع Supabase Staging مستقل disposable. لا يُستخدم على Production، ولا يتضمن reset أو حذفًا أو أسرارًا. لا تُعتبر أي نتيجة ناجحة بناءً على شاشة SQL Editor وحدها؛ يجب التحقق من metadata والسلوك الفعلي.

## 1. Preflight

قبل أي تغيير، تحقق من اسم المشروع ومرجعه داخل لوحة Supabase وسجّل أنه Staging. لا تنقل أي service-role key من Production. من جذر المستودع:

```bash
npm run install:all
npm run migration:check
npm run env:check
npm run deployment:check
npm run secrets:check
npm run check
npm run release:check
```

إذا فشل أمر ما، احفظ الخطأ المنقح دون tokens أو credentials، ولا تتجاوز البوابة بتغيير exit code.

## 2. Apply the canonical database chain

طبّق الملفات التالية بالترتيب على Staging فارغ:

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

المسار الكامل هو `database/migrations/`. الملف `005_execution_engine_policies.sql` مادة SQL مساعدة فقط ولا يُشغّل كـmigration إضافية. لا تستخدم `database/legacy/schema.sql` ولا تعدّل migrations `001–007`.

بعد التطبيق نفّذ read-only verification للجداول، الأعمدة، العلاقات، constraints، indexes، RLS، policies، functions، triggers، وledger. إذا استُخدم SQL Editor على دفعات، سجّل كل دفعة ونتيجتها دون حفظ بيانات اعتماد.

## 3. Auth provisioning test

أنشئ Customer A وCustomer B فقط ببيانات اختبار جديدة عبر Auth Admin أو المسار الحقيقي المعتمد. لا تنشئ `public.users` يدويًا. لكل مستخدم تحقق من:

```text
auth.users.id = public.users.id
public.users.role = client
email(Auth) = email(public.users)
```

اختبر login و`/api/auth/me` باستخدام session حقيقية. تسجيل الدخول بكلمة المرور لا يعني أن SMTP أو password recovery يعملان؛ اختبارات البريد تحتاج Supabase Auth/SMTP configuration خارجية.

## 4. RLS and IDOR verification

باستخدام publishable/anon key وJWT لكل عميل، اختبر القراءة والوصول المتقاطع في:

```text
users
workspaces
workspace_members
orders
conversations
messages
invoices
notifications
order_files
```

يجب أن يرى Customer A موارده فقط، وأن يُرفض وصوله إلى موارد Customer B، والعكس. استخدم service-role فقط لإعداد fixtures والتنظيف، وليس لإثبات صلاحيات العميل. اختبر أيضًا role boundaries للعميل مقابل staff، وSocket.IO join/send على conversation مسموحة فقط.

## 5. Storage decision gate

افحص Storage قبل إنشاء أي bucket. لا تنشئ `order-files` تلقائيًا من هذا الدليل؛ لا يوجد عقد V1 عام يبرر اختراع bucket أو policy إذا لم تكن مثبتة في البيئة المستهدفة. قبل اعتماد Storage يجب تحديد bucket name، private/public visibility، MIME allow-list، maximum size، ownership، retention، signed URL expiry، وobject backup.

بعد اعتماد العقد فقط، اختبر upload للمالك، رفض MIME والحجم، signed download مؤقت، رفض العميل الآخر، cleanup، وbackup/restore للـobjects. لا تعتبر route authorization وحدها backup proof.

## 6. Optional Google OAuth

Google OAuth مغلق افتراضيًا. لا تفعّله إلا إذا كان مطلوبًا من المالك. عندها:

1. أنشئ Web OAuth Client مخصصًا للـStaging.
2. أضف frontend origin الحقيقي إلى Authorized JavaScript origins.
3. أضف Callback URL الذي يعرضه Supabase إلى Authorized redirect URIs.
4. فعّل Google Provider في Supabase وأدخل Client ID وClient Secret في لوحة Supabase أو secret manager.
5. ابنِ frontend مع `VITE_ENABLE_GOOGLE_OAUTH=true` وClient ID العام فقط.
6. اختبر redirect وprofile provisioning في browser حقيقي.

لا تحفظ Client Secret في frontend أو Git، ولا تعتبر ظهور الزر نجاحًا.

## 7. Deployment environment

### Backend root `.env` or managed secrets

```env
NODE_ENV=production
PORT=5000
SUPABASE_URL=<staging-project-url>
SUPABASE_SERVICE_ROLE_KEY=<server-only-secret>
ALLOWED_ORIGINS=<exact-https-frontend-origin>
TRUST_PROXY_HOPS=1
AI_PROVIDER=disabled
```

Backend يقرأ root `.env` محليًا، وليس `backend/.env`. لا تطبع env values ولا تستخدم localhost في production-like CORS.

### Frontend `frontend/.env`

```env
VITE_SUPABASE_URL=<staging-project-url>
VITE_SUPABASE_ANON_KEY=<public-key>
VITE_API_URL=
VITE_ENABLE_GOOGLE_OAUTH=false
VITE_GOOGLE_CLIENT_ID=
```

اترك `VITE_API_URL` فارغًا عند same-origin Nginx، أو ضعه كعنوان HTTPS كامل للbackend عند split deployment. كل `VITE_*` يصبح public في bundle.

## 8. Compose commands

من جذر المشروع:

```bash
docker compose -f infrastructure/docker-compose.yml config
docker compose -f infrastructure/docker-compose.yml build
docker compose -f infrastructure/docker-compose.yml up -d
docker compose -f infrastructure/docker-compose.yml ps
docker compose -f infrastructure/docker-compose.yml logs --tail=100 backend
```

لا تشارك مخرجات `config` أو logs إذا تضمنت values. يجب أن تكون الخدمات الثلاث frontend/backend/nginx healthy، وأن يكون backend قادرًا على `/api/ready`.

## 9. Runtime browser sequence

| الترتيب | الفحص | النجاح المطلوب |
|---:|---|---|
| 1 | `/api/live` | HTTP 200 وحالة `LIVE` |
| 2 | `/api/ready` | HTTP 200 وحالة `READY` مع database reachable، أو 503 `NOT_READY` عند failure |
| 3 | `/api/health` | حالة صادقة؛ `DEGRADED` عند payment verifier missing ولا يفتح checkout |
| 4 | SPA refresh | `/packages`, `/login`, `/dashboard`, `/chat` تعمل بعد refresh |
| 5 | Auth | signup/login/logout/session expiry برسائل عامة |
| 6 | RLS/IDOR | A/B isolation على الموارد الحساسة |
| 7 | Socket.IO | authorization حقيقية وjoin/send للمحادثات المسموحة فقط |
| 8 | Storage | فقط بعد اعتماد contract؛ upload/download/expiry/cross-client denial |
| 9 | Google | فقط عند provider حقيقي؛ no fake success |
| 10 | Payment | يبقى blocked عند غياب verifier؛ لا fake transaction |

## 10. Payment gate

الدفع لا يُفعّل من هذا الدليل. قبل أي testnet أو controlled transaction يحتاج المالك إلى اعتماد network، canonical USDC contract، recipient EOA، RPC provider، confirmation policy، وrunbook للتعامل مع replay وRPC failures وreorgs. بعد اعتماد القيم فقط اختبر exact chain/token/recipient/amount/confirmations، atomic status transition، duplicate transaction rejection، wrong token/chain/recipient، underpayment، overpayment، malformed hash، insufficient confirmations، وRPC timeout.

لا تُستخدم placeholder values ولا transaction حقيقية دون owner confirmation، ولا يُسجل transaction hash في مستودع عام.

## 11. Cleanup and rollback

استخدم marker واضحًا لكل fixture. نظّف فقط fixtures المنشأة في هذه الجولة، ثم نفّذ read-only marker verification. لا تحذف users أو data غير مرتبطة بالاختبار.

للـapplication rollback أعد frontend/backend إلى آخر artifact immutable. لا تشغّل reverse migrations عشوائية. للـdatabase incident اعزل الكتابة، احفظ evidence منقحًا، واستعد إلى مشروع منفصل عبر backup/PITR مع استعادة Storage objects من backup مستقل. بعد rollback أعد Auth/RLS/API/Storage smoke قبل إعادة traffic.

## 12. Exit criteria

لا يُعتبر Staging جاهزًا للـcanary إلا بعد نجاح migration/schema verification، Auth ID equality، RLS/IDOR، runtime health/readiness، SPA refresh، WebSocket، Storage contract إن كان مطلوبًا، وCI/release gates. لا يعني ذلك Production readiness؛ Production يحتاج Supabase/domain/TLS/secret manager/backup/monitoring/provider configuration منفصلة.
