# BİŞIŞ — Service → Template Automation Decision

**التاريخ:** 25 أغسطس 2026  
**النطاق:** Maximum Internal Completion Pass من `pasted_content_17.txt`

## القرار الحالي

لم تُضف `orders.service_id` في هذه الدفعة. القرار مبني على دليل العقد الحالي، وليس على عدم الرغبة في الأتمتة.

| المصدر | الدليل الفعلي | الأثر |
|---|---|---|
| `database/migrations/001_launch_contract.sql` | `services.id` هو `BIGINT`، و`orders` لا يحتوي `service_id` | يمكن إنشاء FK فقط إلى هوية رقمية canonical |
| `database/migrations/005_execution_engine.sql` | `project_templates.service_id BIGINT REFERENCES services(id)` | ربط template→service موجود فعليًا |
| `database/seeds/services.json` | مفاتيح الخدمات مثل `str-001` و`fin-001` نصية | لا تطابق `services.id` الرقمي في live contract |
| `database/seeds/packages.json` | `packages.services` مصفوفة مفاتيح نصية | لا توجد علاقة package→service FK |
| `frontend/src/pages/PaymentPage.tsx` | طلب الدفع يرسل `package_id` و`txid` فقط | لا تصل service identity canonical إلى order |
| `backend/src/api/routes/orders.routes.js` | order creation لا يستقبل أو يتحقق من service identity | لا يمكن بناء automatic match آمن الآن |

## ما تم تنفيذه بدلًا من migration غير مكتملة

أبقيت اختيار القالب اليدوي في Workbench، لأن الموظف يختار قالبًا canonical موجودًا فعلًا. أضيف كذلك initialization response contract يتضمن `initialization_status` وstable `idempotency_key`، مع idempotent return عند وجود `order.project_id`. هذا يجهز boundary للربط اللاحق دون تزوير payment success أو إنشاء مشروع من template غير معروف.

## ما يجب أن يحدث قبل `orders.service_id`

يجب أن يختار المؤسس مصدر الهوية canonical أولًا: إما تحويل catalog إلى numeric service IDs مرتبطة فعليًا بصفوف `services`، أو إضافة مفتاح خدمة نصي فريد رسمي إلى `services` مع علاقة واضحة، ثم تحديد هل كل package يختار خدمة واحدة أم يدعم مجموعة خدمات. بعد ذلك فقط يمكن إضافة FK additive، تحديث package/order/payment contracts، وإضافة template resolution وidempotency smoke.

## المحظور

لا يجوز مطابقة `orders.service` مع `services.name`، ولا تحويل `packages.services` النصية إلى أرقام بالترتيب أو بالتخمين، ولا تشغيل automatic initialization بعد payment قبل توفر provider حقيقي وcanonical service/template resolution.
