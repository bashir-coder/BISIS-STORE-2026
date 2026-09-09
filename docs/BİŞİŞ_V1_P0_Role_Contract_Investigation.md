# BİŞIŞ V1 — P0 Role Contract Investigation

**النطاق:** قراءة فقط. لم يتم تطبيق SQL، ولم تُعدّل قاعدة البيانات أو migration أو backend أو frontend.

## الحكم المختصر

الـcontract المقصود في BİŞIŞ V1 هو **A) `client` للمستخدم العميل**، مع بقاء أدوار الطاقم المنفصلة `admin`, `super_admin`, `manager`, و`editor` حيث تظهر في الكود والمخطط. لا يوجد دليل حقيقي على أن `user` هو auth/business role في BİŞIŞ.

الاستعمالات التي تحتوي `role: 'user'` في `backend/src/api/routes/ai.routes.js` وفي `frontend/src/components/AIChatbot.tsx` تخص **دور رسالة داخل بروتوكول المحادثة** (`system`, `assistant`, `user`) وليست دور المستخدم في قاعدة البيانات أو الصلاحيات. لا ينبغي استخدامها لتحديد role contract.

## 1. Launch Contract

الملف `database/migrations/001_launch_contract.sql` يعرّف `public.users.role` افتراضيًا على `client`، ويسمح بالأدوار:

`super_admin`, `admin`, `manager`, `editor`, `client`, `visitor`.

ويعرّف `workspace_members.role` افتراضيًا على `client`، ويسمح بـ`super_admin`, `admin`, `manager`, `editor`, `client`. كما أن `public.handle_supabase_auth_user()` يُدخل المستخدم الجديد بدور `client` صراحةً. لا يوجد في هذا الملف استخدام لـ`user` بوصفه قيمة auth/business role.

## 2. Files using `client` as an auth/business role

| الملف | الموضع | الدليل |
|---|---:|---|
| `database/migrations/001_launch_contract.sql` | 18، 30، 51، 80 | default/allowed role وAuth trigger insert بقيمة `client` |
| `backend/src/api/middleware/auth.middleware.js` | 20 | `profileFromAuthUser()` يجهز profile جديدًا بدور `client` |
| `backend/tests/integration.test.js` | 11، 20، 56 | fixtures لعملاء الاختبار بدور `client` |

هذه هي الاستعمالات الفعلية ذات الصلة بـauth/business role. لا يوجد في frontend literal auth role بقيمة `client`؛ وجود نصوص مثل `ClientPortal` و`dashboard.client` تسمية واجهة/شريحة وليست حقل role.

## 3. Files using `user` as a role

لا يوجد ملف يستخدم `user` كـauth/business role في backend أو frontend.

يوجد استعمالان غير متعلقين بالصلاحيات:

| الملف | الموضع | طبيعة الاستعمال |
|---|---:|---|
| `backend/src/api/routes/ai.routes.js` | 80 | `role: 'user'` لدور رسالة LLM |
| `frontend/src/components/AIChatbot.tsx` | 9، 328، 407 | `role: 'user'` لدور رسالة Chat UI مقابل `assistant` |

في `backend/tests/integration.test.js` تظهر أسماء مثل `userA` و`userB`، لكنها ليست قيمًا لحقل role؛ أدوارهما المعرفة في fixtures هي `client`.

## 4. Middleware, authorization, and RLS

`backend/src/api/middleware/auth.middleware.js` يعرّف `authorize(...roles)` بصورة عامة، ثم تتحكم كل route في الأدوار المسموح بها. لا توجد مقارنة auth role مع `user` أو `visitor` أو `client`.

الـbackend يستخدم أدوار الطاقم التالية فعليًا:

| الملف | الأدوار المستخدمة في الصلاحيات |
|---|---|
| `backend/src/api/routes/orders.routes.js` | `admin`, `super_admin`, `manager` |
| `backend/src/api/routes/invoices.routes.js` | `admin`, `super_admin`, `manager` |
| `backend/src/api/routes/users.routes.js` | `admin`, `super_admin`, `manager` |
| `backend/src/api/utils/conversation-access.js` | `admin`, `super_admin`, `manager` |
| بقية routes الإدارية | `admin`, `super_admin` أو `admin`, `super_admin`, `manager` بحسب المسار |

المستخدم العميل لا يحتاج قيمة `user` كي يمر في المسارات الخاصة به؛ المنطق يعتمد على هوية المستخدم وملكية السجل. أما RLS في `001_launch_contract.sql` فلا يعتمد على `role` أصلًا؛ سياساته تعتمد على `auth.uid()` و`workspace_members` وملكية `user_id`/`workspace_id`.

## 5. Comparison with the live constraint

القيد الحي المثبت هو:

```text
CHECK (role IN ('visitor', 'user', 'admin', 'super_admin'))
```

وهو لا يطابق contract V1 في نقطتين: يرفض `client` الذي ينشئه Auth trigger، كما لا يسمح بـ`manager` و`editor` اللذين يستخدمهما Launch Contract وبعض منطق staff في backend. لذلك فالمشكلة ليست مجرد تسمية `user` مقابل `client`؛ القيد الحي أقدم وأضيق من contract V1 كاملًا.

## 6. Is replacing `user` with `client` safe?

**نعم من حيث الدليل البرمجي، بشرط أن يكون الإصلاح هو مواءمة القيد كاملًا مع contract V1، لا مجرد استبدال كلمة واحدة.** لا يوجد backend أو frontend auth logic يعتمد على `user` كدور، بينما يعتمد Auth trigger والـfixtures والمخطط على `client`.

استبدال `user` بـ`client` مع إبقاء القيد ناقصًا لـ`manager` و`editor` لن يكون إصلاحًا كاملًا، وسيترك تعارضًا لاحقًا مع أدوار الطاقم الموجودة فعلًا في Launch Contract والbackend.

## 7. أقل إصلاح ممكن — لا يُنفذ الآن

بعد موافقة المؤسس، أقل إصلاح معماري هو تعديل **قيد واحد فقط** على `public.users.role`: إزالة القيد الحي القديم `users_role_check` وإعادة إنشائه بمجموعة V1 التالية:

`visitor`, `admin`, `super_admin`, `manager`, `editor`, `client`.

لا يلزم تغيير Auth architecture، ولا إضافة `user`، ولا دعم role alias، ولا تعديل frontend أو routes أو RLS. بعد ذلك يُعاد تشغيل اختبار إنشاء Auth user، ثم التحقق من تطابق `auth.users.id = public.users.id`.

## القرار النهائي

**BİŞIŞ V1 يعتمد `client` لا `user` كدور العميل.** أدوار الطاقم تبقى منفصلة. لا يوجد دليل يبرر دعم الاثنين معًا. التحقيق مكتمل، وأتوقف هنا بانتظار موافقة المؤسس قبل أي إصلاح.
