# BİŞIŞ V1 — Launch Readiness & Release Candidate Report

> **Historical baseline — superseded.** الحالة الحالية موثقة في `BİŞİŞ-V1-Maximum-Launch-Acceleration-Final-Report.md` و`docs/FINAL_LAUNCH_CHECKLIST.md`. الأرقام القديمة في هذا الملف، ومنها 690 صف ترجمة، لا تمثل آخر seed حي.

**التاريخ:** 24 أغسطس 2026  
**النطاق:** BİŞIŞ V1 الحالي فقط، دون دمج `database/legacy/schema.sql` ودون إعادة تصميم Authentication أو Database Contract.  
**الحكم النهائي:** **🟡 READY AFTER EXTERNAL CONFIGURATION**

> الكود الأساسي، عقد Auth/Database/API، catalog، الحماية الأفقية، البناء، والاختبارات الآلية في حالة Release Candidate قابلة للتحقق. لا يجوز اعتبار المشروع جاهزًا لإطلاق Production أو قبول مدفوعات حقيقية قبل إكمال متطلبات البيئة والدفع والتكاملات الخارجية المحددة في هذا التقرير.

## 1. Executive Decision

أصبح BİŞIŞ V1 أقرب إلى نسخة إطلاق حقيقية: النطاق العام واضح ومحصور في **18 خدمة، 3 باقات، 3 شخصيات، 3 FAQs، و230 مفتاح ترجمة عبر 3 لغات = 690 صف ترجمة**. تم إخفاء الأسطح الثانوية غير الجاهزة، وأصبح الدفع يعرض حالة محجوبة آمنة عند غياب verifier بدل إظهار wallet أو نجاح وهمي.

مع ذلك، الحكم ليس **READY TO LAUNCH**. السبب الحرج هو أن payment verifier غير مهيأ، وبالتالي فإن `/api/health` يعيد `HTTP 200` بحالة `DEGRADED` و`payment_verifier=missing`، بينما يعيد wallet endpoint `503 PAYMENT_VERIFIER_UNCONFIGURED`. كذلك لا يوجد دليل runtime لـDocker/Compose في هذه البيئة، ولم تُنفذ Google OAuth E2E أو authenticated admin browser workflow على بيئة خارجية.

## 2. ما تم تنفيذه في هذه الجولة

| المجال | التغيير الفعلي | النتيجة |
|---|---|---|
| الترجمة والمحتوى | إضافة 151 مفتاحًا مفقودًا إلى `database/seeds/translations.json`، وإعادة توليد `frontend/src/i18n-fallback.ts` | 230 مفتاحًا و690 صفًا؛ browser لم يعد يعرض keys خامة على Home/About/Chat/Packages |
| Chatbot | إزالة claims غير المثبتة عن 30 يوم دعم، تحديثات مجانية، مدد 7/14/21 يومًا، refunds محددة، و24/48 ساعة؛ إبقاء الأسعار الفعلية وشرح blocked payment | الأسعار بقيت `$249/$649/$1499`، ولا توجد وعود غير مدعومة في إجابات الأسعار والدفع التي اختُبرت |
| Routing | إضافة `/register` إلى LoginPage بوضع signup، وربط `/services` إلى `/packages`، وإضافة `/onboarding` مع redirect إلى login عند غياب session | لم تعد هذه deep links تعيد shell فارغًا |
| Auth UI | إزالة `localStorage` parsing من `AdminPanel` وربطه بـ`AuthContext`؛ جعل Dashboard/Admin ينتظران session | زائر غير مسجل يرى unauthorized state ولا يطلق طلبات محمية قبل session |
| CORS | جعل default development origins تشمل `localhost:3000` و`127.0.0.1:3000`، مع trim للقيم | تم إصلاح mismatch المحلي؛ originان أعادا catalog بنجاح وفق الإعداد المناسب |
| Storage errors | إضافة wrapper لـMulter؛ رفض النوع/الحجم يعيد `400` برسالة عامة بدل stack trace؛ إخفاء رسائل 5xx الداخلية في analytics/upload | negative upload الحالي أعاد `400 Unsupported file type` بلا stack |
| Environment hygiene | استبدال العناوين الصفرية في `.env.example` بعبارات placeholder تفشل مغلقًا، وإضافة `frontend/.env.example` وGoogle feature flag | لا توجد قيم دفع وهمية تبدو صالحة؛ secrets backend لا تدخل frontend |
| Release gate | تحويل `production:check` من dry-run إلى clean install فعلية ثم `check` وaudit | clean install وcheck مرّا؛ gate يتوقف حاليًا عند advisory React Router فقط |
| أدوات غير آمنة | حذف `backend/tests/test-env.js` غير المستخدم الذي كان يطبع env values | لا يبقى helper رسمي يطبع مفاتيح Supabase |
| التوثيق | تحديث `README.md` و`docs/LAUNCH_MAP.md` و`LAUNCH_CHECKLIST.md` | التوثيق يطابق 690 صفًا، routes، flags، blocked payment، والمتطلبات الخارجية |

