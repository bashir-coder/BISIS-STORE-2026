# BİŞIŞ V1 — Database & Runtime Verification Report

**تاريخ الإصدار:** 24 أغسطس 2026  
**البيئة:** مشروع Supabase اختباري مستقل وفق تأكيد المؤسس؛ معرّف المشروع غير مضمّن في النسخة العامة.  
**النطاق:** توحيد BİŞIŞ V1 الضيق بين `frontend/`, `backend/`, `database/`, وSupabase، ثم إثبات البناء والاختبارات والمصادقة وAPI والعزل والتخزين والدفع الآمن.

> **ملاحظة زمنية:** هذا تقرير تاريخي سابق لإضافة migrations 010 و011؛ يُستخدم كسجل أدلة فقط، وتحدد الوثائق الأحدث حالة الإصدار الحالية.

> **الحكم النهائي:** الكود الأساسي وDatabase Contract الخاصان بـV1 قابلان للبناء والتشغيل والانتقال إلى اختبارات القبول وإعداد التكاملات، لكن المشروع **ليس Production-ready** بعد. استقبال الأموال الحقيقية محجوب حتى تهيئة payment verifier، كما أن Google OAuth وDocker وbrowser E2E لم تُثبت بالكامل.

## A) Executive Summary — الملخص التنفيذي

تم تحويل المسار التشغيلي من مستودع متعدد النسخ إلى مسار V1 واضح: React/Vite في الواجهة، Node/Express في الـbackend، وSupabase Auth/Postgres/Storage في طبقة البيانات. مصدر الحقيقة هو `database/migrations/001_launch_contract.sql` ثم migrations التوفيق 002–004؛ أما `database/legacy/schema.sql` فلم يُستخدم في التشغيل أو الدمج.

تم توحيد المصادقة على Supabase sessions فقط، وإزالة Legacy Profile Migration وlegacy JWT من المسار التشغيلي، وإصلاح Auth trigger وrole contract وRLS recursive policies وعقود packages/personas/FAQs/translations. كما تم إنشاء seed idempotent صغير يطابق نطاق المنتج الفعلي: **18 خدمة، 3 باقات، 3 شخصيات، 3 FAQs، و213 ترجمة**.

التحقق النهائي أثبت نجاح `check:backend`, tests، lint، typecheck، build، clean-install dry-run، تشغيل backend، API smoke، Auth A/B، وIDOR isolation. لم تُستخدم أموال حقيقية، ولم تُعلن جاهزية الدفع؛ فالـruntime يعيد `PAYMENT_VERIFIER_UNCONFIGURED` عند غياب الإعداد الصحيح.

### الملفات التشغيلية التي تغيرت

| المجال | الملفات الرئيسية المعدلة أو المضافة |
|---|---|
| التشغيل والتوثيق | `package.json`, `package-lock.json`, `README.md` |
| Backend/Auth/API | `backend/server.js`, `backend/src/api/middleware/auth.middleware.js`, `backend/src/api/routes/packages.routes.js`, `backend/src/api/routes/faqs.routes.js`, `backend/src/api/routes/orders.routes.js`, `backend/package.json`, `backend/package-lock.json` |
| Backend tests/seed | `backend/tests/integration.test.js`, `backend/scripts/seed-data.js` |
| Frontend contracts/auth/i18n | `frontend/src/pages/LoginPage.tsx`, `VerifyEmailPage.tsx`, `PackagesPage.tsx`, `PaymentPage.tsx`, `AdminPanel.tsx`, `frontend/src/i18n.ts`, `frontend/src/i18n-fallback.ts`, `frontend/src/contexts/PersonaContext.tsx`, `frontend/src/components/OnboardingSelector.tsx`, `frontend/package.json`, `frontend/package-lock.json` |
| Database | `database/migrations/002_v1_runtime_reconciliation.sql`, `003_services_metadata_reconciliation.sql`, `004_public_catalog_rls_reconciliation.sql`, ومصادر `database/seeds/` |

لم تُحذف ملفات الجذر القديمة لأن inventory نهائيًا قابلًا للحذف لم يكن جزءًا ضروريًا من إصلاح V1؛ README يحدد أنها artifacts غير مستخدمة في build/runtime.

