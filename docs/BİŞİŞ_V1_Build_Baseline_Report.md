# BİŞIŞ V1 — تقرير تثبيت البنية Build Baseline

**نطاق العمل:** المرحلة 1 فقط. لم تُضف أي Feature، ولم يُعاد تصميم authentication أو workspace access أو conversation access. تم التركيز على قابلية البناء والتشغيل وتنظيم المستودع وملفات التشغيل.

**تاريخ التحقق:** 23 أغسطس 2026.

## 1. الملفات التي تغيرت أو أُضيفت

### ملفات البنية والاعتماديات

| الملف | نوع التغيير |
|---|---|
| `package.json` | أُضيف manifest جذري مع facade لأوامر build/typecheck/test/lint وتشغيل الواجهة والخادم |
| `package-lock.json` | أُنشئ للـmanifest الجذري |
| `frontend/package.json` | أُضيفت scripts صريحة لـ`typecheck` و`build` و`test`، وصُحح نطاق lint إلى `src` |
| `backend/package.json` | أُضيف manifest مستقل باعتماديات Express/Supabase/Socket/Jest/Supertest وغيرها |
| `backend/package-lock.json` | أُنشئ لاعتماديات الباكند المستقلة |
| `backend/.eslintrc.cjs` | أُضيف إعداد lint خاص بالـCommonJS وJest |
| `.env.example` | أُضيف نموذج بيئة بلا أسرار يطابق Compose وREADME |

### ملفات التشغيل والبناء

| الملف | نوع التغيير |
|---|---|
| `frontend/index.html` | أُضيف Vite entrypoint المفقود |
| `frontend/vite.config.ts` | ثُبّت تحميل `defineConfig` |
| `backend/server.js` | ثُبّت تحميل `.env` من جذر المستودع قبل تهيئة الخدمات؛ لم يتغير منطق auth أو authorization |
| `backend/Dockerfile` | أُضيفت صورة تشغيل مستقلة للباكند |
| `frontend/nginx.conf` | أُضيف إعداد static SPA داخلي لصورة frontend |
| `infrastructure/docker-compose.yml` | وُحّدت سياقات frontend/backend/nginx وأزيل mount SSL غير الموجود، مع تمرير البيئة صراحةً |
| `infrastructure/nginx.conf` | وُحّد كـmain config صالح لـNginx Compose مع proxy صريح لـ`/api/` و`/socket.io/` وباقي SPA إلى frontend |
| `README.md` | أُعيدت كتابته ليطابق البنية الجديدة والأوامر ومسار migration |
| `docs/STAGING_CHECKLIST.md` | صُححت أوامر التشغيل ومسار migration ومسارات V1 المجمدة |
| `docs/STAGING_RUNBOOK.md` | صُححت أوامر Compose ومسار migration ومكان ملف البيئة |
| `docs/BİŞİŞ_V1_Rescue_and_Launch_Plan.md` | حُدثت المراجع المحلية إلى المسارات الجديدة |

### الملفات المنقولة وإعادة التصنيف

أُعيد تنظيم ملفات الواجهة إلى `frontend/src/` ضمن `components/`, `contexts/`, `hooks/`, `lib/`, `pages/`, `sections/`, و`utils/`. نُقلت وحدة Supabase إلى `frontend/src/lib/supabase.ts` حتى تطابق imports القائمة.

أُعيد تنظيم ملفات الخادم إلى `backend/src/` ضمن `api/middleware/`, `api/routes/`, `api/utils/`, `config/`, و`services/`. نُقلت الاختبارات إلى `backend/tests/` وseed script إلى `backend/scripts/`. نُقلت migration إلى `database/migrations/001_launch_contract.sql`، والمخطط القديم إلى `database/legacy/schema.sql`، وكتالوج الخدمات إلى `database/seeds/services.json`. نُقلت الوثائق إلى `docs/` والبنية التشغيلية إلى `infrastructure/`.

