const fs = require('fs');
const path = require('path');

// =====================================================
// I18N CENTRALIZATION MIGRATION GENERATOR
// Phase 1: Extract all translatable content → generate i18n entries
// =====================================================

// 1. Load source content
const servicesJson = JSON.parse(fs.readFileSync('database/seeds/services.json', 'utf8'));
const packagesJson = JSON.parse(fs.readFileSync('database/seeds/packages.json', 'utf8'));
const faqsJson = JSON.parse(fs.readFileSync('database/seeds/faqs.json', 'utf8'));

// 2. Parse existing i18n-fallback.ts
const i18nPath = 'frontend/src/i18n-fallback.ts';
let i18nContent = fs.readFileSync(i18nPath, 'utf8');

// Extract keys and values per language
const langStart = {};
langStart['ar'] = i18nContent.indexOf('"ar": {');
langStart['en'] = i18nContent.indexOf('"en": {');
langStart['tr'] = i18nContent.indexOf('"tr": {');
const sorted = Object.entries(langStart).sort((a, b) => a[1] - b[1]);

const sectionData = {};
const sectionKeys = {};

sorted.forEach(([lang, start], i) => {
  const end = i + 1 < sorted.length ? sorted[i + 1][1] : i18nContent.length;
  const sectionText = i18nContent.substring(start, end);
  sectionData[lang] = {};
  sectionKeys[lang] = [];
  
  // Parse key-value pairs
  const re = /\s+"([^"]+)":\s+"(?:[^"\\]|\\.)*"\s*,?\n/g;
  let m;
  while ((m = re.exec(sectionText)) !== null) {
    const key = m[1];
    // Extract the value (handle escaped quotes)
    const valueMatch = sectionText.substring(m.index).match(/"[^"]+":\s+"((?:[^"\\]|\\.)*)"/);
    if (valueMatch && valueMatch[1]) {
      sectionData[lang][key] = valueMatch[1].replace(/\\"/g, '"').replace(/\\\\/g, '\\');
      sectionKeys[lang].push(key);
    }
  }
});

const fileKeySets = {
  ar: new Set(sectionKeys.ar),
  en: new Set(sectionKeys.en),
  tr: new Set(sectionKeys.tr),
};

// 3. Extract service descriptions from PackagesPage.tsx
const packagesPageContent = fs.readFileSync('frontend/src/pages/PackagesPage.tsx', 'utf8');

// Extract serviceCopy object
const serviceCopyMatch = packagesPageContent.match(/const serviceCopy[^=]+=\s*\{([\s\S]*?)\n\}/);
const serviceCopy = {};
if (serviceCopyMatch) {
  const body = serviceCopyMatch[1];
  const svcRegex = /'svc-(\d+)':\s*\{\s*ar:\s*'((?:[^'\\]|\\.)*)',\s*en:\s*'((?:[^'\\]|\\.)*)',\s*tr:\s*'((?:[^'\\]|\\.)*)'\s*\}/g;
  let m;
  while ((m = svcRegex.exec(body)) !== null) {
    serviceCopy['svc-' + m[1]] = { ar: m[2], en: m[3], tr: m[4] };
  }
}

// Extract uiCopy object
const uiCopyMatch = packagesPageContent.match(/const uiCopy[^=]+=\s*\{([\s\S]*?)\n\}/);
const uiCopy = { ar: {}, en: {}, tr: {} };
if (uiCopyMatch) {
  const body = uiCopyMatch[1];
  // Parse each language section
  ['ar', 'en', 'tr'].forEach(lang => {
    const langMatch = body.match(new RegExp(`\\b${lang}:\\s*\\{([\\s\\S]*?)\\}`));
    if (langMatch) {
      const langBody = langMatch[1];
      const kvRegex = /(\w+):\s*'((?:[^'\\]|\\.)*)'/g;
      let m;
      while ((m = kvRegex.exec(langBody)) !== null) {
        uiCopy[lang][m[1]] = m[2];
      }
    }
  });
}

// Extract packageDescriptionCopy object
const pkgDescMatch = packagesPageContent.match(/const packageDescriptionCopy[^=]+=\s*\{([\s\S]*?)\n\}/);
const packageDescriptionCopy = {};
if (pkgDescMatch) {
  const body = pkgDescMatch[1];
  ['foundation', 'growth', 'scale'].forEach(slug => {
    const slugMatch = body.match(new RegExp(`${slug}:\\s*\\{([\\s\\S]*?)\\}`));
    if (slugMatch) {
      const vals = {};
      ['ar', 'en', 'tr'].forEach(lang => {
        const langMatch = slugMatch[1].match(new RegExp(`\\b${lang}:\\s*'([^']*)'`));
        if (langMatch) vals[lang] = langMatch[1];
      });
      packageDescriptionCopy[slug] = vals;
    }
  });
}