لم يتم تعديل أي migration في هذه الجولة، ولم يتم تشغيل reset أو destructive SQL. السلسلة canonical الحالية هي `001` إلى `011`؛ هذا snapshot السابق لا يثبت fresh-chain rehearsal، مع بقاء `database/legacy/schema.sql` خارج runtime.

## 3. Launch Map الفعلية

```text
User
  ↓
React/Vite frontend
  ↓ Supabase Auth access token
Node/Express API
  ↓
Supabase Auth validation + public.users provisioning
  ↓
Supabase Postgres / RLS
  ├── Optional Supabase Storage: only after an approved private V1 contract
  ├── Canonical catalog: 18 services / 3 packages / 3 personas / 3 FAQs / 690 translations
  ├── Orders and notifications
  └── Socket.IO conversation authorization
  ↓
Polygon USDC payment verifier
  ↓
Order state transition and fulfilment
```

المسارات العامة الحالية هي Home وAbout وPackages وFAQ وContact وLogin/Register وChat. `/services` يعيد التوجيه إلى catalog canonical في `/packages`. `/payment` موجود لكنه يعرض **Safe Blocked State** عند غياب verifier. `/dashboard` و`/admin` محميان بالsession على الواجهة، ويطبّق backend authorization مستقلاً. الأسطح Blog وPortfolio وDigital Products وDonations وLife Plan مخفية من public navigation/routes لأنها خارج Core V1 أو لا تملك contract مكتملًا.

## 4. حالة البيانات الحية

تم تنفيذ seed على مشروع Supabase اختباري مستقل مؤكد في حينه بنجاح بعد آخر إضافة للترجمات. فحص REST read-only النهائي أعاد الأعداد التالية؛ معرّف المشروع غير مضمّن في النسخة العامة.

| الجدول | العدد الحي | الحالة المتوقعة |
|---|---:|---:|
| `users` | 2 | Customer A وCustomer B |
| `services` | 18 | مطابق لنطاق V1 |
| `packages` | 3 | Starter / Growth / Investor-Ready |
| `personas` | 3 | مطابق لمصادر seed |
| `faqs` | 3 | FAQs نشطة |
| `translations` | 690 | 230 مفتاحًا × 3 لغات |
| `workspaces` | 0 | fixtures منظفة |
| `workspace_members` | 0 | fixtures منظفة |
| `orders` | 0 | fixtures منظفة؛ لا طلبات دائمة في بيئة الاختبار |
| `conversations` | 0 | fixtures منظفة |
| `messages` | 0 | fixtures منظفة |
| `notifications` | 0 | fixtures منظفة |
| `invoices` | 0 | fixtures منظفة |
| `order_files` | 0 | Storage E2E نظّف metadata والملف |

## 5. Authentication وAuthorization

