# Execution Migration Browser Log

- تم فتح SQL Editor للمشروع الاختباري المؤكد.
- حصل تأكيد صريح من المؤسس قبل أي ALTER/CREATE.
- migration 005 موجودة canonical في `database/migrations/005_execution_engine.sql`.
- محاولة حقن النص عبر `browser_console_exec` من payload خارجي فشلت بسبب CSP/Failed to fetch، ولم تُشغّل أي SQL.
- لم تُنفذ migration بعد، ولم تُحذف أو تُعدّل بيانات.
- الخطوة التالية هي إدخال النص الصحيح إلى محرر SQL ثم الضغط على Run، وبعدها read-only verification.

محاولة إدخال نص SQL الكامل عبر browser_input انتهت بمهلة 60 ثانية. لم أضغط Run ولم أعتبر migration ناجحة؛ يجب فحص حالة المحرر قبل أي محاولة جديدة.

تم اكتشاف `window.monaco` داخل SQL Editor، والمحرر يحتوي model قابلًا لـ`setValue`. تم تهيئة buffer وإدخال جزء واحد من payload المشفر فقط. لا تزال migration غير منفذة، ويجب إكمال التجميع ثم التحقق من طول model قبل Run.

بعد إعادة فتح SQL Editor، ظهرت دفعة الجداول والـindexes داخل Monaco بنص صحيح. عند الضغط على Run ظهرت نافذة Supabase `Session expired`; لذلك لم تُنفذ الدفعة ولم تُطبّق أي migration. يلزم تسجيل الدخول مجددًا ثم إعادة فتح SQL Editor قبل المتابعة.

بعد استمرار المستخدم، عادت الجلسة فعّالة وفتح SQL Editor. الدفعة الأولى للجداول والـindexes موجودة كاملة داخل المحرر، ولم يتم تشغيلها بعد في هذه الحالة.

تم تنفيذ الدفعة الأولى فعليًا في SQL Editor بعد اختيار Run and enable RLS. النتيجة الظاهرة: `0 rows` و`Success. No rows returned`. شملت الدفعة جداول templates وtemplate milestones/tasks وproject milestones/tasks وproject_activity، إضافة إلى indexes. لم تُنفذ دفعة الدوال والسياسات بعد.

دفعة سياسات RLS فشلت فعليًا بالخطأ الحرفي: `ERROR: 42883: function public.execution_is_staff() does not exist`. وفق قاعدة عدم التخمين، توقفت عن أي دفعة لاحقة أو إصلاح. دفعة الجداول والـindexes كانت Success، ودفعة الدوال/RLS السابقة أظهرت Success في المحرر، لكن metadata الحالية تشير إلى أن `execution_is_staff()` غير موجودة عند إنشاء السياسة. يلزم تشخيص read-only فقط قبل أي إصلاح.

نتيجة الاستعلام read-only: الجداول الستة الجديدة موجودة فعليًا (`project_activity`, `project_milestones`, `project_tasks`, `project_template_milestones`, `project_template_tasks`, `project_templates`). نتيجة دفعة الدوال/السياسات السابقة لا تثبت وجود الدوال؛ إنشاء السياسات فشل صراحةً عند `public.execution_is_staff()`. لم تُنفذ أي محاولة إصلاح بعد هذا الفشل.

في الجولة الحالية، نُفذت عبارات `CREATE OR REPLACE FUNCTION` الثلاث منفصلة بنجاح. تحقق `pg_proc` read-only أعاد 3 صفوف بالتواقيع المتوقعة: `execution_role()` تُرجع text، `execution_is_staff()` تُرجع boolean، و`execution_can_access_project(bigint)` تُرجع boolean.

بعد نجاح إنشاء الدوال والتحقق من pg_proc، تم تنفيذ دفعة سياسات القوالب والمراحل بنجاح: `Success. No rows returned`. لم تُنفذ بعد سياسات project_tasks وproject_activity.

تم تنفيذ دفعة سياسات `project_tasks` و`project_activity` بنجاح مع `NOTIFY pgrst, 'reload schema'`: النتيجة الظاهرة `Success. No rows returned`. بذلك اكتمل إنشاء السياسات المقصودة، وسأجري الآن تحقق metadata شاملًا قبل اختبارات البيانات.

تحقق metadata الشامل read-only نجح وأعاد 18 صفًا: 6 جداول Execution مع `relrowsecurity=true`، و3 دوال (`execution_role() -> text`, `execution_is_staff() -> boolean`, `execution_can_access_project(bigint) -> boolean`)، و9 سياسات بالأسماء والأوامر المتوقعة. تحقق العدّادات read-only ثبّت صراحةً: tables=6، functions=3، policies=9.

استكشاف read-only قبل fixtures: لا توجد workspaces/projects أو صفوف Execution. Auth الحالية عددها 3، وكلها profiles مطابقة، وكلها role=client؛ لا توجد هوية staff Auth جاهزة للاختبار.

تمت إضافة إصلاح محلي محدود في `backend/src/api/routes/execution.routes.js`: إزالة الحقل `position` غير الموجود من صفوف `project_tasks` في apply-template، بناءً على مطابقة route مع migration 005. `npm run check` نجح بعد الإصلاح.

تم تشغيل `backend/scripts/execution-live-smoke.js` حيًا على Supabase. النتيجة `EXECUTION_LIVE_SMOKE_PASS`، وملف النتيجة يثبت PASS لكل من Auth trigger provisioning، role promotion، template CRUD، apply-template، idempotency 409 `PROJECT_STRUCTURE_EXISTS`، structure/activity، completion timestamps، invalid milestone rejection، API workspace isolation، client route denial، وRLS المباشر للـtemplates/tasks/milestones/activity مع client visibility وinsert denial. بدأ smoke test بإنشاء fixtures موسومة مؤقتة، ثم نجح تنظيف كل ما أنشأه؛ تحقق read-only لاحقًا أثبت fixture_workspaces=0 وfixture_projects=0 وfixture_templates=0 وproject_milestones=0 وproject_tasks=0 وproject_activity=0.

ملاحظة تشغيلية: المحاولة الأولى من smoke test تركت مساحتي عمل موسومتين بسبب نقص في cleanup، بلا صفوف projects/Execution. تم حذف هاتين المساحتين فقط عبر أداة تنظيف مستقلة ضيقة النطاق، ثم تحقق read-only أثبت زوالهما. تم إصلاح cleanup في smoke test ليحذف workspaces المنشأة مستقبلًا أيضًا.

