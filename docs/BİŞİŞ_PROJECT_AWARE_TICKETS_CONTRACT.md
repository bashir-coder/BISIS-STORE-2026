# BİŞIŞ V1 — Project-Aware Support Tickets Contract

## القرار

أُضيف `public.tickets.project_id` كحقل nullable من النوع `bigint` مع foreign key إلى `public.projects(id)` و`ON DELETE SET NULL`. إبقاء الحقل nullable يحافظ على التذاكر القديمة غير المرتبطة بمشروع، بينما يسمح للمسار الجديد بربط تذكرة بمشروع حقيقي.

## العلاقة والملكية

العلاقة المنطقية هي `tickets.project_id → projects.id`. ملكية العميل لا تُستنتج من workspace membership؛ المصدر canonical هو `projects.id → orders.project_id → orders.user_id = auth.uid()`. عند إنشاء تذكرة مرتبطة، يتحقق backend من وجود order يربط المشروع بالمستخدم الحالي، ثم يحفظ workspace المشروع في التذكرة.

## RLS

سياسة العميل الجديدة `customers manage own tickets` تسمح للمستخدم بإدارة تذكرته التي يملكها، وتسمح بحقل `project_id = NULL` للتذاكر العامة، لكنها تشترط عند وجود project أن يظهر المشروع في order يملكه المستخدم الحالي. سياسات staff الجديدة تقصر القراءة والتحديث على `super_admin` أو عضو staff داخل workspace التذكرة. أُزيلت خمس سياسات legacy permissive بعد فحص metadata لأنها كانت توسع الصلاحية بمنطق OR.

> API denial ليس إثباتًا لعزل RLS. لذلك استخدم smoke اختبار JWT مباشر عبر Supabase/PostgREST إضافة إلى اختبارات API.

## API

يدعم `POST /api/tickets` الحقل الاختياري `project_id` مع validation وملكية المشروع. يدعم `GET /api/tickets/my?project_id=:id` عرض تذاكر العميل للمشروع الحالي. يدعم مسار staff `GET /api/tickets?project_id=:id` الفلترة ضمن workspace، كما يحافظ `PATCH /api/tickets/:id` على staff authorization الحالي.

## رؤية العميل والموظف

العميل يرى تذاكر مشروعه فقط. staff يرى تذاكر workspace المصرح له بها، ولا يرى تذكرة workspace خارجي. لا تُعرض project-context tickets داخل chat في هذه المهمة؛ chat يحتاج مراجعة authorization مستقلة قبل فتح سياق مشروع له.

## سلامة migration والـrollback

المigrationان 008 و009 additive/corrective ولا تعيدان تشغيل 001 ولا تعدلان 005–007. `project_id` nullable و`ON DELETE SET NULL` يمنعان كسر التذاكر القديمة عند حذف مشروع. التراجع الآمن يتطلب migration منفصلة مدروسة: إعادة السياسات المقيدة أولًا ثم إزالة الفهرس والـforeign key والحقل فقط بعد التأكد من عدم وجود اعتماد، وليس تنفيذ DROP عشوائي في SQL Editor.

## دليل التحقق

أثبت metadata الحي وجود العمود والفهرس والـforeign key، ثم أثبت metadata النهائي بقاء ثلاث سياسات فقط على `public.tickets`. أثبت live smoke إنشاء تذكرة Customer A مرتبطة بمشروعه، قراءة العميل والموظف المصرح، تحديث staff، رفض Customer B لربط مشروع A، وعودة صفر صفوف في direct RLS من Customer B. أُجري التنظيف بنجاح دون أخطاء.
