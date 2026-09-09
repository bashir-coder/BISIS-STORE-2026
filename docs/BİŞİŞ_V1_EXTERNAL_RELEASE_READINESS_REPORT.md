# BİŞIŞ V1 — External Release Readiness Report

> **Historical audit snapshot.** This report predates the current Staging advisor-index reconciliation and canonical migration 011. The current closure report and `docs/BİŞİŞ_V1_CANONICAL_MIGRATION_ORDER.md` are authoritative for the latest repository state.

**تاريخ التدقيق:** 25 أغسطس 2026  
**النطاق:** تدقيق read-only للمستودع وبيئة Supabase الاختبارية، استعدادًا للانتقال الآمن إلى Production.  
**الحكم النهائي:** **NO-GO — غير جاهز للإطلاق الخارجي حاليًا.**  
**النشر:** لم يتم أي نشر أو تغيير في Production.  
**التعديلات:** لم تُعدّل migrations التاريخية 001–007، ولم تُنفذ أي ALTER/DROP/CREATE أو إعداد Production.

## 1. Executive decision

BİŞIŞ V1 يملك أساسًا داخليًا قابلًا للتشغيل: اختبارات التطبيق السابقة والـbrowser E2E وRLS/IDOR smoke أثبتت مسارات Service Delivery، وعزل العملاء، وواجهات staff/client في بيئة اختبار منفصلة. لكن هذه الأدلة لا تساوي جاهزية Production؛ فهي تثبت صحة أجزاء من التطبيق ضد مشروع disposable، ولا تثبت وجود Production منفصل، أو مسار migrations قابل لإعادة الإنتاج، أو إعدادات TLS/backup/monitoring/payment/OAuth حقيقية.

القرار هو **NO-GO** إلى أن تُغلق على الأقل العناصر P0 التالية: اعتماد Production Supabase منفصل والتحقق من هويته، توحيد migration ledger وإثبات clean reproducibility، إزالة أو حماية الجدول العام غير المحمي `public.table_name`، حسم صلاحيات SECURITY DEFINER، توفير إدارة أسرار وTLS، تفعيل مسار دفع حقيقي fail-closed، واعتماد خطة backup/restore تشمل Storage. لا توجد حاجة لإضافة Features؛ المطلوب هو hardening وتشغيل وإدارة إصدار فقط.

> **قاعدة هذا التقرير:** كل حالة موسومة `PASS` تعني أن الدليل شُغّل أو قُرئ فعليًا. أما Production التي لم تُنشأ أو تُقدّم بياناتها فلا أعتبرها `PASS` بناءً على الكود أو وثائق الخطة.

## 2. Evidence boundary and environment identity

تم التحقق read-only من مشروع Supabase اختباري disposable مستقل. تفاصيل المشروع والمعرّف غير مضمنة في النسخة العامة. هذا ليس Production؛ لذلك لم أستخدمه كدليل على جاهزية Production.

استعلام metadata المباشر أثبت وجود جداول التطبيق الأساسية، مع RLS مفعّل على الجداول التشغيلية، لكنه أثبت أيضًا وجود `public.table_name` في schema العام مع `RLS=false` و`0` صفوف حسب metadata. كما أن الاستعلام المباشر عن `supabase_migrations.schema_migrations` أعاد `NULL`، وSupabase migration listing أعاد قائمة فارغة. هذا لا يثبت أن SQL المحلي غير صالح، لكنه يثبت أن migration ledger القابل للمراجعة وإعادة الإنتاج غير موجود في البيئة المفحوصة.

| مجال التحقق | النتيجة الفعلية | التصنيف | الدليل |
|---|---:|---|---|
| Supabase project health | `ACTIVE_HEALTHY` | معلومات فقط | نتيجة `get_project` المحفوظة |
| Production project identity | غير متاح/غير مُثبت | P0 | لا يوجد Production ref في هذه البيئة |
| Local migration CLI project | مفقود | P0 | لا يوجد مجلد `supabase/` |
| Live migration ledger | فارغ/غير موجود | P0 | `list_migrations=[]` و`to_regclass(...) = NULL` |
| Public RLS posture | `public.table_name` بلا RLS | P0 | SQL مباشر + security advisor |
| Storage bucket | `order-files` موجودة وprivate | PASS جزئي | SQL مباشر |
| Deployment provenance | غير قابل للتحقق | P1 | لا يوجد `.git` أو `.github/workflows` في checkout |