## B) Before vs After — قبل وبعد

| المحور | قبل | بعد التحقق |
|---|---|---|
| بنية المشروع | تكرار وتعارض بين ملفات جذرية ومسارات تشغيل مختلفة | المسار المعتمد موثق: `frontend/`, `backend/`, `database/`, `infrastructure/` |
| Auth | Supabase session مختلط مع legacy JWT وmigration path | Supabase session فقط، وprofile provisioning بالـUUID |
| Role contract | trigger يستخدم `client` بينما القيد الحي كان يسمح `user` فقط | القيد V1 يسمح فقط: `visitor, client, admin, super_admin, manager, editor` |
| Auth trigger | `NEW.app_metadata` سبب AUTH 500 لأنه غير موجود في `auth.users` | استخدام `NEW.raw_app_meta_data`، وprovisioning تلقائي ناجح |
| Catalog | أعمدة وIDs وأسعار غير موحدة وافتراض بيانات ضخمة | API وfrontend يعتمدان الحقول الحية والـUUIDs الفعلية، مع catalog صغير حقيقي |
| RLS | `42P17 infinite recursion` بسبب سياسات admin ذات subquery ذاتي | إزالة السياسات recursive وإضافة public catalog reads محدودة |
| Files | `order-files` public | bucket خاص، والتنزيل عبر signed URLs بعد authorization |
| Payment | قابلية ظهور تدفق دون verifier صالح | fail-closed: `503 PAYMENT_VERIFIER_UNCONFIGURED` أو رفض hash غير صالح |
| Dependencies | حزم legacy غير مستخدمة ومخاطر backend | إزالة الحزم غير المستخدمة؛ backend audit = 0 vulnerabilities |

## C) Database Changes — تغييرات قاعدة البيانات

كان `001_launch_contract.sql` هو baseline، ولم تتم إعادة تشغيله أثناء الإصلاحات اللاحقة. طُبقت migrations 002 و003 و004 على المشروع الاختباري بالترتيب. تجربة 003 أثبتت أن ظهور Success في SQL Editor ليس دليلًا كافيًا؛ لذلك تم التحقق من الأعمدة عبر metadata وREST ثم عبر نجاح seed وAPI.

| migration/تغيير | ما نُفذ | النتيجة المثبتة |
|---|---|---|
| 002 | إصلاح `handle_supabase_auth_user()` ليستخدم `raw_app_meta_data`، وإعادة إنشاء trigger، وإضافة `faqs.order_index` | Auth profile provisioning وFAQs نجحا |
| 003 | إضافة `services.metadata`, `duration_days`, `is_active` و`packages.features` وإعادة تحميل PostgREST | seed وcatalog API نجحا |
| 004 | حذف السياسات recursive وإضافة public SELECT محدود للـactive packages وpersonas | anon catalog reads نجحت، ولم يعد recursion ظاهرًا |
| Role contract | حذف `users_role_check` القديم وإضافة القيم الست الخاصة بـV1 | PostgreSQL metadata أكد القيد؛ A/B بدور `client` نجحا |

تم التحقق فعليًا من الجداول، foreign keys، constraints، indexes، RLS، policies، functions، والـtriggers عبر metadata PostgreSQL وREST. لم تُستخدم `database/legacy/schema.sql`، ولم تُعد الجداول أو تُحذف بيانات legacy ضمن هذا المسار.

## D) Seed Data — الأعداد الحالية

`backend/scripts/seed-data.js` يقرأ JSON من `database/seeds/` ويستخدم upsert/idempotent behavior. آخر تشغيل ناجح أنتج الأعداد التالية، كما أكدت API smoke أعداد catalog الأساسية.

| الكيان | العدد الحالي المثبت |
|---|---:|
| Services | **18** |
| Packages | **3** |
| Personas | **3** |
| FAQs | **3** |
| Translations | **213** |
| Auth users / `public.users` | **2**: Customer A وCustomer B |
| Workspaces بعد cleanup | **0** |
| Workspace members بعد cleanup | **0** |
| Orders بعد cleanup | **0** |
| Conversations بعد cleanup | **0** |
| Messages بعد cleanup | **0** |
| Invoices بعد cleanup | **0** |
| Notifications بعد cleanup | **0** |
| Order files بعد cleanup | **0** |

