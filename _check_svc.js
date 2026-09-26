const t = require('fs').readFileSync('frontend/src/i18n-fallback.ts', 'utf8');
['svc-016.description', 'svc-016.name', 'svc-018.description'].forEach(key => {
  ['ar', 'en', 'tr'].forEach(lang => {
    const re = new RegExp('"' + lang + '".*?"' + key + '"\\s*:\\s*"((?:[^"\\\\]|\\\\.)*)"', 's');
    const m = t.match(re);
    console.log(lang, key, ':', m ? m[1].substring(0, 80) : 'NOT FOUND');
  });
});
