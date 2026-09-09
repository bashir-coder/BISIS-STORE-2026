# BİŞIŞ V1

BİŞIŞ V1 منصة خدمات أعمال ضيقة النطاق تعتمد على React/Vite في الواجهة، Node.js/Express في الـbackend، وSupabase Auth/Postgres/Storage في طبقة البيانات. مصدر الحقيقة لقاعدة البيانات هو `database/migrations/001_launch_contract.sql` ثم migrations التوفيق اللاحقة؛ `database/legacy/schema.sql` غير مستخدم في التشغيل.

> **حالة الإصدار:** Release Candidate تقنيًا، و**READY AFTER EXTERNAL CONFIGURATION**. لا يُعلن Production ولا تُقبل مدفوعات حقيقية قبل إكمال خطوات الإعداد الخارجية والاختبارات المحددة أدناه.

## Requirements

يتطلب التشغيل Node.js 20 أو أحدث، npm 10 أو أحدث، مشروع Supabase، واتصالًا بالإنترنت. Docker مطلوب فقط لتشغيل topology الخاصة بـCompose، وهو غير مطلوب للتطوير المحلي. يجب استخدام بيئة Supabase اختبارية أثناء التحقق وعدم وضع service-role key في الواجهة أو داخل bundle.

## Installation

من جذر المشروع:

```bash
npm run install:all
```

هذا الأمر يستخدم `npm ci` لكل من `backend/` و`frontend/`. للتثبيت اليدوي equivalent:

```bash
npm --prefix backend ci
npm --prefix frontend ci
```

## Environment Variables

انسخ `.env.example` إلى `.env` للـbackend، و`frontend/.env.example` إلى `frontend/.env` للواجهة. لا تنسخ أسرار backend إلى `frontend/.env`؛ كل متغير يبدأ بـ`VITE_` يصبح public داخل bundle.

| الملف/المتغير | التصنيف | الاستخدام |
|---|---|---|
| `SUPABASE_URL` | مطلوب قبل تشغيل backend | عنوان مشروع Supabase |
| `SUPABASE_SERVICE_ROLE_KEY` | مطلوب، server-only، dangerous if exposed | عمليات backend المصرح بها فقط |
| `ALLOWED_ORIGINS` | مطلوب قبل النشر | origins المسموحة للـAPI وSocket.IO |
| `VITE_SUPABASE_URL` و`VITE_SUPABASE_ANON_KEY` | مطلوبان لبناء/تشغيل frontend | Supabase client العام؛ لا يستخدم service role |
| `VITE_API_URL` | مطلوب للنشر، اختياري محليًا | عنوان backend |
| `WEB3_NETWORK`, `WEB3_RPC_URL`, `USDC_CONTRACT_ADDRESS`, `WEB3_RECIPIENT_ADDRESS`, `WEB3_REQUIRED_CONFIRMATIONS` | مطلوب فقط قبل تفعيل الدفع | Polygon USDC verifier؛ النظام fail-closed عند غيابها |
| `VITE_GOOGLE_CLIENT_ID` | اختياري | لا يكفي وحده؛ يلزم أيضًا `VITE_ENABLE_GOOGLE_OAUTH=true`، وإلا يُخفى زر Google تلقائيًا |
| `AI_PROVIDER`, `OPENAI_MODEL`, `OPENAI_API_KEY` | اختياري؛ disabled افتراضيًا | لا يمنع Core V1؛ لا يُفعّل OpenAI إلا مع provider ومفتاح صالحين |
| `RECAPTCHA_SECRET_KEY`, `EMAIL_*`, `TELEGRAM_BOT_TOKEN` | اختياري/تكاملات ثانوية | لا تمنع Core V1 إذا لم تكن الميزة مفعلة |
| `LOG_LEVEL`, `FRONTEND_URL` | development/operations | logging ومرجع frontend |

المتغيرات legacy مثل `JWT_SECRET` و`REDIS_URL` ليست جزءًا من المسار التشغيلي الحالي ولا يجب إضافتها إلى بيئة V1 الجديدة.