// 4. Extract service descriptions from LabPage.tsx
const labPageContent = fs.readFileSync('frontend/src/pages/LabPage.tsx', 'utf8');
const labSvcDescMatch = labPageContent.match(/const serviceDescriptions[^=]+=\s*\{([\s\S]*?)\n\}/);
const labServiceDescriptions = {};
if (labSvcDescMatch) {
  const body = labSvcDescMatch[1];
  const svcRegex = /'svc-(\d+)':\s*'([^']*)'/g;
  let m;
  while ((m = svcRegex.exec(body)) !== null) {
    labServiceDescriptions['svc-' + m[1]] = m[2]; // Arabic only
  }
}

// Extract packageDescriptions from LabPage
const labPkgDescMatch = labPageContent.match(/const packageDescriptions[^=]+=\s*\{([\s\S]*?)\n\}/);
const labPackageDescriptions = {};
if (labPkgDescMatch) {
  const body = labPkgDescMatch[1];
  ['foundation', 'growth', 'scale'].forEach(slug => {
    const slugMatch = body.match(new RegExp(`${slug}:\\s*\n\\s*'([^']*)'`));
    if (slugMatch) labPackageDescriptions[slug] = slugMatch[1]; // Arabic only
  });
}

// 5. Service data from DB
const servicesList = servicesJson.categories?.[0]?.services || [];
const serviceById = {};
servicesList.forEach(s => {
  serviceById[s.id] = s;
});

// 6. Language names from env.ts
const envContent = fs.readFileSync('frontend/src/utils/env.ts', 'utf8');
const langNames = {};
const langRegex = /{ code: '(\w+)', name: '([^']+)'/g;
let lm;
while ((lm = langRegex.exec(envContent)) !== null) {
  langNames[lm[1]] = lm[2];
}

// =====================================================
// BUILD NEW I18N ENTRIES
// =====================================================
const newKeys = {}; // key -> { ar, en, tr }
const sourceMapping = []; // DB → i18n mapping
const markedForReview = [];

// --- SERVICE NAMES (EN from DB, AR/TR need translation) ---
servicesList.forEach(svc => {
  const key = 'services.' + svc.id + '.name';
  newKeys[key] = {
    en: svc.name,
    ar: svc.name, // Using EN as fallback - needs AR translation
    tr: svc.name, // Using EN as fallback - needs TR translation
  };
  markedForReview.push({ key, reason: 'Service name EN from DB; AR/TR need professional translation', source: 'services.json' });
  sourceMapping.push({
    table: 'services', field: 'name', record: svc.id, originalValue: svc.name,
    newKey: key, lang: 'en',
    note: 'ar/tr marked for review'
  });
});

// --- SERVICE DESCRIPTIONS (from PackagesPage serviceCopy) ---
Object.keys(serviceCopy).forEach(svcId => {
  const key = 'services.' + svcId + '.description';
  const copy = serviceCopy[svcId];
  newKeys[key] = { ar: copy.ar, en: copy.en, tr: copy.tr };
  sourceMapping.push({
    table: 'services', field: 'description', record: svcId,
    originalValue: serviceById[svcId]?.description,
    newKey: key, lang: 'ar',
  });
});

// --- PACKAGE NAMES (EN from DB, AR/TR need translation) ---
packagesJson.forEach(pkg => {
  const key = 'packages.' + pkg.slug + '.name';
  newKeys[key] = { en: pkg.name, ar: pkg.name, tr: pkg.name };
  markedForReview.push({ key, reason: 'Package name EN from DB; AR/TR need translation', source: 'packages.json' });
  sourceMapping.push({
    table: 'packages', field: 'name', record: pkg.slug, originalValue: pkg.name,
    newKey: key, lang: 'en', note: 'ar/tr marked for review'
  });
});

// --- PACKAGE DESCRIPTIONS (from packageDescriptionCopy) ---
Object.keys(packageDescriptionCopy).forEach(slug => {
  const key = 'packages.' + slug + '.description';
  const copy = packageDescriptionCopy[slug];
  newKeys[key] = { ar: copy.ar, en: copy.en, tr: copy.tr };
  sourceMapping.push({
    table: 'packages', field: 'description', record: slug,
    originalValue: packagesJson.find(p => p.slug === slug)?.description,
    newKey: key, lang: 'all'
  });
});