Customer A وCustomer B موجودان فعليًا في Supabase Auth. لكل حساب تحققنا من `auth.users.id = public.users.id`، وتطابق البريد، و`public.users.role = client`. تسجيل الدخول password grant أعاد `200` للحسابين، و`/api/auth/me` أعاد profile صحيحًا. ما زال `is_verified=false` في profile رغم وجود تأكيد Auth؛ هذا لا يدخل في authorization الحالي، لكنه يبقى بندًا يجب حسمه قبل استعمال الحقل في صلاحيات الأعمال.

اختبار التصعيد الرأسي بحساب Customer B أعاد `403` لكل من `/api/orders` و`/api/projects` و`/api/invoices` و`/api/tickets` و`/api/orders/admin/analytics`، ولم يكشف stack أو Supabase details. اختبار IDOR بين A وB أثبت أن كل عميل يرى order/notification الخاص به فقط، وأن B لا يستطيع قراءة conversation أو messages الخاصة بـA، مع تنظيف كل fixtures بعد الاختبار.

## 6. API وPayment Safety

API smoke النهائي للحسابين نجح: login، health، services، packages، FAQs، `/api/auth/me`، workspaces، orders، notifications، وchat unread. catalog أعاد 18 خدمة و3 باقات. Backend health الحالي يعيد:

```json
{
  "status": "DEGRADED",
  "database": "configured",
  "critical_configuration": { "payment_verifier": "missing" },
  "version": "1.0.0"
}
```

اختبار payment الآمن أعاد `503` من wallet endpoint برسالة `PAYMENT_VERIFIER_UNCONFIGURED`. إرسال transaction ID غير صالح أعاد `400 Invalid transaction ID`، وبقي عدد orders بعد المحاولة `0`. لم تُستخدم أموال حقيقية.

اختبار Storage المذكور هنا historical evidence فقط؛ النسخة العامة الحالية لا تفترض bucket أو policy قبل اعتماد Storage contract وإعادة الاختبار على البيئة المقصودة. كما أن ملفًا غير مسموح به أصبح يعيد `400` دون stack trace بعد إصلاح Multer.

## 7. Frontend Browser Validation

تم فحص الواجهة عبر browser على Vite. Home وAbout وChat وPackages ظهرت بصريًا دون raw translation keys بعد تحديث 690 صفًا. Packages عرضت الباقات والأسعار canonical: Starter `$249`، Growth `$649`، وInvestor-Ready `$1499`. اختيار package CTA نقل إلى `/payment` الذي عرض blocked state آمنة دون wallet أو transaction input.

`/login` عرض email/password ورسالة Google غير المهيأ، و`/register` عرض نموذج إنشاء الحساب مع الاسم والبريد وكلمة المرور. `/verify-email` دون token عرض invalid/expired state مترجمة. `/dashboard` و`/admin` للزائر غير المسجل عرضا unauthorized state. `/services` يعيد إلى `/packages`، و`/onboarding` يعيد الزائر إلى `/login`. تم أيضًا اختبار سؤال السعر وسؤال الدفع داخل chatbot.

لم يتم تسجيل الدخول داخل browser باستخدام Customer A أو B في هذه الجولة، لذلك تبقى authenticated browser checks الخاصة بـDashboard وonboarding selector وadmin CRUD غير مكتملة. تم إثبات هذه المسارات عبر API/Auth/IDOR tests، لكن ذلك ليس بديلًا عن browser E2E الكامل.

## 8. Build, Tests, Dependencies, Deployment