## 3. Exact blocker inventory

### P0 — blockers تمنع GO مباشرة

| ID | blocker مثبت | لماذا يمنع Production | Owner input/action المطلوب |
|---|---|---|---|
| P0-01 | لا يوجد Production Supabase project ref مُثبت؛ المشروع المفحوص disposable test | خطر توجيه التطبيق إلى البيئة الخطأ أو اعتبار test schema Production | إنشاء مشروع Supabase Production منفصل، تسجيل ref داخليًا، وإعطاء فريق النشر مسار وصول إداري آمن؛ عدم إرسال service-role key في المحادثة |
| P0-02 | migration ledger غير موجود، وREADME يذكر 001–004 بينما المستودع يحتوي 001–009 وملفًا auxiliary إضافيًا | لا يمكن إثبات أن Production الجديدة ستصل إلى نفس schema بترتيب deterministic | اعتماد canonical release bundle يضم 001–011 بالترتيب، وتحديد أن `005_execution_engine_policies.sql` ليس migration مستقلة، ثم إثبات `supabase db reset`/push في بيئة staging منفصلة |
| P0-03 | `public.table_name` جدول exposed بلا RLS، ومعه grants واسعة لـanon/authenticated | Supabase يعتبر الجدول العام بلا RLS قابلًا للقراءة/الكتابة لأي دور لديه grant؛ حتى لو كان فارغًا الآن، فهو fail-closed غير محقق | قرار صريح: حذف الجدول إن كان stray وغير مستخدم، أو إضافة RLS وسياسات/grants أقل صلاحية في migration جديدة؛ بعدها إعادة security advisors وRLS tests |
| P0-04 | SECURITY DEFINER functions الحساسة قابلة للتنفيذ من `anon` و`authenticated`: `verify_payment_and_order`، وhelpers الخاصة بالتنفيذ، وauth trigger | يوسّع سطح RPC العام، ويجعل payment/auth helper functions متاحة خارج الغرض المقصود | مراجعة DB security owner: revoke direct execute من `anon` خصوصًا payment/trigger، والإبقاء فقط على privilege اللازم لعمل RLS أو نقل helpers إلى schema غير exposed؛ لا تُسحب صلاحية `authenticated` عشوائيًا قبل اختبار policies التي تستدعيها |
| P0-05 | payment verifier غير مهيأ؛ `/api/health` يعيد `200` مع `status=DEGRADED` و`payment_verifier=missing` | لا يجوز فتح checkout أو استقبال طلبات في Production بلا تحقق chain حقيقي، كما أن orchestrator قد يعتبر الخدمة healthy رغم غياب الدفع | توفير Polygon mainnet RPC، عنوان USDC الصحيح، recipient EOA، confirmations، ثم تشغيل negative/positive verification بمعاملة حقيقية فقط؛ تعديل readiness semantics إن لزم حتى لا يُعتبر payment-missing healthy لمسار الدفع |
| P0-06 | لا يوجد TLS أو certificate أو HTTPS redirect في public nginx/Compose؛ الـedge يستمع على port 80 فقط | يعرّض sessions/bearer tokens والبيانات والرفع لخطر النقل غير المشفر، ويمنع security baseline مقبولًا | مالك البنية يوفّر domain/DNS، TLS termination مُدارًا أو reverse proxy موثوقًا، HTTPS redirect/HSTS، ثم اختبار websocket/API/SPA من hostname الحقيقي |
| P0-07 | لا توجد خطة backup/restore مُثبتة، وSupabase database backups لا تشمل Storage objects | فقدان DB أو الملفات لا يمكن التعامل معه بخطة واحدة؛ restore لقاعدة البيانات لا يعيد ملفات `order-files` المحذوفة | اختيار خطة Supabase المناسبة وretention/PITR أو off-site logical dumps، إضافة backup مستقل لـStorage، وتنفيذ restore drill إلى مشروع منفصل قبل GO |
| P0-08 | secret management Production غير مثبت؛ التطبيق يعتمد على service-role key، وملف `.env` المحلي mode `644` | service-role key هو مفتاح تجاوز RLS؛ تسريبه أو توزيعه كملف مقروء عالميًا incident فوري | اختيار secret manager/host secrets، صلاحيات least privilege، تدوير أي مفاتيح test قديمة، وعدم وضع أسرار في image أو Git/CI logs؛ التحقق أن frontend لا يحتوي إلا public anon key |