أزيلت من `frontend/src/App.tsx` imports/routes لصفحات `ServicesPage` و`TeamDashboard` غير الموجودة بدل إنشاء صفحات placeholder. وأزيلت من Header/Footer روابط المنتجات المجمدة أو المسارات غير الموجودة؛ هذا تنظيف navigation لضمان عدم وجود dead ends، وليس إضافة وظيفة جديدة.

## 2. المشاكل التي أُغلقت

| المشكلة | النتيجة |
|---|---|
| عدم وجود بنية واضحة تفصل الواجهة والخادم وقاعدة البيانات والوثائق | أُنشئت البنية `frontend/`, `backend/`, `database/`, `docs/`, `infrastructure/` |
| عدم وجود `frontend/index.html` | أُغلق؛ Vite build ينجح |
| عدم وجود manifest مستقل للباكند | أُغلق؛ أصبح للباكند `package.json` وlockfile واعتمادياته الخاصة |
| عدم وجود `npm run test` | أُغلق؛ root script يشغل Jest للباكند |
| عدم وجود `npm run typecheck` موحد | أُغلق؛ root وfrontend يملكان الأمر صراحةً |
| imports/مسارات Supabase بعد النقل | أُغلق عبر نقل الوحدة إلى `frontend/src/lib/supabase.ts` |
| imports لصفحات غير موجودة (`ServicesPage`, `TeamDashboard`) | أُغلقت بإزالة imports/routes الميتة، لا بإنشاء Features |
| backend server/config/routes بعد النقل | أُغلقت؛ `node --check server.js` واختبارات Jest يعملان |
| عدم وجود Dockerfile للباكند | أُغلق بإضافة `backend/Dockerfile` |
| Dockerfile frontend يشير إلى `nginx.conf` غير موجود في سياق frontend | أُغلق بإضافة `frontend/nginx.conf` |
| Compose يشير إلى سياقات غير متطابقة وSSL mount غير موجود | أُغلق بإعادة كتابة compose وفق الملفات الحالية |
| Nginx الخارجي كان server block فقط رغم تركيبه كـmain config | أُغلق بنيويًا بإعداد main config مع API/Socket proxy؛ لم يتغير middleware الأمني أو authentication |
| README وchecklist وrunbook تشير إلى `infrastructure/database/...` أو أوامر قديمة | أُغلقت المسارات التشغيلية القديمة |
| عدم وجود نموذج بيئة واضح | أُضيف `.env.example` بلا أسرار |

## 3. أوامر التشغيل التي نجحت

| الأمر | النتيجة |
|---|---|
| `npm ci --prefix frontend --ignore-scripts --no-audit --no-fund` | نجح، أُثبتت 443 حزمة |
| `npm ci --prefix backend --ignore-scripts --no-audit --no-fund` | نجح، أُثبتت 611 حزمة |
| `npm ci --prefix frontend ... --dry-run` | نجح |
| `npm ci --prefix backend --omit=dev ... --dry-run` | نجح، وهو مسار صورة production |
| `npm run typecheck` | نجح برمز خروج 0 |
| `npm run build` | نجح برمز خروج 0؛ أُنشئت `frontend/dist/` |
| `npm test` | نجح: 3 test suites و22 test |
| `npm run lint` | نجح برمز خروج 0، مع 9 تحذيرات فقط في الباكند |
| `npm run check:backend` | نجح برمز خروج 0 |
| `npm --prefix backend run start` | بدأ الخادم بنجاح على port 5000 |
| `curl http://127.0.0.1:5000/api/health` | أعاد HTTP 200 و`{"status":"OK"}` |
| فحص YAML وDocker paths ثابتًا | نجح: `COMPOSE_STATIC_VALID=1`، والخدمات الثلاثة `backend,frontend,nginx` موجودة |

## 4. المشاكل المتبقية

### مشاكل مؤكدة قبل اعتبار V1 جاهزًا

