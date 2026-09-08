# BİŞIŞ Service Delivery Engine + Client Experience 2.0 — Contract Design

## القرار المعماري

سيتم تمديد البنية الحالية additive فقط. ستبقى `services`, `packages`, `orders`, `projects`, `order_events`, `order_files`, `notifications`, `tickets`, `conversations/messages` وExecution Engine الحالي مصادرها الأصلية. لن يُعاد بناء الدفع أو Auth أو Socket.IO أو Order Lifecycle، ولن تُستخدم `database/legacy/schema.sql`.

> الهدف التشغيلي: تحويل الطلب المؤكد إلى مشروع قابل للتتبع، ثم إظهار ما يحتاجه العميل وما أنجزه الفريق وما هي الخطوة التالية، من خلال حالات persisted لا من خلال نسب أو أحداث واجهة وهمية.

## حدود المصادر

| المجال | المصدر الحالي | التمديد المقترح |
|---|---|---|
| الخدمة والقالب | `project_templates.service_id` موجود في 005 | استخدامه مباشرة؛ لا نضيف `services.template_id` في أول خطوة لأن العلاقة موجودة من جهة القالب |
| الطلب والمشروع | `orders.project_id` موجود، والربط اليدوي موجود في projects.routes.js | إضافة مسار تهيئة idempotent يعتمد على order صالح وtemplate صالح |
| Execution | milestones/tasks/activity موجودة مع RLS | إعادة الاستخدام، مع عدم كشف المهام الداخلية للعميل إلا عبر client-facing projection API |
| متطلبات العميل | غير موجودة | `project_requirements` additive مع حالات persisted وRLS read boundary |
| حالة المشروع | `projects.status` موجود لكنه عام | إضافة `execution_state`, `waiting_on`, `state_updated_at` إلى `projects`، مع اشتقاق deterministic من requirements/tasks/delivery |
| التسليم والمراجعة | غير موجودة | `project_deliveries` additive بسجل تسليم واحد مضبوط لكل مشروع مع revision flow محدود |
| ملفات المتطلبات/التسليم | `order_files` موجود و`file_kind` يدعم customer_input/delivery/internal | إعادة استخدامه، مع ربط المشروع عبر الطلب المرتبط؛ لا نكشف object paths للواجهة |
| الإشعارات | `notifications` مرتبطة بالطلب | إعادة استخدام `order_id` للمشروع المرتبط، وإضافة project-aware endpoint server-side عند الحاجة فقط |
| النشاط | `project_activity` موجود ويدعم entity_type project | تسجيل requirement/delivery events كـ`entity_type='project'` مع payload محدود، دون تعديل قيد entity_type |

## النماذج الجديدة

### project_requirements

يمثل ما يحتاجه BİŞIŞ من العميل. الحقول: `id`, `project_id`, `title`, `description`, `requirement_type` (`text` أو `file` أو `choice`), `is_required`, `status` (`requested`, `submitted`, `needs_revision`, `approved`, `not_applicable`), `response_value`, `file_id`, `client_visible`, `created_by`, `updated_by`, timestamps. لا يسمح العميل بتغيير عنوان المتطلب أو كونه مطلوبًا؛ mutations تمر من backend validation فقط.

### project_deliveries

يمثل حزمة التسليم الحالية للمشروع. الحقول: `id`, `project_id` unique، `status` (`ready_for_delivery`, `prepared`, `delivered`, `client_review`, `approved`, `revision_requested`, `completed`)، `notes`, `revision_reason`, `revision_count`, `prepared_by`, `delivered_at`, `reviewed_at`, `approved_at`, timestamps. ملفات التسليم الفعلية تبقى في `order_files` مع `file_kind='delivery'` وتُعرض عبر endpoint موقّع ومصرّح به.

### projects execution state

القيم المقترحة: `not_started`, `waiting_on_client`, `waiting_on_founder`, `in_progress`, `blocked`, `ready_for_review`, `ready_for_delivery`, `waiting_on_review`, `completed`. `waiting_on` يقبل `client`, `founder`, `payment`, `review`, أو null. الحالة لا يكتبها العميل، وتُحدث backend بعد العمليات المهمة من خلال دالة اشتقاق deterministic.

## حدود authorization

مسارات العميل لن تستقبل project IDs على الثقة. يتحقق backend من أن المشروع مرتبط بطلب يملكه `req.user.id`. staff يستخدم workspace authorization القائم. RLS للجداول الجديدة يسمح staff الكامل، وclient بالقراءة للصفوف `client_visible` فقط؛ mutations الحساسة تمر من backend وتتحقق من owner/state/transition. لا تُستخدم service-role credentials في frontend.

## العمليات الأساسية المقترحة

| العملية | الفاعل | الأثر الحقيقي |
|---|---|---|
| `POST /api/execution/orders/:orderId/initialize` | staff | ينشئ أو يعيد استخدام project، يطبق template، ينشئ requirements، يسجل activity، ويعيد حالة دقيقة عند الفشل |
| `GET /api/client/home` | client | يعيد projects/orders/next actions/notifications/recent activity من بيانات مصرح بها |
| `GET /api/client/projects/:id` | client/staff وفق access | يعيد projection العميل: state/progress/current milestone/requirements/activity/files/delivery |
| `PATCH /api/client/projects/:id/requirements/:requirementId` | client owner | submit أو request revision response، مع validation للحالة والملكية |
| `POST /api/execution/projects/:id/delivery` | staff | prepare/deliver transition مع event وnotification عند الحاجة |
| `POST /api/client/projects/:id/delivery/approve` | client owner | approve transition مع event وproject state update |
| `POST /api/client/projects/:id/delivery/revision` | client owner | revision transition مع reason، event، notification، وrevision_count محدود |

الأسماء النهائية ستُثبت بعد مراجعة route registration والـschema الحي قبل الكتابة.

## قواعد الحالة والتقدم

يُحسب تقدم المشروع من عدد المهام `done` أو `cancelled` من مجموع المهام، ولا تُعرض نسبة إذا لم توجد مهام. أولوية الحالة: `completed`، ثم delivery review، ثم blocked، ثم waiting on client عند وجود required requirements غير مكتملة، ثم ready for review عند اكتمال المهام، ثم in progress عند وجود نشاط/مهام، ثم not_started. هذا لا يستبدل Order Lifecycle؛ order status يصف المعاملة، وexecution state يصف العمل بعد الشراء.

## خطة التنفيذ الآمنة

1. إنشاء migration additive محلية وتدقيق SQL قبل تشغيلها.
2. تشغيلها في Supabase فقط بعد تأكيد metadata وعدم وجود object name collision، والتوقف عند أي خطأ حرفي.
3. تحقق read-only للجداول والقيود والفهارس وRLS والسياسات.
4. بناء backend operations مع safe errors وidempotency وactivity.
5. اختبارات mocked authorization ثم smoke test حي fixtures موسومة مع cleanup.
6. ربط Client Home وProject Workspace بعقود client-facing، مع loading/empty/error/permission states.
7. إضافة delivery/review وnotifications بحالات حقيقية فقط.
8. دمج Workbench/Command Center بعد وجود state data حقيقية.
9. إعادة `npm run check` ثم browser/RTL/mobile verification والتقرير الصريح.

## ما لن يُبنى الآن

لن تُبنى agent أو AI أو workflow designer أو chat architecture جديدة أو payment provider جديدة أو analytics عامة أو social/CRM features. لن تُضاف نسب progress ثابتة أو notifications لكل تغيير صغير أو approval button بلا backend effect.
