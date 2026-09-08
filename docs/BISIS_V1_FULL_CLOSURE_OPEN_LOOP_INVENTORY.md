# BİŞIŞ V1 — Full Closure Open-Loop Inventory

> هذا الجرد مبني على `pasted_content_17.txt` و`pasted_content_16.txt`، والكود الحالي، migrations 001–009، تقارير التدقيق، ونتائج smoke الحية. لا يعتمد على وجود route أو build فقط كدليل إغلاق.

## Executive Inventory

| المؤشر | العدد الحالي |
|---|---:|
| إجمالي النقاط الصفّية القابلة للتتبع | 21 |
| READY / PASS | 11 |
| PARTIAL / IMPROVED | 7 |
| NOT TESTED | 0 |
| EXTERNAL BLOCKER | 2 |
| OUT OF V1 | 1 |
| KNOWN DEBT مستقل | 0 |

## البنود الجاهزة أو المثبتة

| Item | Classification | Evidence |
|---|---|---|
| Execution template list/create/apply الأساسي | READY / PASS | `execution.routes.js` وlive smoke؛ التطبيق المتكرر يحافظ على `409 PROJECT_STRUCTURE_EXISTS` |
| Service Delivery lifecycle الأساسي | READY / PASS | migration 006، routes service-delivery، live smoke |
| Requirements ownership وكتابات العميل | READY / PASS | direct JWT smoke: own read PASS، cross-user 0 rows، unauthorized writes rejected |
| Delivery/approval/revision/re-delivery | READY / PASS | live smoke يثبت دورة التسليم والمراجعة وإعادة التسليم |
| Execution client isolation hotfix | READY / PASS | migration 007، direct JWT RLS matrix، سياسات projects النهائية |
| Notifications project context وmark-all-read | READY / PASS | `orders.routes.js` وlive smoke `updated=3` |

## البنود غير المكتملة

