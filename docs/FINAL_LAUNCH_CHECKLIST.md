# BİŞIŞ V1 — Final Launch Checklist

**تاريخ المراجعة:** 24 أغسطس 2026

**نطاق المراجعة:** Core V1 فقط؛ 18 خدمة، 3 باقات، 3 شخصيات، 3 FAQs، و414 مفتاح ترجمة عبر 3 لغات = 1242 صفًا مصدرية/حيّة بعد إعادة seed. لا يشمل هذا الملف `database/legacy/schema.sql`، ولا يعلن Production قبل إغلاق البنود الخارجية.

> **الحكم الحالي:** 🟡 **READY AFTER EXTERNAL CONFIGURATION**. لا توجد مشكلة P0 برمجية معروفة في Core V1 بعد التحقق الأخير، لكن الدفع والبيئة الإنتاجية والبنية الخارجية لم تُثبت بعد.

## Automated — completed

| البند | الدليل | الحالة |
|---|---|---|
| Clean install | `npm run install:all` داخل `npm run production:check` | PASS |
| Backend syntax and Jest | `npm run check:backend` و`npm test` | PASS؛ 3 suites و24/24 tests |
| Lint | `npm run lint` | PASS؛ لا lint errors |
| Typecheck | `npm run typecheck` | PASS |
| Frontend build | `npm run build` | PASS؛ تحذير chunks أكبر من 500KB فقط |
| Unified code check | `npm run check` | PASS؛ 24/24 tests |
| Live seed | `npm run seed` | PASS؛ services=18، packages=3، personas=3، faqs=3، translations=1242 |
| Auth/API smoke | `/tmp/BİŞİŞ_api_smoke.js` | PASS؛ Customer A/B login والـcore endpoints أعادت 200 |
| Persona persistence | `/tmp/BİŞİŞ_verify_profile_persona.js` | PASS؛ persona محفوظة للمستخدمين، دون تسريب ملكية |
| Payment fail-closed | `/tmp/BİŞİŞ_payment_smoke.js` | PASS للحجب الآمن؛ verifier غير المهيأ أعاد 503 ولم يُنشأ order بعد محاولة invalid |
| IDOR | `/tmp/BİŞİŞ_idor_integration.js` | PASS؛ عزل orders/notifications/conversations/messages بين A/B |
| Storage boundary | `/tmp/BİŞİŞ_storage_e2e.js` | Historical evidence only؛ current public repo does not assume a bucket contract; owner must approve and re-run Storage verification |
| Admin catalog API | `/tmp/BİŞİŞ_admin_catalog_smoke.js` | PASS؛ admin list/create/edit/archive/cache وclient=403 للخدمات والباقات وFAQs |
| Order lifecycle | `/tmp/BİŞİŞ_order_lifecycle_smoke.js` | PASS؛ unverified gate=409، verified transitions=200، retry idempotent، event/notification delta=2، invoice=1 |
| Secrets scan | scan ساكن لأسماء الملفات، مع استبعاد `.env` والسجلات وdependencies | PASS؛ لا potential match في tracked Core source بعد استبعاد ملفات contract/config التوثيقية |
| Live cleanup | read-only counts بعد كل fixtures | PASS؛ orders/workspaces/conversations/messages/notifications/invoices/order_files=0 |

## Code fixes completed

تم تثبيت persona persistence في `public.users.persona_id` عبر `/api/users/me` و`/api/users/me/persona` مع تحقق UUID وملكية session وrollback في الواجهة. أصبح onboarding وDashboard يعيدان تحميل preference من backend بدل الاعتماد على localStorage فقط، مع إبقاء catalog الكامل ظاهرًا وعدم اختراع filtering.

تم تقوية Dashboard ضد localized JSON في FAQs وغياب `persona_content` الاختياري، وإضافة حالة خطأ مرئية مع retry بدل console-only failure. كما تم إصلاح شرط Google OAuth ليظهر فقط عندما يكون feature flag وclient ID موجودين معًا.

تم إكمال Catalog Manager داخل `/admin` للخدمات والباقات وFAQs: list/create/edit/soft-archive، validation، role authorization، active-only public reads، وcache invalidation. تم إصلاح عقد FAQ UUID وإزالة كتابة `updated_at` غير الموجودة في جدول FAQs. تم إثبات CRUD/cache بالـAPI؛ browser أثبت login وcatalog وcreate/edit، بينما archive في browser بقي اختبارًا يدويًا بسبب native confirmation timeout، وليس فشلًا في API.

تم جعل order status transitions صريحة: `new→processing|cancelled`، `processing→completed|cancelled`، `completed→refunded`، مع منع `processing/completed/refunded` قبل `payment_status=verified` وجعل إعادة الحالة idempotent. تم إصلاح invoice completion ليستخدم status المتوافق مع live constraint (`paid`) بدل `issued`، وأثبت lifecycle smoke عدم تكرار events/notifications وإنشاء فاتورة واحدة.

تم تقوية tickets/packages/chat وupload errors برسائل عامة عند أخطاء الخادم، validation أوضح، ورفض upload غير المسموح برسالة 400 بلا stack trace. بقي الدفع server-side وfail-closed، ولا توجد wallet أو transaction حقيقية في الاختبارات.