| المشكلة | الحالة الحالية |
|---|---|
| تطبيق `database/migrations/001_launch_contract.sql` على Supabase staging | لم يُطبق؛ لا توجد أداة `psql` أو `supabase` في البيئة، والتطبيق الخارجي لم يُنفذ لتجنب تغيير قاعدة بيانات غير مؤكد |
| إثبات migration على قاعدة فارغة | غير مثبت؛ التصميم والملف موجودان لكن القابلية التشغيلية تحتاج Supabase staging فعليًا |
| اختبار Docker الفعلي | غير منفذ؛ Docker CLI غير مثبت في البيئة (`DOCKER_NOT_INSTALLED`). تم فحص YAML والمسارات ثابتًا فقط |
| اختبار Google Login/refresh/logout/session expiry/Socket reconnect | خارج نطاق Build Baseline؛ لم يُنفذ browser E2E |
| الدفع الحقيقي وwallet/RPC/reconciliation/refund | لم يُلمس، وما يزال مانع إطلاق ماليًا كما قررت الخطة |
| رحلة العميل الكاملة من الباقة إلى التسليم | لم تُنفذ في هذه المرحلة |

### تحذيرات غير مانعة للبناء لكنها تحتاج معالجة لاحقة

يعرض Vite تحذيرًا بأن chunk الرئيسي يتجاوز 500 kB بعد minification. لم تتم معالجة ذلك لأن code-splitting أو manual chunks تحسين أداء وليس شرطًا لبناء V1.

يعرض backend ESLint تسعة تحذيرات `no-unused-vars` في `server.js` و`auth.middleware.js` و`auth.routes.js` و`orders.routes.js` واختبار التكامل. لم أعدّل هذه الملفات لإخفاء التحذيرات لأن بعضها يقع داخل منطق أمني أو مسارات أُصلحت حديثًا. أمر lint ينجح، لكن تنظيف التحذيرات مطلوب كعمل صيانة منفصل.

يظهر أثناء Jest تحذير Node عن وحدة `punycode` القديمة، لكنه لا يفشل الاختبارات.

## 5. الأخطاء التي ما زالت تظهر

الأخطاء التشغيلية المتبقية التي ظهرت أثناء التحقق هي:

```text
DOCKER_NOT_INSTALLED
```

وهذا يعني أن فحص `docker compose config` والبناء الفعلي للصور لم يمكن تشغيلهما داخل بيئة العمل الحالية، وليس أن Compose أثبت فشله.

أما migration فلا يوجد خطأ SQL مثبت لأن الملف لم يُرسل إلى محرك PostgreSQL/Supabase. الحالة الصحيحة هي **غير متحقق منها**، لا «ناجحة» ولا «فاشلة».

وتظهر أثناء اختبارات العزل رسالة متوقعة في السجل:

```text
LEGACY_PROFILE_MIGRATION_REQUIRED
```

الاختبارات نفسها نجحت، والرسالة جزء من مسار حماية جلسة لمستخدم يحتاج migration للملف الشخصي؛ لكنها تؤكد أن مصادقة staging لا يمكن اعتمادها قبل تطبيق Launch Contract والتحقق من trigger/جدول المستخدمين.

## 6. قرار المرحلة

أصبح المستودع قابلًا للـtypecheck والـbuild والاختبار وبدء الخادم محليًا. لذلك تُعد **مشكلة البناء والتنظيم الأساسية مغلقة محليًا**.

لا تُعد المرحلة مغلقة بالكامل للإطلاق حتى ينجح اختباران خارجيان: تشغيل Compose فعليًا على جهاز/CI يملك Docker، وتطبيق migration على Supabase staging من قاعدة فارغة ثم إعادة اختبار الخادم عليها. بعد ذلك فقط يمكن الانتقال إلى مرحلة قاعدة البيانات ورحلة العميل؛ لا يوجد في هذا التقرير أي انتقال إلى الدفع أو Features جديدة.

## المراجع المحلية

- `README.md`
- `frontend/package.json`
- `backend/package.json`
- `frontend/src/App.tsx`
- `backend/server.js`
- `database/migrations/001_launch_contract.sql`
- `infrastructure/docker-compose.yml`
- `infrastructure/nginx.conf`
- `docs/BİŞİŞ_V1_Rescue_and_Launch_Plan.md`
