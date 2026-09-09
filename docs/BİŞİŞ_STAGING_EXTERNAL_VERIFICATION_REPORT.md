# BİŞIŞ V1 — Staging External Verification Report

**تاريخ التحقق:** 2026-08-27  
**بيئة التحقق:** Supabase Staging (المعرّف غير منشور في التقرير)  
**Production المحمي:** مشروع منفصل محمي — لم يُعدّل ولم تُحذف منه أي بيانات.

## القرار المختصر

أصبحت بيئة Staging قابلة للتحقق الفعلي من Authentication وRLS وعزل العملاء. نجح إنشاء Customer A وCustomer B عبر Supabase Auth، وأنشأ trigger ملف `public.users` تلقائيًا لكل منهما مع تطابق Auth ID وpublic.users ID ودور `client`. نجح اختبار RLS بجلسات عميل حقيقية باستخدام publishable key، وليس service-role.

هذه النتيجة لا تعني Production Ready. ما زالت إعدادات Google/SMTP/Storage وdomain/TLS وbackup/monitoring والدفع الحقيقي خارج نطاق ما تم تفعيله على Staging، وبعضها يحتاج مدخلات مالك أو قرارًا معماريًا.

## ما تم تنفيذه فعليًا على Staging

| المجال | النتيجة |
|---|---|
| Canonical database contract | تم تطبيق الجداول والقيود والعلاقات والدوال المطلوبة على Staging فقط |
| RLS | جميع الجداول الأساسية الـ31 عليها RLS مفعّل |
| Policies | سياسات عزل العميل وسياسات execution وقراءة packages/personas موجودة |
| Foreign keys | تحقق schema من 45 foreign key |
| Auth trigger | `on_auth_user_created` مفعّل على `auth.users` |
| Customer A | PASS — Auth ID تطابق profile، role `client` |
| Customer B | PASS — Auth ID تطابق profile، role `client` |
| RLS live smoke | PASS بجلسات email حقيقية وpublishable key |
| Fixtures cleanup | PASS — أُزيلت 2 orders و2 memberships و2 workspaces الاختبارية فقط |
| Storage | لا توجد buckets حاليًا؛ لم يُخترع bucket أو policy غير موجود في العقد |
| Performance indexes | أُضيفت migration additive لفهارس foreign keys التي أثبتها Advisor؛ اختفت تحذيرات `unindexed_foreign_keys` |

## دليل Auth وProvisioning

Customer A وCustomer B موجودان في Auth وفي `public.users`، مع تطابق البريد والهوية. القيم المؤكدة لكل منهما هي `role=client` و`auth_provider=email` و`is_active=true`. بقي `is_verified=false` لأن الحسابين أُنشئا للاختبار مع Auto confirm دون محاكاة رسالة بريد حقيقية.

لم تُحفظ كلمات مرور المستخدمين في المستودع أو التقرير أو ZIP. بقيت فقط في ملفات مؤقتة محمية داخل بيئة التنفيذ، ولا ينبغي استخدامها خارج اختبار Staging.

## دليل RLS/IDOR الحي

تم تسجيل الدخول بجلسة عميل A وجلسة عميل B عبر Supabase Auth باستخدام publishable key. Customer A رأى workspace وmembership وorder الخاصين به فقط، بينما Customer B رأى workspace وmembership وorder الخاصين به فقط. لم يرَ أي منهما صفوفًا من العميل الآخر، ولم يرَ أي منهما صفوف `public.users` أو conversations أو invoices أو notifications أو order_files غير المسموح بها.

بعد انتهاء الاختبار، أُزيلت fixtures المحددة والمعزولة. نتيجة التحقق بعد التنظيف كانت: `fixture_workspaces_remaining=0`، و`fixture_members_remaining=0`، و`fixture_orders_remaining=0`، مع بقاء `test_users_remaining=2`.

## التحذيرات المتبقية

| الأولوية | البند | الحالة والتفسير |
|---|---|---|
| P1 | Leaked password protection | Supabase Advisor ما زال يعرضه Disabled. يحتاج تفعيلًا من Auth/Attack Protection بعد التأكد من سياسة البريد، ولم أغيره تلقائيًا بسبب عدم استقرار جلسة لوحة التحكم. |
| P1 | SECURITY DEFINER helpers | Advisor يعرض أن دوال execution helper قابلة للتنفيذ من authenticated. هذا مقصود حاليًا لأن سياسات RLS تستدعيها، واختبار RLS الحي نجح. الحل الإنتاجي الأفضل يحتاج نقل helpers إلى private schema أو إعادة تصميم السياسات، وليس revoke عشوائيًا قد يكسر RLS. |
| P2 | RLS no-policy INFO | بعض جداول المحتوى مثل blog_posts وdigital_products وdonations وfaqs وportfolio وservices وsubscriptions وtranslations وusers عليها RLS بلا policies. هذا fail-closed، وليس تسريبًا؛ يلزم قرار واضح هل تُقرأ عبر Backend/service-role أو تحتاج public read policies. |
| P2 | RLS init-plan WARN | Advisor يقترح تغليف `auth.uid()` وauth helper calls داخل SELECT لتحسين الأداء عند التوسع. لم أغيّر السياسات لأن live isolation نجح ولأن التغيير يحتاج regression كاملًا. |
| P2 | Unused indexes | ظهرت تحذيرات INFO لأن Staging صغيرة وفارغة بعد cleanup؛ لا تعني أن الفهارس خاطئة. |
| P1 | Storage | لا توجد buckets. يلزم تحديد bucket names وmime/size policy وprivate/signed URL design قبل الإنشاء. |
| P0 خارجي | Google/SMTP/URL/Production | لم أغيّر إعدادات Google أو SMTP أو Production. تحتاج credentials/provider/domain وقرار المالك. |

## ما يحتاجه المالك لاحقًا

أولًا، يجب تحديد هل يريد BİŞIŞ استخدام Backend فقط لقراءة جداول المحتوى، أم يريد public read policies مباشرة. ثانيًا، يجب تحديد bucket names وأنواع الملفات وحدود الحجم وتدفق signed URLs. ثالثًا، يجب تفعيل leaked-password protection ومراجعة إعدادات SMTP وGoogle داخل Staging عند استقرار جلسة اللوحة، ثم اختبار callback وemail delivery فعليًا. رابعًا، قبل Production يجب توفير domain وTLS وbackup/restore وmonitoring وsecret manager وpayment provider حقيقي؛ لم يتم تفعيل أو محاكاة أي دفع حقيقي.

## حدود التحقق

لم يتم تعديل Production، ولم يتم تنفيذ reset أو migration تاريخية على Production، ولم تُرسل أي أسرار في المحادثة، ولم تُستخدم service-role لإثبات صلاحيات العميل. إعداد Auth/SMTP/Google لم يُعتبر ناجحًا إلا إذا ظهر من اختبار حقيقي، ولذلك بقيت هذه البنود معلّقة بدل ادعاء نجاحها.
