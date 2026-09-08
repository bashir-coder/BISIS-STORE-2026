# BİŞIŞ V1 — Operations Runbook

هذا المستند يصف الإجراء التشغيلي دون تنفيذ أي إجراء على Production. لا يُستبدل به restore drill أو incident approval حقيقي.

## Incident severity

| Level | Example | Immediate owner |
|---|---|---|
| P0 | cross-client data exposure، leaked service-role key، payment mis-verification، database corruption | Security + Database + Founder |
| P1 | sustained 5xx/latency، Auth outage، Storage outage، delivery lifecycle failure | Operations + Backend |
| P2 | isolated UI defect، non-critical integration failure، performance regression | Product + Engineering |

## First-response procedure

أوقف أي rollout أو زيادة traffic، وسجّل وقت الحادثة والartifact/environment version. احتفظ بـrequest IDs وstatus codes دون نسخ passwords أو bearer tokens أو service keys أو بيانات عميل غير لازمة. حدّد هل الحادثة authorization/data integrity أم availability فقط، ثم قيّد الوصول إلى السجلات وأبلغ المالك المناسب. لا تُصلح database مباشرة من SQL Editor قبل حفظ evidence وقرار database owner.

## Security incident

عند الاشتباه بتسريب secret، لا تبحث عن قيمة السر داخل السجلات أو Git. عطّل/دوّر المفتاح من secret manager، راجع Auth sessions وlogs، تحقق من RLS/Storage access، ثم شغّل client-isolation smoke قبل إعادة فتح traffic. عند احتمال cross-client exposure، اجعل القرار P0 واحتفظ بالمشروع/النسخة المتأثرة للتحقيق بدل حذف الأدلة.

## Health and alert matrix

| Signal | Alert | First action |
|---|---|---|
| HTTPS uptime or `/api/live` | 2 consecutive failures | inspect edge/container/process |
| `/api/ready` 503 | sustained for 2–5 minutes | check Supabase reachability/credentials/quotas |
| HTTP 5xx | threshold above baseline | correlate request IDs and recent artifact |
| HTTP 429 | sustained or unusual burst | inspect edge limiter and abusive source; do not disable limiter |
| Auth failures | spike or provider errors | inspect Supabase Auth settings and redirect/SMTP |
| Storage errors | upload/signed URL failures | inspect bucket policy, limits, and object health |
| Payment verifier failures | any unexpected verified/failed mismatch | freeze checkout and inspect RPC/contract/reorg status |
| Database backup failure | any missed scheduled backup | notify database owner; do not claim recoverability |

## Backup policy

يجب أن يحدد المالك RPO وRTO وretention قبل الإطلاق. تُحفظ database backups أو PITR وفق خطة Supabase/host، ويُحفظ Storage objects في مسار مستقل لأن database backup لا يكفي لإعادة ملفات Storage [1]. تُقيد صلاحيات النسخ، ويُسجل وقت آخر backup ونتيجة integrity check دون إدخال secrets في التقرير.

## Restore procedure

لا تُستعاد Production فوق نفسها كأول تجربة. استخدم مشروعًا منفصلًا، استعد database backup، ثم استعد Storage objects من النسخة المستقلة، وتحقق من counts/schema/FKs/RLS/policies/grants/functions/triggers. شغّل `/api/ready` وlive smoke وIDOR/client isolation وbrowser acceptance. سجّل زمن الاستعادة الفعلي وقارنه بـRTO قبل اعتماد الخطة.

## Rollback procedure

إذا كان العطل application-only، أعد containers إلى آخر immutable artifact digest معروف، ثم افحص `/api/live`, `/api/ready`, 5xx، Auth، Storage، وbrowser smoke. لا تحذف migrations ولا تشغل reverse SQL مخمنًا. إذا كان العطل schema/data، اعزل traffic، استخدم PITR أو restore إلى مشروع منفصل، واجعل Database owner يقرر cutover. بعد rollback سجّل artifact السابق والسبب ونتيجة verification.

## Change and release record

كل release يجب أن يربط commit SHA، lockfile state، image digest، migration ledger، environment version، smoke output، backup status، approval، وrollback owner. لا يُعلن GO من repository checks وحدها؛ يجب أن تشمل الأدلة البيئة الخارجية وprovider drills.

## Current sandbox limitation

لم تُنفذ backup/restore أو monitoring alerts أو incident drill على Production، ولم تُنشأ أي credentials أو integrations جديدة. هذه إجراءات owner/infrastructure تحتاج accounts وtargets خارج المستودع.

## References

[1]: [Supabase Database Backups](https://supabase.com/docs/guides/platform/backups)