## Database Setup

طبّق migrations على مشروع Supabase الاختباري أو بيئة جديدة بالترتيب الموضح في [`docs/BİŞİŞ_V1_CANONICAL_MIGRATION_ORDER.md`](docs/BİŞİŞ_V1_CANONICAL_MIGRATION_ORDER.md)، ولا تستخدم `database/legacy/schema.sql`:

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

`005_execution_engine_policies.sql` auxiliary فقط ولا يُشغّل كـmigration ثانية. بعد التطبيق، تحقق من metadata وREST وRLS وsecurity advisors؛ لا تعتمد على رسالة SQL Editor وحدها، خصوصًا بعد migrations التي تغيّر schema أو RLS.

## Seed

بعد إعداد `SUPABASE_URL` و`SUPABASE_SERVICE_ROLE_KEY`:

```bash
npm run seed
```

الـseed idempotent ويقرأ `database/seeds/`. النطاق الحالي المثبت هو 18 خدمة و3 باقات و3 شخصيات و3 FAQs و1740 صف ترجمة (580 مفتاحًا × 3 لغات)، وفق `backend/scripts/check-translations.js`. persona العميل تُحفظ في `public.users.persona_id` بعد اختيار onboarding، مع fallback آمن إلى i18n canonical عند غياب جدول `persona_content`. وتشمل الترجمات microcopy الخاصة بالـCTA والثقة وARIA navigation. لا يضيف seed بيانات ضخمة أو خدمات وهمية.

## AI provider boundary

الذكاء الاصطناعي ليس شرطًا لتشغيل BİŞIŞ V1. القيمة الافتراضية في البيئة هي `AI_PROVIDER=disabled`، ويعرض `/api/ai/status` حالة المزود للمستخدم المصرّح له. لا تُفعّل مزودًا خارجيًا إلا بعد إعداد مفتاحه واختباره؛ واجهة `/chat` الحالية هي FAQ/Support محلي ولا تقدّم ردودًا مولّدة على أنها AI حي.

## Project structure

المشروع منظم إلى `frontend/` و`backend/` و`database/` و`infrastructure/` و`docs/`. النسخة العامة تحتوي فقط على المصدر الحالي والوثائق اللازمة للتشغيل؛ لا تعتمد على نسخ جذرية قديمة أو على `database/legacy/`، فالأخير مرجع تاريخي غير مستخدم في تشغيل V1. افتح مجلد المشروع الرئيسي الذي يحتوي على `package.json` في VS Code. التفاصيل الكاملة موجودة في [`docs/PROJECT_STRUCTURE.md`](docs/PROJECT_STRUCTURE.md).

## Development

شغّل الخدمتين في terminal منفصلتين:

```bash
npm run dev:backend
npm run dev:frontend
```

الـbackend يعمل افتراضيًا على `http://127.0.0.1:5000`، وVite على المنفذ المحدد في `frontend/vite.config.ts`، حاليًا 3000. مسارات التشغيل هي:

```bash
curl -i http://127.0.0.1:5000/api/live
curl -i http://127.0.0.1:5000/api/ready
curl -i http://127.0.0.1:5000/api/health
```

`/api/live` يفحص liveness فقط، و`/api/ready` يفحص وجود إعداد Supabase وإمكانية الوصول إلى جدول `users`، بينما `/api/health` يعرض الحالة العامة ولا يعني أن payment verifier مهيأ.

## Testing

أوامر التحقق الأساسية:

```bash
npm run check:backend
npm test
npm run lint
npm run typecheck
```

الأمر الموحّد للكود والاختبارات والبناء:

```bash
npm run check
```

## Build

```bash
npm run build
```

الناتج production للواجهة يوجد في `frontend/dist/`. توجد حاليًا تحذيرات حجم لبعض chunks الكبيرة؛ لا تمنع build لكنها موضوع performance منفصل.

## Production Check

```bash
npm run production:check
```

