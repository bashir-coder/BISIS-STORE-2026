# BİŞIŞ V1 — Project Structure

هذه هي بنية المشروع canonical. يجب فتح المجلد الذي يحتوي على `package.json` الرئيسي في VS Code، وليس `frontend` وحده عند تشغيل المشروع كاملًا.

```text
bisis-project/
├── package.json              # أوامر التشغيل الموحدة
├── package-lock.json
├── .env.example              # قالب backend؛ لا يحتوي أسرارًا
├── frontend/                 # React + Vite + TypeScript + Tailwind
│   ├── package.json
│   └── src/
├── backend/                  # Node.js + Express + Supabase service client
│   ├── package.json
│   ├── server.js
│   └── src/
├── database/
│   ├── migrations/           # مصدر عقد قاعدة البيانات V1
│   ├── seeds/                # بيانات V1 canonical
│   └── legacy/               # مرجع تاريخي غير مستخدم في runtime
├── infrastructure/           # Compose وnginx؛ لا يُشغّل من sandbox تلقائيًا
├── docs/                     # التقارير، checklist، runbooks، والأدلة
├── scripts/                  # مساحة scripts التشغيلية المشتركة
└── archive/                  # ملفات root القديمة المحفوظة خارج runtime
```

## الملفات التي يجب أن تبقى في الجذر

يحتوي الجذر فقط على ملفات التشغيل العامة: `package.json`، `package-lock.json`، القوالب والإعدادات العامة، و`README.md`. لا توضع مكونات React أو routes أو migrations مباشرة في الجذر.

## مصدر الحقيقة لكل طبقة

| الطبقة | المسار canonical |
|---|---|
| Frontend | `frontend/src/` |
| Backend | `backend/src/` و`backend/server.js` |
| Database migrations | `database/migrations/` |
| Seed data | `database/seeds/` و`backend/scripts/seed-data.js` |
| Deployment config | `infrastructure/docker-compose.yml` و`infrastructure/nginx.conf` |
| AI boundary | `backend/src/services/ai/ai.service.js` و`backend/src/api/routes/ai.routes.js` |
| Operational command center | `frontend/src/pages/AdminPanel.tsx` |
| Client 360 | `frontend/src/pages/Client360Page.tsx` عبر `GET /api/users` المحمي |
| Workbench | `frontend/src/pages/WorkbenchPage.tsx` فوق orders/projects/tickets الحالية |
| Project Workspace | `frontend/src/pages/ProjectWorkspacePage.tsx` عبر `/api/projects/:id` و`/api/projects/:id/orders` |
| Release docs | `docs/` |
| Historical material | غير داخل النسخة العامة أو runtime؛ مصدر الحقيقة هو المسارات الحالية أعلاه |

## الحدود التشغيلية الجديدة

يعرض `frontend/src/pages/AdminPanel.tsx` إشارات Command Center محسوبة من الطلبات والتذاكر والمشاريع التي يعيدها backend؛ لا توجد أرقام ثابتة أو إجراءات وهمية. يفتح Quick Actions منه إلى Workbench وClient 360، وتفتح بطاقات المشاريع Project Workspace. حد AI موجود في `backend/src/services/ai/ai.service.js`، وحالته الافتراضية `disabled` عبر `AI_PROVIDER=disabled`. مسار `/api/ai/status` محمي بالمصادقة، ولا يُعتبر AI فعليًا إلا عند إعداد مزود صالح واختباره.

## التشغيل في Windows

من جذر المشروع:

```cmd
npm run install:all
```

لتشغيل backend:

```cmd
npm run dev:backend
```

وفي Terminal ثانية لتشغيل frontend:

```cmd
npm run dev:frontend
```

إذا كانت نسخة Node أو scripts المحلية لا تدعم الأمر الموحد، يمكن تشغيل `npm install` داخل `backend` و`frontend` بشكل منفصل. لا تستخدم الملفات الموجودة داخل `archive` أو `database/legacy` لتشغيل V1.