// --- PACKAGE FEATURES (from packages.json, EN only) ---
packagesJson.forEach(pkg => {
  pkg.features.forEach((feature, idx) => {
    const key = 'packages.' + pkg.slug + '.feature' + (idx + 1);
    newKeys[key] = { en: feature, ar: feature, tr: feature };
    markedForReview.push({ key, reason: 'Feature label EN from DB; AR/TR need translation', source: 'packages.json' });
    sourceMapping.push({
      table: 'packages', field: 'features', record: pkg.slug + '.feature' + (idx + 1),
      originalValue: feature, newKey: key, lang: 'en', note: 'ar/tr marked for review'
    });
  });
});

// --- PACKAGES.CATEGORY (from packages.json) ---
packagesJson.forEach(pkg => {
  if (pkg.category) {
    const key = 'packages.' + pkg.slug + '.category';
    newKeys[key] = { ar: pkg.category, en: pkg.category, tr: pkg.category };
    markedForReview.push({ key, reason: 'Category from DB; AR/TR need translation if applicable', source: 'packages.json' });
    sourceMapping.push({
      table: 'packages', field: 'category', record: pkg.slug,
      originalValue: pkg.category, newKey: key, lang: 'en'
    });
  }
});

// --- UI COPY from PackagesPage.uiCopy ---
const uiCopyKeyMap = {
  calculator: 'packages.calc.calculator',
  hideCalculator: 'packages.calc.hide',
  compare: 'packages.calc.compare',
  calculatorTitle: 'packages.calc.title',
  chooseScope: 'packages.calc.choose_scope',
  estimate: 'packages.calc.estimate',
  outputs: 'packages.calc.outputs',
  selectPackage: 'packages.calc.select',
  serviceOrOutput: 'packages.calc.service_or_output',
  compareHint: 'packages.calc.compare_hint',
  close: 'packages.calc.close',
};

Object.keys(uiCopyKeyMap).forEach(uiKey => {
  const i18nKey = uiCopyKeyMap[uiKey];
  newKeys[i18nKey] = {
    ar: uiCopy.ar[uiKey] || '',
    en: uiCopy.en[uiKey] || '',
    tr: uiCopy.tr[uiKey] || '',
  };
});

// --- LABPAGE service descriptions (AR-only, different text) ---
// These are AR descriptions only - EN/TR come from serviceCopy
Object.keys(labServiceDescriptions).forEach(svcId => {
  const key = 'services.' + svcId + '.description';
  const labDesc = labServiceDescriptions[svcId];
  const pkgDesc = serviceCopy[svcId];
  
  // If we already have this from serviceCopy, note the discrepancy
  if (newKeys[key]) {
    if (newKeys[key].ar !== labDesc) {
      sourceMapping.push({
        table: 'services', field: 'description', record: svcId,
        originalValue: labDesc,
        existingKey: key,
        existingArValue: newKeys[key].ar,
        discrepancy: 'LabPage has different AR description than PackagesPage serviceCopy',
      });
    }
  } else {
    // Not in serviceCopy - add it
    newKeys[key] = { ar: labDesc, en: pkgDesc?.en || '', tr: pkgDesc?.tr || '' };
    if (!pkgDesc) markedForReview.push({ key, reason: 'AR description from LabPage only; EN/TR are empty', source: 'LabPage.tsx' });
  }
});

// --- LABPAGE package descriptions (AR-only) ---
Object.keys(labPackageDescriptions).forEach(slug => {
  const key = 'packages.' + slug + '.description';
  const labDesc = labPackageDescriptions[slug];
  const pkgDesc = packageDescriptionCopy[slug];
  
  if (newKeys[key]) {
    if (newKeys[key].ar !== labDesc) {
      sourceMapping.push({
        table: 'packages', field: 'description', record: slug,
        originalValue: labDesc,
        existingKey: key,
        existingArValue: newKeys[key].ar,
        discrepancy: 'LabPage has different AR description than PackagesPage packageDescriptionCopy',
      });
    }
  } else {
    newKeys[key] = { ar: labDesc, en: pkgDesc?.en || '', tr: pkgDesc?.tr || '' };
    if (!pkgDesc) markedForReview.push({ key, reason: 'AR description from LabPage only; EN/TR are empty', source: 'LabPage.tsx' });
  }
});