يشغّل `npm run install:all` كـclean install فعلية، ثم `check` وproduction audit. في الحالة الحالية سيفشل عند frontend audit بسبب advisoryين moderate في React Router 6.x؛ تجربة Router 7.18.2 فشلت typecheck بسبب تغيّر BrowserRouter props وأُعيد rollback، لذلك لا تستخدم `npm audit fix --force` بلا branch واختبارات توافق.

## Production Deployment

توفر `infrastructure/docker-compose.yml` ثلاث خدمات: frontend، backend، وnginx. nginx يمرر `/api/` و`/socket.io/` إلى backend ويترك frontend يتولى SPA fallback. قبل النشر يجب تشغيل:

```bash
docker compose -f infrastructure/docker-compose.yml config
docker compose -f infrastructure/docker-compose.yml build
docker compose -f infrastructure/docker-compose.yml up -d
```

لم تُثبت هذه الأوامر في بيئة التحقق الحالية لأن Docker CLI غير متاح؛ لا تعتبر Compose أو nginx runtime ناجحين قبل تشغيلها على CI أو جهاز يحوي Docker.

## Required External Configuration

قبل الإطلاق العام يجب على مالك البيئة تنفيذ ما يلي:

1. تأكيد مشروع Supabase production الصحيح، وتطبيق migrations بالترتيب، والتحقق من RLS وStorage.
2. وضع `SUPABASE_SERVICE_ROLE_KEY` في backend secret store فقط، ووضع anon key في `frontend/.env` أو build secret المناسب.
3. ضبط `ALLOWED_ORIGINS` و`VITE_API_URL` على domain الإنتاج الحقيقي.
4. تهيئة Polygon RPC وUSDC contract وrecipient EOA وconfirmations، ثم تنفيذ testnet payment E2E. قبل ذلك يبقى الدفع محجوبًا برسالة واضحة.
5. إعداد Google OAuth في Google Cloud وSupabase: client ID، authorized origins، redirect URLs، ثم اختبار login/profile provisioning في browser.
6. تشغيل Docker/Compose وnginx/WebSocket healthchecks، ثم اختبار private Storage upload/download والعزل بين مستخدمين.

## V1 Surface Policy

المسار العام يعرض Home وAbout وPackages وFAQ وContact وLogin وChat FAQ. تم إخفاء Routes الخاصة بـblog وportfolio وdigital-products وdonate وlife-plan لأنها placeholder أو خارج Core V1، مع إبقاء الملفات في المستودع إلى حين قرار archive نهائي. مداخل الطلب الجديدة تعيد المستخدم إلى packages حتى لا يصل إلى payment بلا package ID canonical. عند غياب verifier، تعرض PaymentPage حالة blocked ولا تعرض نموذج إرسال دفع.

## Admin Catalog

حسابات `admin` و`super_admin` تملك Catalog Manager داخل `/admin` لإدارة الخدمات والباقات وFAQs عبر create/edit/soft-archive. القراءة العامة تعرض العناصر النشطة فقط، بينما المسارات `/api/{services,packages,faqs}/admin` محمية عموديًا. لا يُستخدم هذا السطح لتوسيع نطاق V1؛ يظل الكتالوج seed canonical عند 18/3/3.

## Launch Checklist

القائمة التنفيذية التفصيلية في `docs/FINAL_LAUNCH_CHECKLIST.md`، مع الاحتفاظ بـ`LAUNCH_CHECKLIST.md` كمرجع تاريخي. لا تُعلّم أي بند مكتملًا إلا بدليل تشغيل فعلي.

## Project Layout

```text
frontend/       React + Vite + TypeScript + Supabase client
backend/        Node.js + Express + Supabase service-role API
database/       migrations, seeds, and structured seed sources
infrastructure/ Docker Compose and nginx configuration
docs/           launch map and verification documentation
```

لا توجد نسخ جذرية قديمة مطلوبة للتشغيل؛ مصدر الحقيقة هو المسارات الحالية وcanonical migrations الموضحة أعلاه.

## Public GitHub readiness