### P1 — يجب إغلاقها قبل الإطلاق أو قبولها رسميًا بقرار مكتوب

| ID | الملاحظة | الأثر | المطلوب |
|---|---|---|---|
| P1-01 | security advisors تحذر من RLS-enabled/no-policy في `blog_posts`, `digital_products`, `donations`, `faqs`, `portfolio`, `subscriptions` | قد تكون هذه الجداول مقصودة backend-only، لكن grants العامة الواسعة تجعل intent غير موثق | تحديد كل جدول: public read، backend-only، أو حذف/تجميد؛ تطبيق grants/policies least privilege واختبارات لكل عملية |
| P1-02 | grants `anon` و`authenticated` واسعة على الجداول الأساسية، بما فيها INSERT/UPDATE/DELETE، مع الاعتماد على RLS فقط | policies الحالية تمنع المسارات المثبتة في smoke، لكن defense-in-depth أقل من المطلوب | إضافة grants صريحة أقل صلاحية في migration hardening، مع عدم كسر service-role backend أو RLS helper functions |
| P1-03 | `update_updated_at_column` و`get_services_by_persona` لديهما mutable `search_path` | خطر search-path hijacking في SECURITY DEFINER أو future schema changes | تثبيت `search_path` صراحةً في migration hardening، ثم إعادة advisors |
| P1-04 | leaked-password protection في Supabase Auth معطّل | كلمات مرور مخترقة قد تُقبل | تفعيل leaked-password protection، وضبط password policy وcaptcha/rate limits وفق مستوى الحساب |
| P1-05 | لا توجد Git metadata أو GitHub Actions أو CI release workflow في checkout | لا يوجد proof واضح للcommit/artifact أو gate يمنع deploy غير مختبر | ربط المستودع Git موثوقًا، إنشاء CI على الأقل لـclean install/check/audit/migration validation، وحماية main/release approvals |
| P1-06 | frontend `npm audit --omit=dev` يعيد advisoryين moderate في `react-router` و`react-router-dom`، والـfix المقترح `7.18.2` major upgrade | open redirect عبر backslash وSSR hydration advisory؛ تأثير SSR قد لا ينطبق على Vite SPA، لكن dependency غير clean | owner/developer يراجع upgrade major أو يثبت patched compatible path، ثم يعيد build/browser regression ويغلق audit |
| P1-07 | لا توجد metrics/alerts أو external log sink؛ Winston يكتب console وملفات، وبعض logs تتضمن email وstack traces | صعوبة اكتشاف outage/security incident، واحتمال PII retention غير مضبوط | تحديد log sink/retention/redaction، error-rate/latency/5xx/429/storage/payment alerts، وrunbook incident |
| P1-08 | `/api/health` يفحص وجود env فقط ولا يجري DB readiness query؛ `DEGRADED` يرجع HTTP 200 | load balancer قد يرسل traffic إلى instance غير قادر على DB/payment | فصل liveness عن readiness، وجعل readiness تفشل عندما تكون dependency حرجة غير مهيأة، أو توثيق أن payment خارج readiness لمسار public منفصل |
| P1-09 | rate limiting موجود: global 100/15min وlogin 10/15min، لكن لا توجد طبقة edge/WAF أو distributed limiter موثقة | limits في memory لا تتوسع بأمان عبر عدة instances، وقد تتأثر بعناوين proxy | قرار hosting/edge، ضبط trusted proxy بعناية، وإضافة distributed/edge throttling عند التوسع |
| P1-10 | bucket `order-files` private وbackend يفرض 10MB/MIME، لكن bucket-level file limit وallowed MIME غير مضبوطين، ولا توجد custom storage policies | الحماية الحالية تعتمد على route/service-role فقط؛ backup/retention/ownership غير مثبتة على مستوى المنصة | تأكيد route-only access، ضبط limits دفاعية متوافقة، اختبار signed URL expiry، وتوثيق object backup مستقل |
| P1-11 | CORS يملك fallback إلى localhost و`https://BİŞİŞ.com` إذا غاب `ALLOWED_ORIGINS`، وorigin غير المسموح أعاد HTTP 500 محليًا | misconfiguration قد تفتح origin غير مقصود أو تنتج error semantics غير واضحة | إلزام `ALLOWED_ORIGINS` في Production بلا fallback، اختبار hostname النهائي، وإرجاع status مناسب للرفض دون كشف تفاصيل |
| P1-12 | لا يوجد تحقق Docker/nginx فعلي في هذا sandbox لأن CLIs مفقودة | syntax/build/runtime للصور والـedge غير مثبت | تشغيل `docker compose config`, image build, `nginx -t`, healthcheck وTLS smoke على CI/host النشر |