| الاختبار | النتيجة الأخيرة |
|---|---|
| `npm run check:backend` | PASS؛ `node --check server.js` |
| `npm test` | PASS؛ 3 suites و22 tests |
| `npm run lint` | PASS بلا lint errors أو warnings |
| `npm run typecheck` | PASS |
| `npm run build` | PASS؛ Vite build ناجح مع تحذير chunk أكبر من 500KB |
| `npm run check` | PASS في آخر تشغيل؛ `CHECK_FINAL_V10_STATUS=0` |
| `npm run install:all` داخل production gate | PASS؛ `npm ci` فعلي للـbackend والـfrontend |
| Backend production audit | PASS؛ `0 vulnerabilities` |
| Frontend production audit | FAIL gate؛ advisoryان moderate في React Router 6.30.6 |
| `npm run production:check` | FAIL مقصود؛ كل ما قبل audit يمر، والـgate يتوقف عند advisory React Router |
| Backend runtime | PASS؛ health HTTP 200 بحالة DEGRADED الصادقة |
| Frontend runtime | PASS؛ Vite يعيد deep links وbrowser تحقق من المسارات الأساسية |
| Docker Compose runtime | BLOCKED؛ Docker CLI غير متاح في بيئة التحقق، لذلك لم ندّعِ build/up نجاحًا |
| Git history/status | BLOCKED للتحقق الخارجي؛ مجلد المشروع لا يحتوي `.git` metadata |

تمت تجربة ترقية React Router إلى `7.18.2` في نسخة احتياطية. التثبيت نجح، لكن `npm run check` فشل typecheck لأن `BrowserRouter` لم يعد يقبل `future` props الحالية. أُعيد rollback كامل إلى `6.30.6`. لم يُستخدم `npm audit fix --force`.

## 9. المشاكل المتبقية الحقيقية

| الأولوية | المشكلة والأثر | السبب المثبت | الإصلاح المطلوب |
|---|---|---|---|
| **P0 خارجي** | لا يمكن قبول أو إتمام مدفوعات حقيقية بأمان بعد | verifier/wallet endpoint يعيد `503 PAYMENT_VERIFIER_UNCONFIGURED` وhealth يعلن `DEGRADED` | وضع Polygon RPC صالح، USDC contract الصحيح، recipient EOA، confirmations، ثم testnet payment E2E مع state transitions وreplay/duplicate checks |
| **P1** | advisoryان moderate في frontend audit | React Router 6.30.6؛ الإصلاح المقترح آليًا يفرض 7.18.2 | تنفيذ migration صغيرة إلى Router 7، إزالة/تحديث `future` props، ثم typecheck/tests/build/browser smoke؛ أو قبول المخاطرة مؤقتًا بقرار موثق |
| **P1 خارجي** | Google OAuth غير مختبر | Supabase/Google Cloud client/origins/redirects غير مثبتة؛ feature flag الآن مغلق | إعداد provider وauthorized origins وredirect URLs، وضع `VITE_ENABLE_GOOGLE_OAUTH=true` وclient ID، ثم browser E2E وprofile provisioning |
| **P1** | semantics الخاصة بـ`is_verified` غير متزامنة | trigger ينشئ profile قبل أن تظهر حالة email confirmation النهائية، والدليل أن A/B لديهما `is_verified=false` | اختيار semantics صريحة؛ إما trigger/update آمن أو refresh backend، ثم migration واختبار. لا يُستخدم الحقل authorization قبل ذلك |
| **P1 خارجي** | production topology غير مثبتة | Docker CLI غير متاح، وCompose/nginx/Socket.IO لم تُشغّل end-to-end | تشغيل `docker compose config/build/up` على CI/host يحوي Docker، ثم healthcheck وSPA/API/WebSocket/private Storage tests |
| **P1 خارجي** | production project/domain/secrets غير مؤكدة | البيئة الحالية test project، ولا توجد production domain أو secret store مؤكدة | تأكيد Supabase production project، ضبط `SUPABASE_SERVICE_ROLE_KEY` server-only، `VITE_*` العامة، `ALLOWED_ORIGINS` و`VITE_API_URL`، ثم migrations/seed/backup |
| **P2** | لا توجد frontend automated tests حقيقية | `frontend` test script لا يملك suite ويطبع عدم وجود tests | إضافة smoke/component tests بعد استقرار release؛ browser evidence الحالي لا يغني عن suite آلية |
| **P2** | بعض chunks كبيرة | Vite حذّر من chunks أكبر من 500KB؛ build ناجح | lazy/manual chunking لاحقًا، دون refactor واسع قبل الإطلاق |
| **P2** | backend secondary routes وroot artifacts خارج V1 | blog/donations/digital-products/subscriptions/projects ما زالت mounted جزئيًا، وبعض عقودها ليست V1 core؛ ملفات root مكررة خارج scripts | إبقاءها غير مكشوفة public، ثم archive أو إصلاح contracts في مرحلة لاحقة؛ لا تُعاد إلى navigation قبل تدقيق مستقل |
| **P2** | persona preference محلية والتصفية غير مكتملة | `OnboardingSelector` يحفظ UUID في localStorage فقط، و`persona_ids` في الباقات فارغة | ربط preference بـ`public.users.persona_id` وتحديد package filtering بعد قرار product صريح |
| **P2 خارجي** | Git release hygiene غير قابل للإثبات من هذه النسخة | لا يوجد `.git` metadata في مجلد المشروع | إجراء `git status` و`git diff` على clone/remote الحقيقي قبل commit أو push؛ لم يتم commit أو push تلقائيًا |