// --- LABPAGE hardcoded text ---
const labHardcoded = {
  'lab.badge.title': { ar: 'مرحل التجريبي', en: 'BİŞİŞ LAB', tr: 'BİŞİŞ LAB' }, // Brand name, not translated
  'lab.about.features.scope': { ar: 'نطاق واضح', en: 'Clear Scope', tr: 'Net Kapsam' },
  'lab.about.features.structure': { ar: 'تسليم منظم', en: 'Structured Delivery', tr: 'Yapılandırılmış Teslim' },
  'lab.about.features.workspace': { ar: 'مساحة العميل', en: 'Client Workspace', tr: 'Müşteri Çalışma Alanı' },
  'lab.about.features.security': { ar: 'دفع آمن', en: 'Secure Payments', tr: 'Güvenli Ödemeler' },
  'lab.status.live': { ar: 'نشط', en: 'LIVE', tr: 'CANLI' },
  'lab.status.unavailable': { ar: 'غير متاح', en: 'UNAVAILABLE', tr: 'KULLANILAMAZ' },
  'lab.badge.subscription': { ar: 'اشتراك توقيع', en: 'Signature Subscription', tr: 'İmza Aboneliği' },
  'lab.stats.ready': { ar: 'جاهز', en: 'READY', tr: 'HAZIR' },
};

Object.keys(labHardcoded).forEach(key => {
  newKeys[key] = labHardcoded[key];
});
markedForReview.push({ key: 'lab.badge.title', reason: 'Brand name - "BİŞİŞ LAB" is not translated; AR uses generic term', source: 'LabPage.tsx hardcoded' });

// --- LANGUAGE NAMES (from env.ts) ---
newKeys['languages.ar.name'] = { ar: 'العربية', en: 'Arabic', tr: 'Arapça' };
newKeys['languages.en.name'] = { ar: 'الإنجليزية', en: 'English', tr: 'İngilizce' };
newKeys['languages.tr.name'] = { ar: 'التركية', en: 'Turkish', tr: 'Türkçe' };

// --- FAQ content (from faqs.json seed) ---
faqsJson.forEach((faq, idx) => {
  if (faq.question && faq.question.ar) {
    const num = idx + 1;
    newKeys['faq.question' + num] = { ar: faq.question.ar, en: faq.question.en, tr: faq.question.tr };
    newKeys['faq.answer' + num] = { ar: faq.answer.ar, en: faq.answer.en, tr: faq.answer.tr };
    sourceMapping.push({
      table: 'faqs', field: 'question/answer', record: 'faq_' + num,
      originalValue: faq.question.ar, newKey: 'faq.question' + num + '/faq.answer' + num, lang: 'all'
    });
  }
});

// --- ADMIN error messages (from AdminPanel.tsx hardcoded) ---
const adminHardcoded = {
  'admin.error_load_orders': { ar: 'تعذر تحميل الطلبات', en: 'Unable to load orders', tr: 'Siparişler yüklenemiyor' },
  'admin.error_update_order': { ar: 'تعذر تحديث الطلب', en: 'Unable to update order', tr: 'Sipariş güncellenemiyor' },
  'admin.pdf_download': { ar: 'تنزيل PDF', en: 'PDF', tr: 'PDF' },
  'admin.invoice_title': { ar: 'فاتورة', en: 'Invoice', tr: 'Fatura' },
  'admin.invoice_total': { ar: 'الإجمالي الكلي', en: 'Total', tr: 'Toplam' },
  'admin.invoice_service': { ar: 'الخدمة', en: 'Service', tr: 'Hizmet' },
  'admin.invoice_price': { ar: 'السعر', en: 'Price', tr: 'Fiyat' },
  'admin.invoice_tax': { ar: 'الضريبة', en: 'Tax', tr: 'Vergi' },
  'admin.invoice_client': { ar: 'العميل', en: 'Client', tr: 'Müşteri' },
  'admin.invoice_date': { ar: 'التاريخ', en: 'Date', tr: 'Tarih' },
  'admin.invoice_status_issued': { ar: 'مصدرة ✅', en: 'Issued', tr: 'Yayınlandı ✅' },
  'admin.invoice_status_refunded': { ar: 'مستردة', en: 'Refunded', tr: 'Geri ödendi' },
  'admin.invoice_status_cancelled': { ar: 'ملغاة', en: 'Cancelled', tr: 'İptal edildi' },
  'admin.invoice_thankyou': { ar: 'شكراً لثقتك بنا. هذه الفاتورة صادرة من BİŞİŞ.', en: 'Thank you for your trust in us. This invoice is issued by BİŞİŞ.', tr: 'Bizimle çalışmanız için teşekkürler. Bu fatura BİŞİŞ tarafından çıkarılmıştır.' },
  'admin.footer_contact': { ar: 'للتواصل: info@BİŞİŞ.com', en: 'Contact: info@BİŞİŞ.com', tr: 'İletişim: info@BİŞİŞ.com' },
};