### P2 — تحسينات تشغيلية بعد إغلاق P0/P1

تتضمن هذه الفئة توحيد `backend/.env.example` المفقود، تقليل chunk الكبير في frontend إن أثبت القياس فائدة، إضافة frontend unit/component tests بدل رسالة “No frontend tests configured”، وتحسين رسائل CORS وPII logging. لا ينبغي لهذه البنود أن تُستخدم لتأجيل hardening P0 أو لإضافة Features إلى V1.

## 4. Exact production environment contract

القيم أدناه هي **أسماء ومتطلبات** وليست أسرارًا. القيم الحقيقية يجب أن تُحقن من secret manager أو إعدادات hosting، لا أن تُرسل في التقرير أو تُحفظ في image.

### Backend runtime

| Variable | Required | Production requirement | Source/evidence |
|---|---:|---|---|
| `NODE_ENV` | نعم | `production` | root `.env.example`, Compose |
| `PORT` | نعم | internal backend port، عادة `5000` | `backend/server.js`, Compose |
| `SUPABASE_URL` | نعم | URL لمشروع Supabase Production فقط | `backend/src/config/supabase.config.js` |
| `SUPABASE_SERVICE_ROLE_KEY` | نعم | server-only secret؛ لا frontend ولا image layer ولا logs | Supabase config + backend routes |
| `ALLOWED_ORIGINS` | نعم | comma-separated exact HTTPS origins؛ بلا localhost/default fallback | `backend/server.js`, Compose |
| `WEB3_NETWORK` | نعم لتفعيل الطلبات | يجب أن يكون `polygon` | `payment-verifier.js` |
| `WEB3_RPC_URL` | نعم لتفعيل الدفع | Polygon mainnet RPC موثوق مع quota/monitoring | `payment-verifier.js` |
| `USDC_CONTRACT_ADDRESS` | نعم لتفعيل الدفع | عنوان USDC الصحيح على Polygon mainnet | `payment-verifier.js` |
| `WEB3_RECIPIENT_ADDRESS` | نعم لتفعيل الدفع | recipient EOA مضبوط ومراجع ثنائيًا | `payment-verifier.js`, Compose |
| `WEB3_REQUIRED_CONFIRMATIONS` | نعم لتفعيل الدفع | قيمة تشغيلية معتمدة، default الحالي `12` | `payment-verifier.js` |
| `AI_PROVIDER` | نعم كقرار صريح | `disabled` في V1 ما لم يعتمد المالك provider حقيقيًا | `.env.example` |
| `OPENAI_MODEL` | مشروط | فقط إذا فُعّل AI؛ لا يلزم لمسار V1 الحالي | `.env.example`, source scan |
| `OPENAI_API_KEY` | مشروط | secret manager فقط؛ لا تستخدمه إذا AI disabled | `.env.example` |
| `RECAPTCHA_SECRET_KEY` | مشروط | مطلوب فقط إن فُعّل CAPTCHA فعليًا | `.env.example` |
| `EMAIL_HOST`, `EMAIL_PORT`, `EMAIL_USER`, `EMAIL_PASS` | مشروطة | SMTP/transactional email حقيقي إذا كانت رسائل الإنتاج مطلوبة | `.env.example`, runbook |
| `LOG_LEVEL` | موصى به | مستوى logging مع redaction وretention معروفين | `.env.example`, logger |
| `FRONTEND_URL` | موصى به/حسب integration | hostname النهائي؛ لا تعتمد على localhost default في Production | `.env.example` |

### Frontend build contract

| Variable | Required | Rule |
|---|---:|---|
| `VITE_SUPABASE_URL` | نعم | Production Supabase URL فقط |
| `VITE_SUPABASE_ANON_KEY` | نعم | publishable/anon key فقط؛ لا service-role |
| `VITE_API_URL` | موصى به | empty same-origin خلف nginx، أو HTTPS API origin صريح |
| `VITE_ENABLE_GOOGLE_OAUTH` | مشروط | `true` فقط بعد اكتمال Supabase + Google Cloud setup |
| `VITE_GOOGLE_CLIENT_ID` | مشروط | Google OAuth client ID public، وليس client secret |