النسخة العامة مصممة لتكون آمنة للنشر في GitHub: ملفات `.env` المحلية والـdependencies والـbuilds والـlogs والأرشيفات المحلية خارج المستودع، بينما تبقى ملفات `.env.example` والقوالب المنقحة فقط. شغّل `npm run secrets:check` قبل أي push. نتيجة الفحص لا تُثبت سلامة Git history إذا كان المستودع المحلي بلا مجلد `.git`؛ لذلك يجب إنشاء مستودع جديد من النسخة المنظفة أو تنفيذ secret scan مستقل على أي تاريخ سابق قبل جعله عامًا.

لا ترفع service-role key أو Client Secret أو SMTP password أو wallet private key أو أي ملف ZIP قديم يحتوي بيانات محلية. إذا سبق نشر سر حقيقي في مستودع أو دردشة، يجب تدويره عند المزود حتى لو حُذف الملف لاحقًا.

## Free deployment readiness

المشروع جاهز تقنيًا للنشر على استضافة مجانية أو منخفضة التكلفة **بعد** توفير أسرار الخادم وURL حقيقي وHTTPS. الواجهة Vite يمكن بناؤها كملفات static، والـbackend Node/Express يحتاج خدمة Node طويلة التشغيل أو container، وCompose/nginx يصف topology كاملة عندما يتوفر Docker. لا يوجد deploy تلقائي مفعّل هنا ولا يُدّعى أن أي مزود مجاني أو Docker runtime تم اختباره في هذه البيئة.

للنشر المجاني افصل frontend وbackend إذا كانت المنصة لا تدعم Compose: ابنِ الواجهة عبر `npm run build`، خدم `frontend/dist` كـstatic site، شغّل backend عبر `npm start`، واضبط `VITE_API_URL` و`ALLOWED_ORIGINS` على HTTPS URLs حقيقية. لا تضع `SUPABASE_SERVICE_ROLE_KEY` ضمن build args أو frontend variables. بعد النشر نفّذ `/api/live` و`/api/ready` و`/api/health` واختبار login/RLS يدويًا قبل قبول أي مستخدم.

## CI and release gate

يحتوي `.github/workflows/BİŞİŞ-quality.yml` على تثبيت lockfiles وفحوص migration/env/deployment/secrets ثم backend tests وlint وtypecheck وbuild. استخدم `npm run release:check` محليًا قبل الإصدار. advisory moderate الحالية في frontend لا تُعالج بـ`npm audit fix --force` دون branch واختبار توافق.

## Known limitations

Password recovery UX غير مضاف في واجهة V1 الحالية. Storage لا يملك bucket contract مُثبتًا في migrations، لذلك لا ينبغي إنشاء bucket عشوائيًا. إعداد SMTP وGoogle OAuth وleaked-password protection والدفع الحقيقي وdomain/TLS وbackup/monitoring هي external gates. لذلك تبقى الحالة **READY FOR STAGING / CONDITIONAL FOR CANARY** وليست Production Ready.

## Operational expansion routes

أضيفت طبقة تشغيلية فوق عقد V1 الحالي دون تغيير قاعدة البيانات أو Auth. مسار `/admin` يحتوي Command Center وQuick Actions، ومسار `/workbench` يعرض العمل الجاري والمنتظر والمكتمل، ومسار `/clients` يعرض Client 360 للإدارة فقط عبر endpoint محمي، ومسار `/projects/:id` يعرض Project Workspace المبني على الطلبات المرتبطة ودورة حياتها. هذه المسارات لا تنشئ tasks أو milestones أو automation وهمية؛ أي توسعة لاحقة لهذه المفاهيم تحتاج migration وRLS واختبارات IDOR منفصلة.

عدد مفاتيح الترجمة الحالي هو **580 مفتاحًا و1740 صفًا** عبر العربية والإنجليزية والتركية، مع 0 مفاتيح مكررة و0 صفوف ناقصة وفق مدقق الترجمات. حد AI ما زال `AI_PROVIDER=disabled` افتراضيًا، والدفع وGoogle OAuth وProduction deployment متطلبات إعداد خارجية.