لم تتم إضافة 1800 خدمة وهمية، ولم تُستخدم fixtures الاختبارية كبيانات منتج دائمة.

## E) Authentication — المصادقة

تم إنشاء Customer A ثم Customer B من Supabase Auth Admin ببيانات اختبار جديدة. لكل مستخدم، ثبت أن `auth.users.id === public.users.id`، وأن البريد متطابق بين Auth و`public.users`، وأن الدور هو `client`. لم يُنشأ profile يدويًا؛ الـtrigger أنشأه تلقائيًا.

تم تسجيل الدخول لكلا الحسابين عبر password grant بحالة HTTP 200، ونجحت `/api/auth/me` وأعادت profile الصحيح. backend وSocket.IO يعتمدان Supabase session/profile نفسه، ولا يوجد اعتماد تشغيلي على legacy JWT أو `LEGACY_PROFILE_MIGRATION_REQUIRED`.

الملاحظة المعروفة: `public.users.is_verified` بقي `false` رغم وجود `email_confirmed_at` في Auth؛ السبب المدعوم هو أن AFTER INSERT trigger يلتقط حالة ما قبل تحديث التأكيد. الحقل غير مستخدم حاليًا في authorization، لذلك لم يمنع Auth، لكنه يحتاج قرارًا إذا أصبح شرطًا تجاريًا.

## F) API — Backend وIDOR

أُعيد تشغيل backend من الكود الحالي على المنفذ 5055، وأعاد `GET /api/health` حالة 200 مع `status: OK`. لكل من A وB نجحت endpoints التالية بحالة 200: `/api/health`, `/api/services`, `/api/packages`, `/api/faqs`, `/api/auth/me`, `/api/auth/workspaces`, `/api/orders/my-orders`, `/api/orders/notifications`, و`/api/chat/unread`.

في IDOR integration، رأى Customer A موارده فقط، ورأى Customer B موارده فقط، وحصل B على 403 عند محاولة قراءة conversation/messages الخاصة بـA. شملت suite الموارد الحساسة: users، workspaces، workspace members، orders، conversations، messages، invoices، notifications، وorder files؛ ثم نُظفت fixtures وأصبحت الجداول التشغيلية المؤقتة صفرًا.

تدفق الدفع تم اختباره بأمان فقط: غياب إعداد verifier/recipient أعاد 503 صريحًا، وhash غير صالح أعاد 400 دون إنشاء order. لم تُستخدم أموال حقيقية.

## G) Frontend — الواجهة

تم ربط packages وpayment بالـAPI canonical package IDs والأسعار والـfeatures بدل IDs أو أسعار hardcoded. onboarding يستخدم UUIDs الحقيقية من `/api/personas`، وPersonaContext لم يعد يستعلم عمودًا غير موجود. أضيف i18n fallback محلي مولد من seed، وأصبح VerifyEmail يستخدم Supabase code/OTP بدل endpoint غير موجود. كما تم escaping للقيم الديناميكية في قالب PDF الإداري.

نجح `typecheck`, `build`, و`lint`. كما أعادت Vite HTML بحالة 200 للمسارات `/`, `/packages`, و`/login`. تعذر browser visual E2E لأن جلسة المتصفح انتهت بـtimeout ثم أصبحت غير متاحة؛ لذلك النتيجة المثبتة هي **HTTP route smoke PASS، browser visual E2E BLOCKED**.

تم تحديث React Router من 6.30.4 إلى 6.30.6 كتحديث patch. بقي audit advisoryان moderate لأن سلسلة 6.x ما زالت ضمن النطاق المتأثر؛ الإصلاح الآلي الكامل يقترح 7.18.2 وهو breaking change.

## H) Security — الأمن والبنية