الـfrontend يستخدم Supabase Auth session في browser storage ويضع access token في `Authorization: Bearer` لطلبات API، وليس cookie session server-managed [6]. لذلك يلزم HTTPS في كل hostname، وضبط CSP وredirect origins، ولا يوجد اعتماد على CSRF cookie protection يمكن افتراضه تلقائيًا.

### Variables موجودة محليًا لكنها ليست عقد V1 موثقة

الملف المحلي يحتوي أسماء إضافية مثل `CLAUDE_API_KEY`, `DEEPSEEK_API_KEY`, `GOOGLE_CLIENT_SECRET`, `JWT_SECRET`, `OPENROUTER_API_KEY`, `REDIS_URL`, `RESEND_API_KEY`, `SOLANA_WALLET_ADDRESS`, و`TELEGRAM_CHAT_ID`، لكن scan المصدر لم يجد استعمالًا runtime موثوقًا لمعظمها. يجب عدم نقلها إلى Production لمجرد وجودها في `.env`; إما حذفها من secret store أو توثيق owner/consumer واضح لكل متغير.

## 5. Area-by-area readiness assessment

### Database, migrations, RLS, and API authorization

الحالة الداخلية قوية نسبيًا لمسارات Service Delivery: تم سابقًا إثبات عزل client A/B، project ownership canonical عبر `projects.id -> orders.project_id -> orders.user_id`, وstaff/client workflow مع 54-check live smoke. لكن advisory الحالي يكشف gap إنتاجي مستقل: `public.table_name` بلا RLS، grants عامة واسعة، وdirect EXECUTE على SECURITY DEFINER functions. السياسات التي تستخدم execution helpers تحتاج privilege مدروسًا؛ لذلك لا يصح تطبيق revoke شامل بالنسخ واللصق دون تكرار RLS/IDOR suite.

في وقت هذا التدقيق كانت الـmigration chain المحلية 001–009، مع `005_execution_engine_policies.sql` auxiliary فقط، لكن README كان يوثق 001–004. أصبحت السلسلة الحالية الموثقة 001–011؛ راجع canonical order الحالي بدل هذا snapshot. لا توجد `supabase/` CLI project أو migration ledger في المشروع المفحوص. النتيجة هي **schema drift/reproducibility blocker** وليس دليلًا على أن كل SQL فاشل. المطلوب هو canonical packaging واختبار fresh database قبل أي Production push [1] [13].

### Auth, sessions, JWT, CORS, and cookies

الـbackend يتحقق من Supabase JWT عبر `supabase.auth.getUser(token)`، ثم يطابق/ينشئ profile، ويطبّق role authorization من `public.users`. هذا المسار اجتاز internal auth/browser smoke، لكن Production يتطلب Supabase Auth settings فعلية: email confirmation/SMTP، password policy، leaked-password protection، rate limits، captcha عند الحاجة، site URL وredirect allow-list، وGoogle provider configuration. security advisor أثبت أن leaked-password protection معطّل حاليًا.

CORS يتطلب `ALLOWED_ORIGINS` في Compose، لكن `server.js` يملك fallback يتضمن localhost و`https://BİŞİŞ.com`. في Production يجب أن يكون allow-list صريحًا ومطابقًا للـdomain النهائي. الجلسات ليست server cookies؛ هي Supabase browser session وBearer API token، لذلك HTTPS وtoken exposure controls غير اختياريين.

### Storage

البنية الحالية أفضل من public bucket: `order-files` private، والbackend route يفرض upload authorization، MIME allow-list، 10MB memory upload، وsigned URL مدته 60 ثانية للتنزيل. كما أن internal files تمنع عن العملاء. هذا يُصنّف **PASS جزئيًا**، وليس release proof كاملًا، لأن custom storage policies غير موجودة وbucket-level limits غير مهيأة، ولأن object backup مستقل غير مثبت. توثيق Supabase يوضح أن database backups لا تشمل Storage objects [11].

### Rate limiting, error handling, and logging

