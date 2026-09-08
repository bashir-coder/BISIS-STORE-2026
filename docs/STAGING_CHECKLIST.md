# BİŞIŞ V1 — Staging Validation Checklist

هذا المستند يحدد التحقق المطلوب على **مشروع Staging مستقل disposable** قبل أي Production rollout. لا تُنفّذ أي خطوة SQL أو Auth أو Storage على Production. لا تستخدم `database/legacy/schema.sql`، ولا تعدّل migrations التاريخية `001–007`.

## A. Local developer verification

من جذر المستودع وباستخدام Node.js 22.x:

```bash
npm run install:all
npm run migration:check
npm run env:check
npm run deployment:check
npm run secrets:check
npm run check
npm run release:check
```

النتيجة المتوقعة هي نجاح البوابات مع بقاء أي تحذيرات موثقة فقط. لا تُعتبر `npm run production:check` ناجحة إذا أوقفها advisory أمني متوسط معروف؛ لا تستخدم `npm audit fix --force` دون compatibility branch.

إذا كان Docker متاحًا على host النشر، نفّذ من جذر المشروع:

```bash
docker compose -f infrastructure/docker-compose.yml config
docker compose -f infrastructure/docker-compose.yml build
docker compose -f infrastructure/docker-compose.yml up -d
docker compose -f infrastructure/docker-compose.yml ps
```

إذا لم يكن Docker متاحًا، سجّل ذلك كـ`EXTERNAL INFRASTRUCTURE REQUIRED` ولا تستبدله بنتيجة static validator.

## B. Database and migrations

على مشروع Staging فارغ ومؤكد الهوية، طبّق الترتيب التالي فقط:

```text
database/migrations/001_launch_contract.sql
database/migrations/002_v1_runtime_reconciliation.sql
database/migrations/003_services_metadata_reconciliation.sql
database/migrations/004_public_catalog_rls_reconciliation.sql
database/migrations/005_execution_engine.sql
database/migrations/006_service_delivery_engine.sql
database/migrations/007_execution_client_isolation_hotfix.sql
database/migrations/008_project_aware_tickets.sql
database/migrations/009_tickets_policy_isolation_hotfix.sql
database/migrations/010_production_security_hardening.sql
database/migrations/011_performance_foreign_key_indexes.sql
```

لا تشغّل `005_execution_engine_policies.sql` كـmigration ثانية؛ هو SQL مساعد لتقسيم دفعات SQL Editor. بعد التطبيق، تحقق read-only من الجداول، الأعمدة، primary/foreign keys، constraints، indexes، RLS، policies، functions، triggers، وmigration ledger. نجاح SQL Editor وحده لا يثبت clean reproducibility.

## C. Auth and RLS

تحقق من Auth trigger بإنشاء Customer A وCustomer B اختباريين فقط على Staging، دون إنشاء profile يدوي. يجب إثبات أن `auth.users.id = public.users.id`، وأن `public.users.role = client`، وأن البريد متطابق. استخدم جلسات password أو provider حقيقية عند اختبار صلاحيات العميل؛ لا تستخدم service-role لإثبات client access.

اختبر عزل A/B على `users`, `workspaces`, `workspace_members`, `orders`, `conversations`, `messages`, `invoices`, `notifications`, و`order_files`. يجب أن يرى كل عميل موارده فقط، وأن يعيد الوصول المتقاطع رفضًا مناسبًا مثل 403 أو 404، مع cleanup marker-scoped بعد الاختبار والتحقق من عدم بقاء fixtures.

صنّف كل public table إلى public-readable أو authenticated-only أو client-isolated أو staff/admin-only أو backend-only أو intentionally unused/internal. لا تضف policies عامة لمجرد إسكات Advisor؛ الجداول المقصودة fail-closed يجب أن تبقى بلا public policy إلى أن يعتمد المالك عقدًا لها.

## D. Storage

افحص buckets وpolicies قبل أي إنشاء. إذا لم يوجد V1 Storage contract واضح يحدد الاسم، visibility، MIME limits، size limits، retention، ownership، وbackup، **لا تنشئ bucket ولا policy من التخمين**. المسار الحالي لا يثبت bucket جديدة تلقائيًا.

إذا اعتمد المالك Storage contract، اختبر backend authorization وMIME/size limits وsigned URL expiry والتنزيل للمالك ورفض العميل الآخر، ثم اختبر backup مستقلًا للـobjects. قاعدة البيانات وحدها لا تثبت استعادة الملفات.