| Item | Current state | Why incomplete | Dependencies | Backend | Database | Frontend | Security impact | User impact | Required verification | Can close in mission? |
|---|---|---|---|---|---|---|---|---|---|---|
| Admin template management | READY / PASS | endpoints وUI يدعمان list/create/edit/archive/restore/duplicate وإدارة milestones/tasks مع validation وloading/error/empty؛ reorder drag-and-drop غير منفذ لغياب atomic reorder contract | schema 005 canonical، لا migration جديدة | CRUD staff-only واختبارات client denial وinvalid input | `AdminTemplateManager` داخل Command Center | staff-only مثبت | الإدارة لم تعد تحتاج DB manual work | admin CRUD، client denial، invalid input، live cleanup | أُغلق ضمن نطاقه الأساسي |
| Service → Template assignment | PARTIAL | `project_templates.service_id` وإدارة association موجودان، لكن `orders` لا يحمل `service_id` canonical، و`packages.services` مفاتيح نصية لا تطابق `services.id` BIGINT | يلزم توحيد catalog وإقرار order→service FK | templates يمكن ربطها بخدمة يدويًا؛ لا automatic match | FK template→service موجود؛ لا order service FK | Workbench يختار template يدويًا | خطر mapping نصي أو قالب خاطئ | explicit template selection؛ لا matching نصي | لا، حتى يصدر قرار schema canonical |
| Automatic project initialization trigger | PARTIAL / IMPROVED | Workbench initialization موجود، وresponse يعلن `initialization_status` وstable `idempotency_key`؛ لا يوجد auto trigger بعد payment | verifier الحقيقي وservice/template canonical غير متاحين | boundary موجود، لا fake payment | لا trigger DB جديد | لا auto state | fail-closed ومحمي من duplicate initialization | خطوة staff واضحة لكن ليست تلقائية | verified order → project exactly once عند توفر canonical inputs | بقي جزئيًا خارج ما يمكن حسمه بأمان |
| Client project journey consolidation | PARTIAL | ClientDeliveryHome موجود، لكن Dashboard/Portal يحويان legacy order-centric sections | إزالة التكرار تحتاج UX review | APIs موجودة | لا أثر DB | صفحات مختلطة | خطر لا يوجد إذا بقيت visibility boundaries | تجربة مزدوجة وغير متسقة | browser journey | جزئيًا |
| Project-aware support tickets | READY / PASS | migration 008 أضافت `project_id`، و009 أزالت policies legacy الواسعة بعد قراءة تعريفاتها؛ API وContact BİŞIŞ يطبقان ownership/workspace scope | FK إلى projects مع SET NULL وفهرس | create/list/update/filter project-aware | migrations 008/009 additive/corrective | Project Workspace يحتوي Contact BİŞIŞ | cross-project والـworkspace isolation مثبتان | العميل يربط الدعم بمشروعه | direct RLS + API IDOR + external workspace smoke | أُغلق ضمن العقد الحالي |
| Client 360 detail | PARTIAL / IMPROVED | endpoint batched يعرض projects وrequirements وexecution وdelivery/revisions وfiles/activity metadata وtickets؛ لا يزال drill-down الكامل داخل البطاقة غير موجود | لا migration جديدة | staff-only overview مع workspace/client checks | لا أثر DB مطلوب | Client360 UI مع loading/error/race protection | unrelated projects مستبعدة | رؤية تشغيلية أفضل دون N+1 لكل مشروع | workspace boundary + live overview smoke | تحسن كبير؛ drill-down اختياري لاحقًا |
| Command Center operations | PARTIAL | queue حقيقية أضيفت، لكن يلزم التأكد من كل buckets والتنقلات | canonical queue/state definitions | queue موجود | no new DB | exceptions/queue partial | staff-only | رؤية operational غير مكتملة | each bucket navigates correctly | نعم جزئيًا |
| Notification flows | PARTIAL / IMPROVED | individual/all read وproject click-through وgrouping داخل Dashboard؛ لا يزال لا يوجد center مستقل شامل لكل execution transitions | notification event audit | recipient ownership وread-all مثبتان | no new DB | Dashboard grouping + project navigation | recipient scope مثبت | التجربة أكثر تنظيمًا | lifecycle event matrix + browser UX | grouping أُغلق داخل panel، المركز المستقل مؤجل |
| Permanent RLS regression packaging | READY / PASS | smoke قابل لإعادة التشغيل ويغطي 54 check مع fixtures معزولة وتنظيف ناجح؛ ما يزال تشغيله في CI production setup منفصلًا | disposable fixture policy داخل script | direct JWT verified live | no schema impact | none | core boundaries مثبتة | confidence عملي عالي ضمن test env | run script + cleanup | أُغلق كحزمة test harness، CI integration يبقى خارج V1 |
| Authenticated browser E2E | READY / PASS | Staff + Client A + Client B populated workflow مرّ عبر Chromium الحقيقي؛ 28/28 checks وcleanup نظيف | disposable browser identities داخل test env | actual UI workflow passed | DB/RLS evidence منفصل في live smoke | Command Center/Client360/Project Workspace/template admin/client requirement-delivery journey | cross-client denial وexternal-workspace denial مثبتان | رحلة تشغيل فعلية مثبتة ضمن scope | redacted role result + screenshots | أُغلق ضمن السيناريوهات الموثقة؛ لا يعني كل route |
| Mobile / RTL QA | READY / PASS (scoped) | public home نجح 9/9 عبر 390×844 و1024×900 و1280×941 وar/en/tr؛ authenticated empty-order client نجح mobile/tablet/desktop Arabic؛ populated workflow موثق desktop RTL فقط | real Chromium CDP | n/a | n/a | public matrix + authenticated scopes | no measured overflow in tested cases | browser evidence available | redacted responsive result + visual findings | أُغلق للنطاق الموثق؛ ليس full authenticated all-route/language matrix |
| Performance / bundle hardening | PARTIAL / IMPROVED | final measurement محفوظ: 38 assets، 1,994,642 raw و599,844 gzip؛ entry 784,439 raw/234,080 gzip؛ manualChunks وPDF split جُرّبا ثم rollback لأنهما لم يحققا تحسنًا مثبتًا؛ يبقى تحذير entry >500KB | future budget/route performance decision | n/a | n/a | App lazy imports موجودة، لا optimization غير مثبت محفوظ | low direct security | current bundle قابل للقياس لكن hardening لم يُثبت | before/after JSON + final reference | تحسن القياس؛ optimization مؤجل حتى قرار budget/route أو أثر حقيقي |
| Production deployment/release package | EXTERNAL BLOCKER | لا يوجد نشر production موثق ولا owner DNS/secrets/OAuth/Docker | owner infrastructure | fail-closed behavior only | test env only | local build only | production unknown | لا يمكن الإطلاق النهائي | owner config + deploy smoke | لا داخل sandbox فقط |
| Payment verification real provider | EXTERNAL BLOCKER | verifier requires real chain/provider/addresses/credentials | owner payment config | graceful unavailable | function exists | UI fail-closed | high if faked | purchase cannot complete | real test transaction | لا |
| Real AI implementation | OUT OF V1 | الملف 16 يستبعد AI صراحة | none | provider-neutral disabled | none | no fake AI | avoids false claims | no AI capability in V1 by design | confirm AI disabled/no fake success | لا؛ intentionally excluded |

## قراءة الجرد

أُغلقت داخل المستودع وبأدلة تشغيلية: إدارة القالب الأساسية، `tickets.project_id` مع عزل RLS، Client 360 batched overview، initialization boundary/idempotency، grouping الإشعارات داخل Dashboard، regression packaging، Staff + populated Client A/B browser E2E، public responsive/language matrix، وlight DOM accessibility smoke. بقيت Service→Template automation لأن `packages.services` مفاتيح نصية مثل `str-001` بينما `services.id` هو BIGINT، ولا يحمل order هوية خدمة canonical؛ لذلك لا يجوز تنفيذ مطابقة نصية أو إضافة FK غير مستخدم. كما بقي توحيد Dashboard/Portal وdrill-down الكامل في Client 360 وCommand Center كقرارات UX/product، وبقي auto-initialization بعد payment خارج ما يمكن حسمه بأمان دون verifier/provider وcontract canonical.

## معيار عدم الإغلاق الوهمي

لا يُصنف browser أو responsive أو production أو payment على أنه PASS بناءً على build أو HTTP 200. لا يُصنف RLS على أنه PASS بناءً على Express 403 فقط؛ يلزم direct authenticated JWT/PostgREST. لا تستخدم service-role لإثبات عزل العميل.
