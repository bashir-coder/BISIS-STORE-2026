# BİŞIŞ V1 — External Staging Execution Plan

## القرار الأمني

> **Historical note:** This plan was written before the disposable Staging project was created. The former dashboard-labelled environment remains protected and must not be touched by this release process. Its project identifier is intentionally omitted from the public repository.

لا تُنفّذ migrations أو Reset أو تغييرات Auth/SMTP/Storage أو اختبارات إنشاء مستخدمين جديدة على أي بيئة غير مصنفة ومؤكدة صراحةً كـStaging.

## المرحلة 1 — إنشاء Staging منفصل

ينشئ مالك المشروع مشروع Supabase جديدًا باسم واضح مثل `BİŞİŞ-platform-staging` داخل المؤسسة الصحيحة، مع منطقة مناسبة وخطة تكفي للاختبار. يجب تسجيل project ref الجديد، المنطقة، وخطة المشروع في سجل داخلي غير سري. لا يُنسخ أي service-role secret من Production إلى Staging.

## المرحلة 2 — قاعدة البيانات

يُطبّق ترتيب migrations canonical من `001_launch_contract.sql` إلى `011_performance_foreign_key_indexes.sql` على Staging فقط. لا تُستخدم `database/legacy/schema.sql` ولا تُعدّل migrations التاريخية 001–007. بعد التطبيق، تُقارن الجداول والعلاقات والمفاتيح والقيود والفهارس وRLS والسياسات والـfunctions والـtriggers مع العقد الموثق، ويُحفظ ledger ونتيجة المقارنة.

تُنشأ fixtures اختبارية معزولة Customer A وCustomer B فقط عند تأكيد أن المشروع الجديد هو Staging. يجب التحقق من تطابق `auth.users.id` مع `public.users.id`، ومن عزل workspaces وorders وconversations وmessages وinvoices وnotifications وorder_files، ثم تنفيذ cleanup والتحقق من نجاحه.

## المرحلة 3 — Auth والبريد

يُفعّل Email Provider في Staging. إذا كان المطلوب تأكيد البريد أو Magic Link أو استعادة كلمة المرور، يُضبط Custom SMTP داخل Supabase Auth باستخدام مزود اختبار أو حساب مخصص، وليس كلمة مرور Gmail الشخصية. تُختبر رسالة تسجيل جديدة ورسالة password recovery مع فحص Auth Logs وSpam/Junk.

لا يرسل تسجيل الدخول العادي بكلمة المرور رسالة بريد. زر استعادة كلمة المرور غير موجود حاليًا في الواجهة؛ لذلك لا يُعتبر password recovery اختبارًا مكتملًا قبل إضافة ذلك التدفق في Frontend بقرار مستقل. هذا ليس مانعًا لتجربة Google أو تسجيل الدخول العادي.

## المرحلة 4 — Google OAuth

يُنشأ Web OAuth Client مخصص لـStaging. تُضاف origin الخاصة بالواجهة وCallback URL الظاهر في Supabase Authentication → Providers → Google. يُحفظ Client ID في موضع public المناسب فقط، بينما يُضبط Client Secret داخل Supabase Provider أو secret store. يُختبر تدفق Google الحقيقي في Browser مع profile provisioning، ولا يُقبل ظهور الزر وحده كدليل نجاح.

## المرحلة 5 — تشغيل التطبيق

يُنشأ root `.env` خاص بـStaging و`frontend/.env` خاص بـStaging. يبقى service-role key في Backend/secret store فقط، ويبقى publishable/anon key في Frontend. تُضبط `ALLOWED_ORIGINS` و`VITE_API_URL` على عنوان Staging الحقيقي، وتُستخدم `TRUST_PROXY_HOPS=1` فقط خلف nginx موثق.

## المرحلة 6 — الدفع

يبقى payment verifier محجوبًا حتى يوافق المالك على network وcanonical USDC contract وrecipient EOA وRPC provider وconfirmation policy. لا تُستخدم عناوين placeholder أو RPC example أو محفظة شخصية أو transaction حقيقية بلا تأكيد مستقل. بعد الاعتماد، يُنفّذ controlled transaction test ويُختبر chain/token/recipient/amount/confirmations/replay protection مع تسجيل الدليل خارج المستودع.

## المرحلة 7 — قبول Staging

قبل أي Production rollout يجب نجاح migration verification، RLS/IDOR smoke، Auth provisioning، Google OAuth إن كان مطلوبًا، SMTP إن كان مطلوبًا، Storage private bucket وsigned URL isolation، frontend/backend health، SPA refresh، WebSocket، Docker/nginx، backup/restore drill، وmonitoring/alert smoke. يجب أن تنجح `npm run release:check` على commit ثابت، مع قرار مكتوب بشأن advisory React Router المتوسطة.

## ما أستطيع تنفيذه بعد توفير Staging

أستطيع قراءة مشروع Staging والتحقق من الإعدادات، تنفيذ SQL غير التدميري أو migrations بعد تأكيد صريح، تشغيل اختبارات RLS/Auth/Storage، اختبار Google وSMTP عبر جلسة Browser، مراجعة environment contracts، وتحديث التقارير. لا أنفذ Reset أو حذفًا أو نشرًا أو دفعًا حقيقيًا دون تأكيد مستقل لكل عملية.

## ما يجب أن يقدمه المالك

المطلوب هو إنشاء مشروع Staging منفصل، فتحه في Supabase Dashboard، وتأكيد project ref الجديد فقط. لا ترسل service-role key أو Client Secret أو SMTP password في المحادثة. بعد ذلك يمكن متابعة الإعدادات الخارجية على Staging دون لمس Production الحالي.
