# BİŞIŞ V1 — Frontend Performance Baseline

## Measurement scope

تم تشغيل `npm --prefix frontend run build` ثم `node scripts/measure-build.mjs` قبل وبعد lazy-loading لصفحات Chat وVerify Email وNot Found. القياس static محلي؛ لا يمثل Lighthouse أو جهازًا فعليًا.

| Metric | Before | After | Interpretation |
|---|---:|---:|---|
| Asset count | 38 | 47 | زاد بسبب route chunks الجديدة |
| Total uncompressed | 1,994,642 bytes | 1,996,927 bytes | زيادة 2,285 bytes |
| Total gzip | 599,844 bytes | 603,781 bytes | زيادة 3,937 bytes |
| Largest entry JS | 784,439 bytes | 756,845 bytes | تحسن 27,594 bytes |
| Largest entry gzip | 234,080 bytes | 225,938 bytes | تحسن 8,142 bytes، نحو 3.5% |
| Assets over 500 KB | `index-*.js` | `index-*.js` | التحذير ما زال قائمًا |

## Decision

تم الإبقاء على التعديل لأن أول تحميل للتطبيق يبدأ من entry أصغر، بينما الزيادة الإجمالية الصغيرة هي تكلفة chunks المؤجلة. لا توجد دعوى أن total bundle انخفض أو أن Lighthouse تحسن؛ يلزم قياس حقيقي على جهاز/شبكة ممثلة قبل أي optimization إضافي.

لا يجوز رفع `build.chunkSizeWarningLimit` لإخفاء التحذير. التحسينات التالية، إن لزم الأمر، تحتاج profiling وLighthouse أو browser performance budget، وليست ضمن إغلاق V1 الحالي.
