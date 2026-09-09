# BİŞIŞ V1 — Database Contract & Runtime Baseline

**نطاق التقرير:** المرحلة 2 فقط، حتى نقطة التحقق الآمن قبل تطبيق migration.

**القرار التشغيلي:** لم يتم الاتصال بأي قاعدة بيانات ولم يتم تعديل production أو staging، لأن ملف البيئة الحالي لا يثبت أن الهدف staging ولا يوفّر طريقة DDL آمنة ومؤكدة.

## A — ما تم إصلاحه

لم يتم تعديل كود التطبيق أو قاعدة البيانات في هذه المرحلة.

تم تنفيذ تحليل محلي فقط للملفات التالية:

| الملف | الغرض من الفحص |
|---|---|
| `backend/src/api/middleware/auth.middleware.js` | تتبع مصدر `LEGACY_PROFILE_MIGRATION_REQUIRED` ومسار إنشاء/قراءة profile |
| `database/migrations/001_launch_contract.sql` | فحص users table وAuth trigger والسياسات والوظائف المعلنة |
| `database/legacy/schema.sql` | مقارنة المخطط القديم مع Launch Contract |
| `.env` | التحقق من وجود متغيرات البيئة دون طباعة قيم الأسرار |

## B — ما تم إثباته محليًا

### 1. مصدر الرسالة

تظهر الرسالة في `backend/src/api/middleware/auth.middleware.js` داخل `findOrProvisionUser`:

1. يتحقق الخادم من Supabase Auth token عبر `supabase.auth.getUser(token)`.
2. يبحث عن سجل في `public.users` باستخدام `id = authUser.id`.
3. إذا لم يجده، يبحث عن سجل آخر باستخدام `email = authUser.email`.
4. إذا وجد سجل email بمعرّف UUID مختلف، يرمي الخطأ `LEGACY_PROFILE_MIGRATION_REQUIRED` ويرجع HTTP 409.
5. إذا لم يجد أي سجل، يحاول إنشاء profile جديد بالـUUID القادم من Supabase Auth.

إذًا الرسالة ليست مشكلة token بحد ذاته؛ هي حماية من ربط جلسة Auth بسجل profile قديم يملك نفس البريد لكن UUID مختلف.

### 2. ما الذي يفعله Launch Contract

`database/migrations/001_launch_contract.sql` يعرّف `public.users.id` كـUUID، ويضيف function باسم `public.handle_supabase_auth_user()` وtrigger باسم `on_auth_user_created` على `auth.users`.

الـtrigger يحاول إدخال profile باستخدام `NEW.id`، لكنه يمنع الإدخال إذا وجد سجلًا سابقًا يطابق `id` **أو** `email`:

```sql
WHERE NOT EXISTS (SELECT 1 FROM public.users WHERE id = NEW.id OR email = NEW.email);
```

هذا يعالج المستخدمين الجدد عند إنشاء Auth identity بعد تطبيق migration، لكنه **لا يعالج تلقائيًا** legacy profile موجودًا مسبقًا بالبريد نفسه وUUID مختلف. في هذه الحالة يظل middleware يرى email collision ويطلق الخطأ المقصود.

### 3. هل توجد migration قديمة تعالج المشكلة؟

لم يظهر في `database/migrations/001_launch_contract.sql` أي إجراء يطابق سجلات `public.users` القديمة مع `auth.users`، ولا توجد خطوة تنقل UUID أو تدمج الصفوف أو تعالج duplicate emails. الموجود هو:

- إنشاء/توسيع أعمدة `users`.
- تحديث `full_name` من `name` عند الحاجة.
- إنشاء Auth trigger للمستقبل.

لذلك فإن Launch Contract **لا يكفي وحده** لترحيل legacy profiles الموجودة مسبقًا.

### 4. mismatch بين Auth وpublic users

المشكلة البنيوية المحتملة هي أن `public.users.id` في legacy data قد يكون UUID مولدًا مستقلًا عن `auth.users.id`. Launch Contract الجديد يفترض أن `public.users.id = auth.users.id`.

يوجد أيضًا فرق في الصرامة بين المخططين: legacy schema يجعل `users.name` غير قابل لـNULL، بينما Launch Contract يجعله nullable، ويضيف `full_name` و`is_verified` و`is_active`. هذا ليس سبب رسالة 409 مباشرة، لكنه يؤكد أن المخططين ليسا مصدر حقيقة واحدًا.

## C — ما فشل

لم يفشل تنفيذ migration لأن migration **لم تُنفذ**. لا يوجد خطأ SQL حقيقي مسجل يمكن نسبته إلى ملف أو سطر.

لم يتم تشغيل Backend ضد Supabase staging، لأن staging target لم يُثبت، ولأن الطريقة المتوفرة حاليًا لا تسمح بتطبيق DDL بأمان.

