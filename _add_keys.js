const fs = require('fs');
let c = fs.readFileSync('frontend/src/i18n-fallback.ts', 'utf8');

// AR: insert before admin.error_load_orders
const arInsert = '      "admin.catalog_error": "تعذر تحميل الكتالوج الآن. يمكنك الانتقال إلى لوحة الباقات وال المحاولة مرة أخرى.",\n';
c = c.replace(
  '      "admin.error_load_orders": "تعذر تحميل_pedidos",',
  arInsert + '      "admin.error_load_orders": "تعذر تحميل_pedidos",'
);

// EN: insert before admin.error_load_orders
const enInsert = '      "admin.catalog_error": "Unable to load catalog. You can navigate to the packages page and try again.",\n';
c = c.replace(
  '      "admin.error_load_orders": "Unable to load orders",',
  enInsert + '      "admin.error_load_orders": "Unable to load orders",'
);

// TR: insert before admin.error_load_orders
const trInsert = '      "admin.catalog_error": "Katalog yüklenemedi. Paket sayfasına gidip tekrar deneyebilirsiniz.",\n';
c = c.replace(
  '      "admin.error_load_orders": "Siparişler yüklenemiyor",',
  trInsert + '      "admin.error_load_orders": "Siparişler yüklenemiyor",'
);

fs.writeFileSync('frontend/src/i18n-fallback.ts', c);
console.log('Done');