يوجد global limiter 100 طلب/15 دقيقة وlogin limiter 10/15 دقيقة. يوجد request ID، Helmet، compression، وgeneric 500 responses. لكن limits في memory فقط، ولا توجد edge/WAF أو distributed limiter/monitoring موثقة. Winston يكتب console، ويكتب ملفات في production، بينما runtime logs تتضمن email في socket messages وبعض stack traces. قبل Production يجب تحديد redaction، retention، sink، alerts، وtrusted proxy behavior.

### Health/readiness and observability

`/api/health` الحالي لا يثبت اتصال database؛ يثبت فقط وجود `SUPABASE_URL` و`SUPABASE_SERVICE_ROLE_KEY`. كما أنه يعيد HTTP 200 عند `DEGRADED` إذا كان payment verifier مفقودًا. الاختبار المحلي الفعلي أعاد:

```text
status=DEGRADED
 database=configured
 critical_configuration.payment_verifier=missing
 HTTP=200
 environment=development
```

هذا مناسب كإشارة development، لكنه غير كافٍ كـProduction readiness probe. يجب فصل liveness عن readiness، وإضافة dependency check حقيقي مع timeout، وتحديد هل غياب payment يمنع كل الخدمة أو checkout فقط. كذلك يجب ربط logs/metrics/alerts بمنصة تشغيل فعلية قبل GO.

### Docker, nginx, and deployment

Compose يبني frontend وbackend ويضع nginx على port 80، بينما backend healthcheck يعد HTTP 200 صحيًا. لا توجد TLS certificates أو secret manager أو monitoring أو external network في الملفات الحالية. `nginx.conf` يملك SPA fallback وSocket.IO upgrade headers، لكنه HTTP-only ولا يضع public TLS/rate-limit/security-header boundary. لم يمكن تشغيل `docker`, `nginx`, أو `supabase` CLI في هذا sandbox، ولذلك لم أعتبر image/edge syntax أو deployment runtime PASS.

### Backup, restore, and rollback

Supabase توضح أن daily backups متاحة حسب الخطة، وأن PITR add-on يعطي recovery points أدق، وأن database backup لا يشمل Storage objects [11]. لذلك عقد BİŞIŞ يجب أن يتكون من DB backup/PITR، logical dump/off-site copy عند الحاجة، backup مستقل لـStorage، retention/RPO/RTO مكتوبين، وrestore drill إلى مشروع جديد. لا يجوز اعتبار وجود bucket private أو وجود migrations بديلًا عن restore test.

### Google OAuth prerequisites

الكود يعطّل Google UI ما لم يكن `VITE_ENABLE_GOOGLE_OAUTH=true` و`VITE_GOOGLE_CLIENT_ID` موجودًا، بينما `AuthContext` يستخدم Supabase `signInWithOAuth({ provider: 'google' })`. قبل التفعيل يحتاج المالك إلى Google Cloud OAuth client، authorized JavaScript origins، redirect URI الصحيح الخاص بـSupabase Auth، تفعيل Google provider في Supabase، site URL/redirect allow-list، وإعادة build frontend بالقيم العامة فقط. لم يتم ادعاء OAuth success ولم يتم استخدام provider credentials في هذا التدقيق.

### Payment-provider prerequisites

مسار الدفع مصمم fail-closed ويقبل Polygon mainnet فقط، ويتحقق من chain ID، transaction receipt، token contract، recipient topic، exact USDC amount، confirmations، ثم يستدعي atomic `verify_payment_and_order` [7] [8]. ما ينقص Production هو القيم الحقيقية والـRPC reliability والـrecipient approval والـrunbook للتعامل مع RPC outage/reorg/ambiguous transfer. لا يجوز إغلاق هذا البند بـfake transaction أو mock provider success.

## 6. Verification executed in this audit