لم يتم إنشاء Customer A أو Customer B، ولم تُجرَ اختبارات RLS أو IDOR على قاعدة فعلية.

## D — ما لم نستطع اختباره

| الاختبار | سبب عدم التنفيذ |
|---|---|
| تطبيق `database/migrations/001_launch_contract.sql` | لا يوجد `DATABASE_URL` مؤكد لـstaging، ولا أداة `psql` أو Supabase CLI، والهدف الحالي غير موسوم staging |
| التحقق من tables/FKs/indexes/constraints | يتطلب اتصالًا بقاعدة staging فعلية |
| التحقق من RLS/policies/functions/triggers | يتطلب تطبيق migration ثم استعلام PostgreSQL/Supabase |
| إعادة إنتاج `LEGACY_PROFILE_MIGRATION_REQUIRED` على staging | يحتاج Auth user وlegacy profile حقيقيين |
| Backend runtime ضد staging | لا يمكن اعتباره آمنًا قبل تثبيت الهدف والـcredentials |
| Auth/session/workspace/order/conversation/invoice/notification/file tests | جميعها تعتمد على migration وبيانات staging فعلية |
| Docker runtime validation | غير مطلوب لهذه النقطة، وما زال محجوبًا لأن Docker CLI/runtime غير متوفر؛ لا يُستنتج منه نجاح أو فشل |

## E — المشاكل البرمجية المتبقية مرتبة بالأولوية

### P0 — مانع المرحلة

| المشكلة | السبب | الإجراء المطلوب |
|---|---|---|
| بيئة Supabase غير معرّفة كـstaging | `.env` يحتوي `SUPABASE_URL` و`SUPABASE_SERVICE_ROLE_KEY` بلا marker يثبت أنها staging | تأكيد المؤسس أن الهدف staging أو توفير `staging.env` منفصل |
| لا توجد طريقة DDL مؤكدة | service role key وحده لا يثبت إمكانية تشغيل CREATE/ALTER SQL | توفير `DATABASE_URL` خاص بـstaging أو تطبيق migration يدويًا من SQL Editor ثم إرسال النتيجة |
| migration غير مطبقة | لا يمكن اختبار runtime أو RLS قبلها | تطبيق Launch Contract على قاعدة staging فارغة فقط |

### P1 — سيظهر بعد توفير staging

| المشكلة | السبب المتوقع | الإجراء المطلوب |
|---|---|---|
| legacy profiles ذات email collision | trigger يتجنب duplicate email، وmiddleware يرفض UUID المختلف | إنشاء خطة migration صريحة تربط `public.users` بـ`auth.users` قبل تشغيل Auth tests؛ لا تُنفذ بالتخمين |
| اختلاف بيانات users القديمة | legacy name/role/verification قد لا تطابق contract الجديد | قياس الصفوف والقيود على staging ثم إعداد migration متوافقة مع backend |
| غياب إثبات RLS والعزل | policies موجودة في الملف فقط | اختبار Customer A/B وWorkspace A/B على staging فعلية |

### P2 — ليس مانعًا لهذه النقطة

| المشكلة | الملاحظة |
|---|---|
| تنظيف تحذيرات lint | لا تؤثر على Database Runtime Baseline |
| chunk size في frontend | لا يؤثر على تطبيق Launch Contract |
| Docker runtime | محجوب بيئيًا بشكل مستقل، وليس سببًا لعدم إجراء تحليل قاعدة البيانات |

## F — قرار المرحلة

# BLOCKED — staging target and migration execution credentials are not verified

هذا القرار لا يعني أن Launch Contract فاشل. يعني فقط أن إثباته الفعلي غير ممكن وآمن قبل توفير بيئة staging مؤكدة وطريقة تنفيذ DDL. لم يتم لمس الدفع الحقيقي، ولم تُضف Features، ولم يُعاد بناء Authentication من الصفر.

## ما أحتاجه للمتابعة

يكفي توفير أحد الخيارين:

- تأكيد صريح بأن `.env` الحالي يخص Supabase staging فارغًا، مع السماح باستخدامه.
- أو إنشاء `staging.env` محلي غير committed يحتوي على `SUPABASE_URL` و`SUPABASE_SERVICE_ROLE_KEY` الخاصين بـstaging.

ولتنفيذ migration يلزم أيضًا `DATABASE_URL` الخاص بـstaging، أو تطبيق الملف يدويًا في Supabase SQL Editor وإرسال نتيجة التنفيذ. بعد ذلك فقط أنتقل إلى التحقق من الجداول والسياسات ثم Backend runtime والعزل.

## المراجع المحلية

- `backend/src/api/middleware/auth.middleware.js`
- `database/migrations/001_launch_contract.sql`
- `database/legacy/schema.sql`
- `docs/BİŞİŞ_V1_Build_Baseline_Report.md`
- `docs/BİŞİŞ_V1_Rescue_and_Launch_Plan.md`