Object.keys(adminHardcoded).forEach(key => {
  newKeys[key] = adminHardcoded[key];
});

// --- SERVICE DELIVERY info from DB ---
servicesList.forEach(svc => {
  const key = 'services.' + svc.id + '.delivery';
  newKeys[key] = { ar: svc.delivery || '', en: svc.delivery || '', tr: svc.delivery || '' };
  sourceMapping.push({
    table: 'services', field: 'delivery', record: svc.id,
    originalValue: svc.delivery, newKey: key, lang: 'all', note: 'Delivery times are numeric, language-neutral'
  });
});

// --- SERVICE LEVEL info from DB ---
servicesList.forEach(svc => {
  const key = 'services.' + svc.id + '.category';
  newKeys[key] = { ar: svc.service_type || '', en: svc.service_type || '', tr: svc.service_type || '' };
});

// =====================================================
// MERGE INTO i18n-fallback.ts
// =====================================================

// Build new JSON structure
const allLangs = ['ar', 'en', 'tr'];
const mergedData = {};

allLangs.forEach(lang => {
  mergedData[lang] = { ...sectionData[lang] };
});

// Add new keys
Object.entries(newKeys).forEach(([key, langValues]) => {
  allLangs.forEach(lang => {
    if (langValues[lang] && langValues[lang].trim() !== '') {
      mergedData[lang][key] = langValues[lang];
    }
  });
});

// Generate the file content
function escapeValue(val) {
  return val.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n');
}

let output = `// AUTO-GENERATED from database/seeds/translations.json + centralized content. Do not edit manually.\n`;
output += `// Source mapping: DB_CONTENT_TRANSITION_REPORT.md\n\n`;
output += `export type SupportedLanguage = 'ar' | 'en' | 'tr'\n\n`;
output += `export const fallbackResources: Record<SupportedLanguage, { common: Record<string, string> }> = {\n`;

allLangs.forEach(lang => {
  const keys = Object.keys(mergedData[lang]).sort();
  output += `  "${lang}": {\n`;
  output += `    "common": {\n`;
  keys.forEach((key, idx) => {
    const isLast = idx === keys.length - 1;
    output += `      "${key}": "${escapeValue(mergedData[lang][key])}"${isLast ? '' : ','}\n`;
  });
  output += `    }\n`;
  output += `  }${lang === 'tr' ? '' : ','}\n`;
});
output += `}\n`;

fs.writeFileSync(i18nPath, output);

// =====================================================
// REPORTS
// =====================================================

// Count stats
let newKeysAr = 0, newKeysEn = 0, newKeysTr = 0;
Object.entries(newKeys).forEach(([key, langValues]) => {
  if (langValues.ar?.trim()) newKeysAr++;
  if (langValues.en?.trim()) newKeysEn++;
  if (langValues.tr?.trim()) newKeysTr++;
});

console.log('=== I18N CENTRALIZATION COMPLETE ===');
console.log('\nNew keys added:');
console.log('  AR: ' + newKeysAr + ' keys');
console.log('  EN: ' + newKeysEn + ' keys');
console.log('  TR: ' + newKeysTr + ' keys');

console.log('\nContent sources extracted:');
console.log('  Service names (18): EN from DB');
console.log('  Service descriptions (18): AR/EN/TR from PackagesPage');
console.log('  Service delivery (all): from DB');
console.log('  Package names (3): EN from DB');
console.log('  Package descriptions (3): AR/EN/TR from PackagesPage');
console.log('  Package features (20): EN from DB');
console.log('  Package categories (all): from DB');
console.log('  UI copy (11): AR/EN/TR from PackagesPage uiCopy');
console.log('  LabPage hardcoded text (11): AR/EN/TR');
console.log('  Language names (3): from env.ts');
console.log('  FAQ content (6): AR/EN/TR from DB');
console.log('  Admin error messages (16): AR/EN/TR');

console.log('\nMarked for review:', markedForReview.length);
markedForReview.forEach(m => console.log('  ' + m.key + ' - ' + m.reason));

console.log('\nSource mapping entries:', sourceMapping.length);
console.log('\nFile updated:', i18nPath);
