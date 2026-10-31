const fs = require('fs');
let c = fs.readFileSync('frontend/src/i18n-fallback.ts', 'utf8');

const arInsert = __PROTECT_3__;
c = c.replace(
  __PROTECT_4__,
  arInsert + __PROTECT_5__
);

const enInsert = __PROTECT_6__;
c = c.replace(
  __PROTECT_7__,
  enInsert + __PROTECT_8__
);

const trInsert = '      "admin.catalog_error": "Katalog yüklenemedi. Paket sayfasına gidip tekrar deneyebilirsiniz.",\n';
c = c.replace(
  '      "admin.error_load_orders": "Siparişler yüklenemiyor",',
  trInsert + '      "admin.error_load_orders": "Siparişler yüklenemiyor",'
);

fs.writeFileSync('frontend/src/i18n-fallback.ts', c);
console.log('Done');