## E. Supabase Auth and external providers

Email/password هو المسار الأساسي. يجب ضبط Auth site URL وredirect allow-list وفق origin حقيقي. SMTP وemail confirmation وpassword recovery اختبارات خارجية اختيارية، ولا يعني نجاح login العادي وصول رسالة بريد.

Google OAuth **اختياري ومغلق افتراضيًا**. لا تفعّله إلا بعد إعداد Google Cloud OAuth client، Supabase provider، exact authorized origins، وSupabase callback URL، ثم اختبار browser حقيقي. لا تضع client secret في frontend ولا في Git.

Leaked-password protection ما زال قرارًا خارجيًا في Supabase Auth؛ تفعيله يحتاج owner confirmation لأنه يغير سلوك التسجيل وكلمات المرور.

## F. Environment separation

### Backend

يُحقن في secret manager أو root `.env` غير المتتبع، وليس `backend/.env`:

```env
NODE_ENV=production
PORT=5000
SUPABASE_URL=<selected-staging-project-url>
SUPABASE_SERVICE_ROLE_KEY=<server-only-secret>
ALLOWED_ORIGINS=<exact-https-frontend-origin>
TRUST_PROXY_HOPS=1
AI_PROVIDER=disabled
```

لا تُنقل أسرار OAuth أو SMTP أو payment إلى frontend. `ALLOWED_ORIGINS` إلزامي في production-like deployment، ولا تستخدم localhost خارج التطوير المحلي.

### Frontend

يُبنى من `frontend/.env` غير المتتبع أو build secret configuration:

```env
VITE_SUPABASE_URL=<selected-staging-project-url>
VITE_SUPABASE_ANON_KEY=<public-anon-or-publishable-key>
VITE_API_URL=
VITE_ENABLE_GOOGLE_OAUTH=false
VITE_GOOGLE_CLIENT_ID=
```

اترك `VITE_API_URL` فارغًا مع same-origin Nginx، أو استخدم HTTPS backend origin كاملًا في split deployment.

## G. Browser and runtime checks

نفّذ من browser حقيقي على Staging:

| الفحص | النتيجة المطلوبة |
|---|---|
| `/api/live` | HTTP 200 وحالة `LIVE` دون فحص dependencies |
| `/api/ready` | HTTP 200 وحالة `READY` فقط عندما تكون قاعدة البيانات reachable؛ وإلا 503 `NOT_READY` |
| `/api/health` | يعكس configuration؛ payment missing يجب أن يظهر `DEGRADED` ولا يفتح checkout |
| SPA refresh | `/packages`, `/login`, `/dashboard`, و`/chat` تعود إلى التطبيق بدل 404 |
| Auth | signup/login/logout/session expiry تعمل برسائل عامة بلا secrets |
| RLS/IDOR | Customer A لا يصل إلى Customer B والعكس صحيح |
| Socket.IO | token حقيقي، join/send مصرحان فقط للمحادثة المسموحة |
| Upload/download | فقط بعد اعتماد Storage contract، مع signed URL مؤقت ورفض cross-client |
| Google | لا يُختبر إلا إذا كان provider مهيأً فعليًا؛ لا fake success |
| Payment | يبقى blocked عند غياب verifier؛ لا fake transaction أو mainnet test بلا owner approval |

## H. Cleanup and evidence

استخدم fixtures ذات marker واضح، ونفّذ cleanup محدودًا بالـmarker فقط. تحقق read-only من أن counts بعد cleanup صفر للـworkspaces/orders/projects/templates والكيانات التي أنشأها الاختبار. احفظ evidence المنقح خارج المستودع أو دون UUIDs/emails/tokens/secrets. لا ترفع screenshots أو raw JSON authenticated إلى public GitHub.

## I. Production gate

لا ينتقل Staging إلى Production إلا بعد إغلاق أو قبول مكتوب للعناصر التالية: Production Supabase identity، clean migration rehearsal، TLS/domain، managed secrets، backup/restore للـDB وStorage، monitoring/alerts، Docker/NGINX runtime، قرار React Router advisory، Google OAuth إن كان مطلوبًا، وpayment verifier بمعاملة حقيقية صحيحة فقط إذا اعتمدها المالك.
