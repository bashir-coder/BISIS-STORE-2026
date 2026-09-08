# BİSIŞ V1 — Diagnostic Read-Only Report

**Scope:** قراءة فقط على مشروع Supabase staging مستقل؛ معرّف المشروع غير مضمّن في النسخة العامة. لم تُنفذ أي `INSERT`, `UPDATE`, `DELETE`, `ALTER`, `DROP`, `CREATE`، ولم تُنشأ مستخدمات، ولم تُشغّل اختبارات RLS/IDOR، ولم يُعدّل أي ملف في المشروع.

## A) الحالة الفعلية الحالية

جلسة SQL Editor تحققت فعليًا كالتالي: `current_user = postgres`, `session_user = postgres`, و`current_schema = public`. كما أعاد `to_regclass('public.users')` القيمة `users`، ما يثبت أن `public.users` موجود فعليًا في الجلسة الحالية.

يعرض PostgREST OpenAPI مسارًا واحدًا باسم `/users` وتعريفًا باسم `users` في public API. لا يوجد دليل فعلي في هذه الدورة على وجود نسخة ثانية مستخدمة من جدول users في schema آخر. نتائج `information_schema` و`pg_class` القديمة التي أعادت 0 rows لم تُستخدم كحكم نهائي؛ التشغيل المستقل اللاحق لـ`to_regclass` أثبت وجود public.users، ولذلك تُصنّف النتائج القديمة كحالة result/editor غير حاسمة، لا كدليل على غياب الجدول.

## B) الأعمدة والـdefaults والـnullability

استعلام `information_schema.columns` أعاد 18 صفًا. الأعمدة غير القابلة لـNULL هي `id` و`email` و`full_name`. `id` من نوع uuid مع default `gen_random_uuid()`. `role` من نوع text مع default `'visitor'::text`. `auth_provider` من نوع text مع default `'email'::text`. `created_at` و`updated_at` لهما default `now()`. `is_verified` default false و`is_active` default true. بقية الأعمدة التي ظهرت هي `password`, `avatar`, `workspace_id`, `referral_code`, `referred_by`, `verification_token`, و`verification_expires`، وهي nullable وفق النتيجة الفعلية.

## C) جميع constraints الحالية على public.users

| الاسم | النوع | التعريف الفعلي |
|---|---|---|
| `users_auth_provider_check` | CHECK | `auth_provider IN ('email','google')` |
| `users_email_key` | UNIQUE | `UNIQUE (email)` |
| `users_pkey` | PRIMARY KEY | `PRIMARY KEY (id)` |
| `users_referral_code_key` | UNIQUE | `UNIQUE (referral_code)` |
| `users_referred_by_fkey` | FOREIGN KEY | `referred_by REFERENCES users(id) ON DELETE SET NULL` |
| `users_role_check` | CHECK | `role IN ('visitor','client','admin','super_admin','manager','editor')` |
| `users_verification_token_key` | UNIQUE | `UNIQUE (verification_token)` |
| `users_workspace_id_fkey` | FOREIGN KEY | `workspace_id REFERENCES workspaces(id) ON DELETE SET NULL` |

القيد القديم الذي كان يسمح بـ`user` لم يعد موجودًا. القيد الحالي باسم `users_role_check` موجود، ويسمح بـ`client` ولا يسمح بـ`user` وفق تعريف PostgreSQL الفعلي.

## D) CHECK constraints تحديدًا

يوجد CHECKان فقط على public.users: `users_auth_provider_check` و`users_role_check`. لا توجد CHECK أخرى ظاهرة في نتيجة `pg_constraint`.

## E) Triggers

استعلام `pg_trigger` مع استبعاد triggers الداخلية (`NOT tgisinternal`) أعاد **0 صفوف**. لذلك لا يوجد حاليًا trigger غير داخلي مرفق بـ`public.users` وفق metadata الحالية. هذا لا يثبت وحده شيئًا عن triggers على `auth.users` أو عن function قد تُستخدم من جدول آخر؛ لم يتم فحص أو تعديل أي trigger خارج نطاق public.users في هذا التشخيص.

## F) RLS والسياسات — metadata فقط

`public.users` لديه `relrowsecurity = true` و`relforcerowsecurity = false`. استعلام `pg_policies` أعاد أربع سياسات: سياسة SELECT للإداريين، سياسة ALL للمستخدم نفسه عبر `auth.uid() = id`، وسياسة UPDATE وSELECT للملف الشخصي الذاتي. لم يتم اختبار السلوك الفعلي لهذه السياسات، امتثالًا لمنع RLS/IDOR tests في هذه المرحلة.

## G) هل توجد قيود تمنع client؟

لا. الدليل metadata المباشر هو تعريف `users_role_check` الحالي، الذي يتضمن `client` ضمن القيم المسموح بها. ولا توجد حاجة إلى INSERT تجريبي لاستنتاج ذلك.

## H) تفسير نتيجة P0 السابقة

النتيجة المؤكدة الآن هي أن P0 Role Contract موجود فعليًا بالشكل المطلوب. أما نتيجة verification السابقة التي أعادت 0 rows فقد كانت غير متسقة مع النتائج المستقلة اللاحقة؛ لا يوجد في الأدلة المتاحة ما يثبت Supabase bug. السبب المحتمل المدعوم فقط هو عدم تزامن/عرض نتيجة SQL Editor أو قراءة result قديمة أثناء المحاولات السابقة. لا يُثبت هذا التقرير أي سبب داخلي إضافي.

## I) أصغر إصلاح آمن لاحقًا

لا يوجد إصلاح إضافي للقيد مطلوب حاليًا؛ القيد الصحيح موجود بالفعل. أصغر خطوة لاحقة، بعد موافقة منفصلة، هي تشغيل verification قراءةً فقط مرة أخرى في جلسة مستقلة ثم الانتقال إلى إنشاء مستخدم اختبار واحد. لم يُنفذ هذا الانتقال هنا، ولم يُنفذ أي إصلاح في هذه المرحلة.
