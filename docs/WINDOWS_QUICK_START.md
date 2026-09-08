# BİŞIŞ V1 — Windows Quick Start

افتح في VS Code المجلد الذي يحتوي مباشرة على `package.json` الرئيسي. لا تفتح `frontend` كمجلد المشروع الرئيسي عند استخدام أوامر root.

## التثبيت

من Terminal داخل جذر المشروع:

```cmd
npm run install:all
```

إذا ظهرت رسالة أن `package.json` غير موجود، فأنت داخل مجلد خاطئ. استخدم `cd` إلى المجلد الذي يحتوي على `package.json`.

## إعداد البيئة

لـbackend، انسخ `.env.example` إلى `.env` وضع قيم Supabase الخاصة بك محليًا فقط. للواجهة، انسخ `frontend\.env.example` إلى `frontend\.env` وضع public Supabase values و`VITE_API_URL` عند الحاجة. لا تنسخ service-role key إلى frontend ولا ترسلها في المحادثة.

## تشغيل الواجهة فقط

يمكنك النقر على `START_FRONTEND_WINDOWS.cmd`، أو تنفيذ:

```cmd
npm --prefix frontend run dev -- --host 127.0.0.1 --port 3000
```

ثم افتح `http://127.0.0.1:3000`.

## تشغيل backend

بعد إعداد root `.env`، افتح Terminal ثانية وانقر على `START_BACKEND_WINDOWS.cmd`، أو نفّذ:

```cmd
npm --prefix backend run dev
```

يمكن فحص health عبر:

```cmd
curl http://127.0.0.1:5000/api/health
```

إذا ظهر `DEGRADED` بسبب payment verifier، فهذا متوقع قبل إعداد الدفع الخارجي؛ لا يعني أن الدفع نجح أو أنه جاهز للإنتاج.

## ملاحظات مهمة

`database\legacy\schema.sql` و`archive\` ليسا مصادر تشغيل. استخدم الجذر canonical و`frontend\src` و`backend\src` و`database\migrations` فقط. Google OAuth وpayment verifier وDocker تحتاج إعدادات خارجية ولا تُفعّل بمجرد تشغيل الواجهة محليًا.