حدود authorization الأساسية تعتمد على Supabase token والتحقق من profile UUID، وليس على localStorage. IDOR smoke أثبت العزل بين العميلين. bucket `order-files` خاص، والتنزيل يمر عبر authorization وsigned URL. أزيلت dependencies غير المستخدمة `nodemailer`, `redis`, `bcryptjs`, `jsonwebtoken`, و`google-auth-library`، وأزيل مسار Google legacy غير المستخدم.

نتيجة backend production audit هي **0 vulnerabilities**. أما frontend production audit فما زال يفشل بسبب advisoryين moderate في React Router، ولا ينبغي فرض React Router 7 دون مراجعة توافق. توجد أيضًا تحذيرات dev-tool مرتبطة بـVite/esbuild، وترقية Vite الكاملة إلى حل major لم تُفرض ضمن هذه المهمة.

Docker لم يُختبر لأن البيئة لا تحتوي Docker CLI؛ لا يوجد ادعاء بنجاح Compose أو nginx/WebSocket في runtime فعلي.

## I) Tests — النتائج الفعلية

| الاختبار | النتيجة | الدليل |
|---|---|---|
| `npm --prefix backend ci --ignore-scripts --dry-run` | **PASS** | lockfile backend متوافق |
| `npm --prefix frontend ci --ignore-scripts --dry-run` | **PASS** | lockfile frontend متوافق |
| `npm run check:backend` | **PASS** | `node --check server.js` |
| `npm test` | **PASS** | 3 suites و22 tests |
| `npm run lint` | **PASS** | لا توجد lint errors أو warnings من ESLint؛ يوجد تحذير توافق TypeScript خارجي من الأداة |
| `npm run typecheck` | **PASS** | TypeScript noEmit |
| `npm run build` | **PASS** | Vite build ناجح؛ chunk warning أكبر من 500 kB فقط |
| Backend `/api/health` | **PASS** | HTTP 200 بعد restart من الكود الحالي |
| Auth A/B | **PASS** | login 200، ID equality، role/email، trigger provisioning |
| API smoke A/B | **PASS** | catalog/account endpoints الأساسية 200 |
| IDOR isolation | **PASS** | cross-user access أعاد 403، ثم cleanup |
| Payment safe smoke | **BLOCKED by configuration** | verifier/recipient غير مهيأ؛ لا payment success |
| Frontend HTTP routes | **PASS** | `/`, `/packages`, `/login` أعادت 200 وHTML |
| Browser visual E2E | **BLOCKED** | browser timeout ثم unavailable |
| Docker/Compose | **BLOCKED** | `docker: command not found` |
| Backend audit | **PASS** | 0 vulnerabilities |
| Frontend audit | **FAIL/P1** | advisoryان moderate في React Router 6.x |

ظهر أثناء Jest تحذير Node عن `punycode` deprecated؛ لم يفشل الاختبارات.

## J) Remaining Issues — المتبقي حسب الأولوية