## 10. External Configuration Required

قبل إعلان الإطلاق، يجب تنفيذ الخطوات التالية بالترتيب: تأكيد production Supabase project والدومين؛ وضع secrets في secret store؛ تطبيق canonical migrations `001 → 011` والتحقق منها؛ تشغيل seed idempotent على البيئة المقصودة؛ ضبط `ALLOWED_ORIGINS` و`VITE_API_URL`؛ تهيئة payment verifier وتنفيذ testnet payment كامل؛ تشغيل Compose/nginx/WebSocket checks على host يحوي Docker؛ اختبار private Storage؛ ثم تفعيل Google فقط بعد إكمال provider/browser E2E.

لا ينبغي نسخ `.env` الاختباري إلى Production. `SUPABASE_SERVICE_ROLE_KEY` server-only، أما `VITE_SUPABASE_ANON_KEY` فهي public by design ولكن يجب ألا تختلط مع service role. لا توجد قيم دفع حقيقية داخل `.env.example`.

## 11. أوامر التشغيل المعتمدة

```bash
# من جذر المشروع
npm run install:all
npm run seed
npm run dev:backend
npm run dev:frontend

# التحقق قبل الإصدار
npm run check
npm run production:check

# health محلي
curl -i http://127.0.0.1:5000/api/health

# نشر Compose بعد توفر Docker وإعداد env production
docker compose -f infrastructure/docker-compose.yml config
docker compose -f infrastructure/docker-compose.yml build
docker compose -f infrastructure/docker-compose.yml up -d
```

> الأمر الصحيح هو `docker compose` بحروف صغيرة؛ السطر أعلاه مقصود به التذكير البصري ويجب تنفيذه بصيغة `docker compose` الفعلية.

## 12. الخلاصة التنفيذية

**Code complete for the narrow V1 core:** Auth session path، profile provisioning، public catalog، canonical package flow، API authorization، IDOR boundaries، private Storage authorization، safe payment blocking، frontend routes، translations، build، tests، clean install، وruntime smoke.

**Configuration required:** production Supabase/domain/secrets، Polygon verifier، testnet payment، Google OAuth إن أُريد تفعيله، CORS/Socket origins، Docker/nginx deployment، private Storage production E2E، وrollback/backup procedure.

**Not ready for launch until external blockers close:** payment remains P0 because the product cannot safely complete real orders while verifier is missing. لذلك القرار النهائي هو **🟡 READY AFTER EXTERNAL CONFIGURATION**، وليس **READY TO LAUNCH**.

## Evidence Files

- `docs/LAUNCH_MAP.md`
- `LAUNCH_CHECKLIST.md`
- Internal authenticated evidence was reviewed during the original session but is intentionally not included in the public repository.
- Current reproducible evidence is represented by repository validators, tests, and the newer final readiness report.