| Command/check | Result | Notes |
|---|---|---|
| `npm run check` | PASS | backend syntax/Jest، frontend lint/typecheck، Vite build؛ التحذير المتوقع: chunks أكبر من 500KB |
| `npm --prefix frontend test` | PASS process | لا توجد frontend tests فعلية؛ الأمر يطبع أن backend suite هو API gate |
| `npm --prefix backend audit --omit=dev` | PASS | 0 vulnerabilities |
| `npm --prefix frontend audit --omit=dev` | FAIL gate | 2 moderate: `react-router`, `react-router-dom`; fix المقترح major `7.18.2` |
| Local `/api/health` | HTTP 200 / DEGRADED | database env configured، payment verifier missing؛ development only |
| Local CORS probe | جزئي | localhost وBİŞİŞ.com مسموحان محليًا؛ origin غير مسموح أعاد 500 |
| Supabase public table/RLS SQL | FAIL security gate | `public.table_name` موجود وRLS disabled؛ بقية جداول التطبيق الظاهرة RLS enabled |
| Supabase storage buckets SQL | PASS جزئي | `order-files` private، limits bucket-level null |
| Supabase storage policy SQL | PASS جزئي | `storage.objects` RLS enabled، custom policies result empty؛ backend service-role path هو المسار الحالي |
| Supabase function ACL SQL | FAIL security hardening gate | functions الحساسة SECURITY DEFINER وقابلة للتنفيذ من anon/authenticated |
| Supabase migration ledger | NOT VERIFIED/FAIL reproducibility gate | `list_migrations=[]` و`to_regclass= NULL` |
| Docker/nginx/Supabase CLI availability | NOT TESTED هنا | CLIs مفقودة في sandbox؛ يجب تشغيلها على CI/host النشر |

الأدلة المنقحة محفوظة داخليًا خارج شجرة المستودع تحت `/home/ubuntu/BİŞİŞ-internal-archive-2026-08-27/docs/evidence/`. لا يتضمن التقرير أي secret أو UUID/email/password/token.

## 7. Owner-input checklist before GO

| Owner | Required input/decision | Acceptance evidence |
|---|---|---|
| Founder/Product | تأكيد أن V1 يبقى كما هو: services, auth, orders, Service Delivery, staff/client workflows؛ لا Features جديدة | قرار مكتوب يثبت عدم توسيع scope |
| Supabase owner | Production project ref منفصل، plan، region، Auth site URL، redirect allow-list، SMTP/password/captcha settings | read-only metadata + dashboard config record |
| Database owner | قرار `public.table_name`، canonical 001–009 chain، hardening migration للصلاحيات/search_path/grants | fresh reset/push + schema/advisor/RLS tests |
| Security owner | secret manager، key rotation، service-role handling، CSP/HSTS/TLS policy، log redaction | secret scan، TLS scan، policy review |
| Payments owner | Polygon RPC، USDC contract، recipient address، confirmations، outage/reorg runbook | real controlled verification evidence، لا mock success |
| Infrastructure owner | domain/DNS، TLS edge، container registry/host، Docker/nginx validation، backups/monitoring | compose config/build، `nginx -t`، health/readiness smoke |
| Auth owner | Google Cloud OAuth client and Supabase provider setup إن كان Google مطلوبًا في V1 | redirect/login test على staging، لا credentials في repo |
| Operations owner | RPO/RTO، DB+Storage backup retention، restore drill، alert routing، incident contacts | restore report + alert test |
| Release owner | Git repository/branch protection، immutable artifact digest، CI approvals، rollback owner | CI run linked to release commit |

## 8. Required deployment sequence — preparation only

1. أنشئ Production Supabase منفصلًا، واكتب ref والـregion والـplan في سجل آمن. لا تعِد استخدام مشروع الاختبار.
2. ثبّت release commit في Git، وشغّل clean install من lockfiles، ثم `npm run check` وdependency audit وsecret scan. ارفع artifacts immutable إلى registry/hosting.
3. جهّز secret manager بالقيم backend السرية، والقيم العامة frontend عبر build environment فقط. اضبط `ALLOWED_ORIGINS` و`NODE_ENV=production` بلا fallback development.
4. أنشئ/اختبر staging mirror أو مشروعًا فارغًا، وطبّق canonical migrations 001–011 بالترتيب. لا تشغّل `005_execution_engine_policies.sql` كنسخة ثانية. افحص tables/FKs/indexes/RLS/policies/functions/triggers/advisors.
5. نفّذ hardening المعتمد لـ`public.table_name`، grants، SECURITY DEFINER، search_path، Auth password protection، وStorage limits/policies. أعد RLS/IDOR tests بعد كل SQL change.
6. فعّل Supabase Auth settings وSMTP وGoogle OAuth فقط إذا قرر المالك ذلك. اختبر redirect/site URL على staging، لا على Production أولًا.
7. جهّز private `order-files`، signed URL expiry، object backup، database backup/PITR، وrestore drill مستقلًا.
8. شغّل Docker/Compose validation وnginx syntax وTLS edge، ثم deploy backend/frontend خلف HTTPS. يجب أن تملك الخدمة liveness/readiness واضحين قبل استقبال traffic.
9. نفّذ staging acceptance: signup/login، role denial، client A/B isolation، staff workspace، requirements/delivery/revision/approval، upload/download، notifications، Socket.IO، health/readiness، 429/5xx alerts.
10. نفّذ Production canary محدودًا بعد موافقة release owner، راقب 5xx/latency/auth/payment/storage لمدة محددة، ثم افتح traffic تدريجيًا. لا تعتبر payment PASS إلا بمعاملة حقيقية صحيحة، ولا تعتبر OAuth PASS إلا بتدفق provider حقيقي.