| الأولوية | الأثر | السبب المثبت | الإصلاح المطلوب |
|---|---|---|---|
| **P0 تشغيلي / Configuration required** | لا يمكن قبول أو إكمال دفع حقيقي بأمان | `PAYMENT_VERIFIER_UNCONFIGURED` بسبب غياب recipient/verifier صالح | ضبط `WEB3_RECIPIENT_ADDRESS` وإعدادات verifier والشبكة وUSDC contract وconfirmations في secrets، ثم testnet E2E ومراجعة انتقالات order |
| **P1 أمني** | advisoryان moderate في runtime dependency | React Router 6.x ضمن advisory range | ترقية 7.18.2 في branch منفصل، مراجعة APIs، ثم typecheck/build/browser E2E |
| **P1 دلالي** | `is_verified` لا يعكس email confirmation | AFTER INSERT يسبق تحديث `email_confirmed_at` | اعتماد trigger UPDATE أو backend refresh قبل استعمال الحقل في business authorization؛ لم يُنفذ تغيير schema جديد |
| **P1 تكامل خارجي** | Google login غير مثبت | إعداد client/origin/redirect لم يُختبر في browser | ضبط Google provider في Supabase وGoogle Console، ثم browser E2E |
| **P2 تشغيلي** | Docker topology غير مثبت | Docker CLI غير متاح | تشغيل `docker compose config`, build/up، healthchecks، nginx، وWebSocket على CI أو جهاز يحوي Docker |
| **P2 تخزين E2E** | upload/download بملف حقيقي لم يكتمل | authorization وsigned URL logic اختُبرا، لكن fixtures نُظفت | إنشاء order اختبار مؤقت، رفع ملف مسموح، تنزيل المالك، رفض العميل الآخر، ثم cleanup |
| **P2 محتوى** | بعض النصوص تقول 1800 خدمة و24/7 ولا تطابق V1 | catalog الفعلي 18 خدمة | مراجعة copy ليطابق نطاق V1 دون بيانات وهمية |
| **P2 نطاق ثانوي** | blog وبعض content routes قد تحمل schema mismatches | إشارات إلى `status`, `slug`, `views` غير مثبتة ضمن core V1؛ products/donations/subscriptions مؤجلة | تجميدها أو فتح مهمة منفصلة بعقد schema واختبارات؛ لا توسعة الآن |
| **P2 personalization** | persona preference محلي فقط ولا يوجد package filtering | لا persistence إلى `public.users.persona_id`، و`persona_ids=[]` للباقات | قرار منتجي منفصل ثم persistence/filtering |
| **P2 repository hygiene** | artifacts جذرية قد تربك مستقبلًا | غير داخلة في scripts/build/runtime، لكنها لم تُحذف | archive/delete بعد branch release وinventory نهائي |
| **P2 tooling** | تحذيرات لا تمنع البناء | TypeScript 5.9 خارج نطاق دعم `@typescript-eslint` المعلن، وchunk كبير | دورة tooling/performance منفصلة بعد تثبيت V1 |

لا يوجد فشل P0 برمجي معروف في Core Auth/catalog/IDOR. لكن الدفع هو **P0 تشغيلي** إذا كان الهدف استقبال أموال حقيقية الآن.

## K) Minimal Commands — أوامر التشغيل

من جذر المشروع، بعد ضبط المتغيرات المطلوبة دون طباعة قيمها:

```bash
npm run install:all
npm run check:backend
npm run typecheck
npm run lint
npm test
npm run build
npm run seed
npm run dev:backend
npm run dev:frontend
```

للبيئة الاختبارية أو Supabase جديدة، تُطبق migrations بالترتيب:

```text
database/migrations/001_launch_contract.sql
database/migrations/002_v1_runtime_reconciliation.sql
database/migrations/003_services_metadata_reconciliation.sql
database/migrations/004_public_catalog_rls_reconciliation.sql
npm run seed
```

للتحقق من backend بعد التشغيل:

```bash
curl -i http://127.0.0.1:5055/api/health
```

**القرار:** BİŞIŞ V1 جاهز للانتقال إلى إعداد verifier وGoogle OAuth واختبارات القبول والنشر، وليس جاهزًا بعد لإعلان Production أو استقبال مدفوعات حقيقية.

## مراجع الأدلة المحلية

[1]: database/migrations/001_launch_contract.sql "BİŞIŞ V1 baseline launch contract"
[2]: database/migrations/002_v1_runtime_reconciliation.sql "Auth trigger and FAQ reconciliation"
[3]: database/migrations/003_services_metadata_reconciliation.sql "Services and packages schema reconciliation"
[4]: database/migrations/004_public_catalog_rls_reconciliation.sql "Public catalog RLS reconciliation"
[5]: backend/scripts/seed-data.js "Idempotent V1 seed runner"
[6]: database/seeds/services.json "18-service seed source"
[7]: database/seeds/packages.json "Canonical package seed source"
[8]: database/seeds/personas.json "Persona seed source"
[9]: database/seeds/faqs.json "FAQ seed source"
[10]: database/seeds/translations.json "213-row translation seed source"
[11]: backend/src/api/middleware/auth.middleware.js "Canonical Supabase session middleware"
[12]: backend/src/api/routes/orders.routes.js "Orders, payment, and private file routes"
[13]: frontend/src/pages/PackagesPage.tsx "API-backed package catalog"
[14]: frontend/src/pages/PaymentPage.tsx "Canonical package-to-order flow"
[15]: README.md "V1 operating documentation"