تم تنفيذ UI polish سريع وعالي الأثر دون تغيير عقود API: closing CTA فاخر في Footer، بطاقات TrustBadges ذات hierarchy وmicrocopy، floating contact/back-to-top actions تظهر بعد التمرير، وتحسينات Header للـactive state وmobile menu وARIA. ثم أضيف contact rail جانبي بحركة staggered يربط WhatsApp بالرقم الموجود أصلًا في ContactPage ويستخدم Telegram share الرسمي دون اختراع username. أضيفت 17 ترجمة canonical لهذه العناصر إجمالًا، فأصبح الإجمالي 270 مفتاحًا و810 صفوف. ثم أضيفت طبقة UI/UX متقدمة: MagneticButton، animated counters، page transitions، package selection dock، FAQ accordion مع deep-link، cursor aura، Hero ambient motion، وreduced-motion fallback. أضيفت 7 ترجمات تشغيلية إضافية، فأصبح الإجمالي 414 مفتاحًا و1242 صفًا بعد إضافة Client 360 وWorkbench وProject Workspace وNotification Center.

## External configuration required

| المتطلب | لماذا هو مطلوب قبل Production | دليل الإغلاق المطلوب |
|---|---|---|
| Supabase Production project | المشروع الذي اختُبر هنا test project وليس بيئة إطلاق | تأكيد ref الإنتاجي، backup/PITR، تطبيق canonical migrations 001→011 والتحقق من metadata/RLS |
| Production secrets | عزل service role وبيانات التشغيل | secret store server-only لـ`SUPABASE_SERVICE_ROLE_KEY`، وpublic Vite variables منفصلة، دون نسخ `.env` الاختباري |
| Domain/DNS/CORS | منع CORS وredirects غير الصحيحة | domain/DNS فعليان، `ALLOWED_ORIGINS` و`VITE_API_URL` وSocket origins مضبوطة |
| Payment verifier | order creation الحقيقي محجوب حاليًا | Polygon RPC موثوق، USDC contract، recipient EOA يقدمه المالك، confirmations، ثم testnet E2E وduplicate/replay checks |
| Docker/Compose/nginx | لم تتوفر Docker CLI في sandbox | `docker compose config/build/up` على host/CI حقيقي، ثم health/API/SPA/WebSocket/Storage checks |
| Google OAuth، إن أُريد | feature اختياري ومغلق حاليًا | Google Cloud client، Supabase provider، origins/redirects، ثم browser login/profile provisioning |

## Manual acceptance tests

ينفذ المؤسس هذه الاختبارات فقط بعد تجهيز البيئة المقصودة، وبحسابات test قبل أي أموال حقيقية:

1. افتح Home وAbout وPackages وFAQ وContact وLogin وRegister بالعربية والإنجليزية والتركية، وتحقق من عدم ظهور raw translation keys أو صفحات فارغة.
2. أنشئ مستخدمًا جديدًا، أكد البريد، سجّل الدخول، اختر persona، أعد تحميل الصفحة وسجّل الدخول من جلسة جديدة. يجب أن تبقى persona محفوظة ولا تظهر شاشة onboarding مرة ثانية.
3. جرّب Customer A وCustomer B معًا، وتحقق أن orders وnotifications وconversations وmessages وfiles لا تتسرب بين الحسابين.
4. افتح `/admin` كـclient؛ يجب أن تظهر حالة unauthorized أو 403. افتحها بحساب staff مصرح، وأنشئ عنصرًا مؤقتًا، عدّله، archive، وتحقق من اختفائه من القراءة العامة ثم احذف fixture فقط.
5. بعد تجهيز verifier على testnet، اختر package canonical، أرسل transaction اختبارية غير مالية حقيقية، تحقق من verification والـduplicate/replay protection، ثم تابع `new→processing→completed` والإشعار والفاتورة.
6. ارفع ملفًا مسموحًا وملفًا مرفوضًا، ثم جرّب تنزيل ملف الحساب الآخر. يجب أن ينجح المالك فقط وأن تبقى bucket خاصة.
7. نفّذ `docker compose config/build/up` ثم اختبر restart وdeep links و`/api/health` وSocket.IO وprivate Storage من domain الفعلي.

## Rollback

قبل النشر، أنشئ release tag وصورة backend/frontend قابلة لإعادة النشر، وفعّل backup/PITR لقاعدة Supabase. عند فشل التطبيق، أعد image/config إلى آخر release معروف، وأوقف تفعيل payment verifier عبر configuration بدل قبول طلبات غير متحقق منها.

لا تعكس migrations التطبيقية يدويًا ولا تحذف بيانات production كحل rollback. migrations 001→011 هي السلسلة canonical الحالية؛ أي تصحيح لاحق يجب أن يكون migration additive/idempotent مع خطة rollback منفصلة. عمليات catalog الجديدة soft-archive، أما حذف fixtures في الاختبارات فيقتصر على بيانات مؤقتة معروفة.

## Current release gate

لا يُسمح بتحويل الحالة إلى **READY FOR PRODUCTION LAUNCH** إلا بعد إغلاق payment verifier وproduction Supabase/domain/secrets وDocker/runtime verification، ثم إعادة تشغيل هذه القائمة على البيئة الإنتاجية أو staging مطابقة لها. React Router audit advisories وغياب frontend test suite هما debt موثق، ولا يجوز حلّهما بـ`npm audit fix --force` أو Router 7 قسريًا دون migration واختبارات توافق.