## 9. Rollback sequence

الـrollback يجب أن يكون **roll-forward للـdatabase** وليس تشغيل migrations عكسية عشوائية. عند فشل الإصدار: أوقف traffic أو فعّل maintenance، ثبّت incident timeline، وأعد backend/frontend إلى image/artifact السابق immutable digest. إذا كان schema الجديد backward-compatible، اترك migration ولا تحذف البيانات؛ إذا كانت المشكلة data integrity، اعزل Production وطبّق restore إلى مشروع جديد أو PITR وفق runbook، ثم تحقّق من Storage objects separately لأن database restore لا يعيدها [11].

إذا كان السبب secret compromise، ألغِ/دوّر المفتاح فورًا، حدّث secret manager، أعد تشغيل instances، وأعد فحص Git/image/logs. بعد recovery نفّذ smoke كاملًا، راقب error budget، ولا تبدّل DNS أو traffic إلى النسخة المستعادة قبل موافقة incident owner. كل rollback يحتاج owner محددًا، نقطة قرار، RTO، وسجلًا غير قابل للتعديل.

## 10. Final recommendation

**Final recommendation: NO-GO.** التطبيق ليس بحاجة إلى ميزات جديدة، لكنه يحتاج release controls وأمنًا وتشغيلًا خارجية قبل الانتقال. أهم خطوة ليست نشر الصورة الحالية؛ بل بناء **Production Release Gate** صغير ومثبت: canonical migrations + clean reset، hardening للـRLS/grants/functions، Production Supabase منفصل، secrets/TLS، payment credentials الحقيقية، backup/restore بما فيه Storage، CI/artifact provenance، readiness/monitoring، ثم staging acceptance.

بعد إغلاق P0 وإعادة تشغيل الاختبارات ذات الصلة، يمكن إعادة هذا التقرير. إذا نجحت gates ولم تبقَ إلا P2، يصبح القرار المقترح **CONDITIONAL GO** عبر canary محدود، وليس إطلاقًا كاملًا مباشرًا.

## References

[1]: [BİŞIŞ README — التشغيل والعقد الحالي](../README.md)  
[2]: [Docker Compose](../infrastructure/docker-compose.yml)  
[3]: [Public nginx configuration](../infrastructure/nginx.conf)  
[4]: [Backend bootstrap, CORS, rate limits, health, Socket.IO](../backend/server.js)  
[5]: [Auth middleware and Supabase JWT verification](../backend/src/api/middleware/auth.middleware.js)  
[6]: [Frontend AuthContext and browser session flow](../frontend/src/contexts/AuthContext.tsx)  
[7]: [Payment verifier](../backend/src/services/payment-verifier.js)  
[8]: [Migration 001 launch contract](../database/migrations/001_launch_contract.sql)  
[9]: [Migration 005 execution engine](../database/migrations/005_execution_engine.sql) and [migration 007 client isolation hotfix](../database/migrations/007_execution_client_isolation_hotfix.sql)  
[10]: [Supabase Row Level Security documentation](https://supabase.com/docs/guides/database/postgres/row-level-security)  
[11]: [Supabase Database Backups documentation](https://supabase.com/docs/guides/platform/backups)  
[12]: [Supabase secure product configuration](https://supabase.com/docs/guides/security/product-security)  
[13]: [Supabase environments and migration workflow guidance](https://supabase.com/blog/the-vibe-coders-guide-to-supabase-environments)  
[14]: [React Router security advisories](https://github.com/advisories/GHSA-wrjc-x8rr-h8h6)  
