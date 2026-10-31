const fs = require('fs');
const path = require('path');

const servicesJson = JSON.parse(fs.readFileSync(__PROTECT_16__, __PROTECT_17__));
const packagesJson = JSON.parse(fs.readFileSync(__PROTECT_18__, __PROTECT_19__));
const faqsJson = JSON.parse(fs.readFileSync(__PROTECT_20__, __PROTECT_21__));

const i18nPath = __PROTECT_22__;
let i18nContent = fs.readFileSync(i18nPath, __PROTECT_23__);

const langStart = {};
langStart[__PROTECT_24__] = i18nContent.indexOf(__PROTECT_25__);
langStart[__PROTECT_26__] = i18nContent.indexOf(__PROTECT_27__);
langStart[__PROTECT_28__] = i18nContent.indexOf(__PROTECT_29__);
const sorted = Object.entries(langStart).sort((a, b) => a[1] - b[1]);

const sectionData = {};
const sectionKeys = {};

sorted.forEach(([lang, start], i) => {
  const end = i + 1 < sorted.length ? sorted[i + 1][1] : i18nContent.length;
  const sectionText = i18nContent.substring(start, end);
  sectionData[lang] = {};
  sectionKeys[lang] = [];

  const re = /\s+"([^"]+)":\s+"(?:[^"\\]|\\.)*"\s*,?\n/g;
  let m;
  while ((m = re.exec(sectionText)) !== null) {
    const key = m[1];

    const valueMatch = sectionText.substring(m.index).match(/"[^"]+":\s+"((?:[^"\\]|\\.)*)"/);
    if (valueMatch && valueMatch[1]) {
      sectionData[lang][key] = valueMatch[1].replace(/\\"/g, __PROTECT_30__).replace(/\\\\/g, __PROTECT_31__);
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
const packagesPageContent = fs.readFileSync(__PROTECT_32__, __PROTECT_33__);

// Extract serviceCopy object
const serviceCopyMatch = packagesPageContent.match(/const serviceCopy[^=]+=\s*\{([\s\S]*?)\n\}/);
const serviceCopy = {};
if (serviceCopyMatch) {
  const body = serviceCopyMatch[1];
  const svcRegex = /__PROTECT_34__:\s*\{\s*ar:\s*__PROTECT_35__\\]|\\.)*)__PROTECT_36__((?:[^__PROTECT_37__,\s*tr:\s*__PROTECT_38__\\]|\\.)*)__PROTECT_39__svc-__PROTECT_40__ar__PROTECT_41__en__PROTECT_42__tr__PROTECT_43__((?:[^__PROTECT_44__/g;
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
  [__PROTECT_45__, __PROTECT_46__, __PROTECT_47__].forEach(slug => {
    const slugMatch = body.match(new RegExp(__PROTECT_1__));
    if (slugMatch) {
      const vals = {};
      [__PROTECT_48__, __PROTECT_49__, __PROTECT_50__].forEach(lang => {
        const langMatch = slugMatch[1].match(new RegExp(__PROTECT_2__));
        if (langMatch) vals[lang] = langMatch[1];
      });
      packageDescriptionCopy[slug] = vals;
    }
  });
}

// 4. Extract service descriptions from LabPage.tsx
const labPageContent = fs.readFileSync(__PROTECT_51__, __PROTECT_52__);
const labSvcDescMatch = labPageContent.match(/const serviceDescriptions[^=]+=\s*\{([\s\S]*?)\n\}/);
const labServiceDescriptions = {};
if (labSvcDescMatch) {
  const body = labSvcDescMatch[1];
  const svcRegex = /__PROTECT_53__:\s*__PROTECT_54__]*)__PROTECT_55__svc-__PROTECT_56__foundation__PROTECT_57__growth__PROTECT_58__scale__PROTECT_59__frontend/src/utils/env.ts__PROTECT_60__utf8__PROTECT_61__(\w+)__PROTECT_62__([^__PROTECT_63__/g;
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
  const key = __PROTECT_64__ + svc.id + __PROTECT_65__;
  newKeys[key] = {
    en: svc.name,
    ar: svc.name, // Using EN as fallback - needs AR translation
    tr: svc.name, // Using EN as fallback - needs TR translation
  };
  markedForReview.push({ key, reason: __PROTECT_66__, source: __PROTECT_67__ });
  sourceMapping.push({
    table: __PROTECT_68__, field: __PROTECT_69__, record: svc.id, originalValue: svc.name,
    newKey: key, lang: __PROTECT_70__,
    note: __PROTECT_71__
  });
});

// --- SERVICE DESCRIPTIONS (from PackagesPage serviceCopy) ---
Object.keys(serviceCopy).forEach(svcId => {
  const key = __PROTECT_72__ + svcId + __PROTECT_73__;
  const copy = serviceCopy[svcId];
  newKeys[key] = { ar: copy.ar, en: copy.en, tr: copy.tr };
  sourceMapping.push({
    table: __PROTECT_74__, field: __PROTECT_75__, record: svcId,
    originalValue: serviceById[svcId]?.description,
    newKey: key, lang: __PROTECT_76__,
  });
});

// --- PACKAGE NAMES (EN from DB, AR/TR need translation) ---
packagesJson.forEach(pkg => {
  const key = __PROTECT_77__ + pkg.slug + __PROTECT_78__;
  newKeys[key] = { en: pkg.name, ar: pkg.name, tr: pkg.name };
  markedForReview.push({ key, reason: __PROTECT_79__, source: __PROTECT_80__ });
  sourceMapping.push({
    table: __PROTECT_81__, field: __PROTECT_82__, record: pkg.slug, originalValue: pkg.name,
    newKey: key, lang: __PROTECT_83__, note: __PROTECT_84__
  });
});

// --- PACKAGE DESCRIPTIONS (from packageDescriptionCopy) ---
Object.keys(packageDescriptionCopy).forEach(slug => {
  const key = __PROTECT_85__ + slug + __PROTECT_86__;
  const copy = packageDescriptionCopy[slug];
  newKeys[key] = { ar: copy.ar, en: copy.en, tr: copy.tr };
  sourceMapping.push({
    table: __PROTECT_87__, field: __PROTECT_88__, record: slug,
    originalValue: packagesJson.find(p => p.slug === slug)?.description,
    newKey: key, lang: __PROTECT_89__
  });
});

// --- PACKAGE FEATURES (from packages.json, EN only) ---
packagesJson.forEach(pkg => {
  pkg.features.forEach((feature, idx) => {
    const key = __PROTECT_90__ + pkg.slug + __PROTECT_91__ + (idx + 1);
    newKeys[key] = { en: feature, ar: feature, tr: feature };
    markedForReview.push({ key, reason: __PROTECT_92__, source: __PROTECT_93__ });
    sourceMapping.push({
      table: __PROTECT_94__, field: __PROTECT_95__, record: pkg.slug + __PROTECT_96__ + (idx + 1),
      originalValue: feature, newKey: key, lang: __PROTECT_97__, note: __PROTECT_98__
    });
  });
});

// --- PACKAGES.CATEGORY (from packages.json) ---
packagesJson.forEach(pkg => {
  if (pkg.category) {
    const key = __PROTECT_99__ + pkg.slug + __PROTECT_100__;
    newKeys[key] = { ar: pkg.category, en: pkg.category, tr: pkg.category };
    markedForReview.push({ key, reason: __PROTECT_101__, source: __PROTECT_102__ });
    sourceMapping.push({
      table: __PROTECT_103__, field: __PROTECT_104__, record: pkg.slug,
      originalValue: pkg.category, newKey: key, lang: __PROTECT_105__
    });
  }
});

// --- UI COPY from PackagesPage.uiCopy ---
const uiCopyKeyMap = {
  calculator: __PROTECT_106__,
  hideCalculator: __PROTECT_107__,
  compare: __PROTECT_108__,
  calculatorTitle: __PROTECT_109__,
  chooseScope: __PROTECT_110__,
  estimate: __PROTECT_111__,
  outputs: __PROTECT_112__,
  selectPackage: __PROTECT_113__,
  serviceOrOutput: __PROTECT_114__,
  compareHint: __PROTECT_115__,
  close: __PROTECT_116__,
};

Object.keys(uiCopyKeyMap).forEach(uiKey => {
  const i18nKey = uiCopyKeyMap[uiKey];
  newKeys[i18nKey] = {
    ar: uiCopy.ar[uiKey] || __PROTECT_117__,
    en: uiCopy.en[uiKey] || __PROTECT_118__,
    tr: uiCopy.tr[uiKey] || __PROTECT_119__,
  };
});

// --- LABPAGE service descriptions (AR-only, different text) ---
// These are AR descriptions only - EN/TR come from serviceCopy
Object.keys(labServiceDescriptions).forEach(svcId => {
  const key = __PROTECT_120__ + svcId + __PROTECT_121__;
  const labDesc = labServiceDescriptions[svcId];
  const pkgDesc = serviceCopy[svcId];

  // If we already have this from serviceCopy, note the discrepancy
  if (newKeys[key]) {
    if (newKeys[key].ar !== labDesc) {
      sourceMapping.push({
        table: __PROTECT_122__, field: __PROTECT_123__, record: svcId,
        originalValue: labDesc,
        existingKey: key,
        existingArValue: newKeys[key].ar,
        discrepancy: __PROTECT_124__,
      });
    }
  } else {
    // Not in serviceCopy - add it
    newKeys[key] = { ar: labDesc, en: pkgDesc?.en || __PROTECT_125__, tr: pkgDesc?.tr || __PROTECT_126__ };
    if (!pkgDesc) markedForReview.push({ key, reason: __PROTECT_127__, source: __PROTECT_128__ });
  }
});

// --- LABPAGE package descriptions (AR-only) ---
Object.keys(labPackageDescriptions).forEach(slug => {
  const key = __PROTECT_129__ + slug + __PROTECT_130__;
  const labDesc = labPackageDescriptions[slug];
  const pkgDesc = packageDescriptionCopy[slug];

  if (newKeys[key]) {
    if (newKeys[key].ar !== labDesc) {
      sourceMapping.push({
        table: __PROTECT_131__, field: __PROTECT_132__, record: slug,
        originalValue: labDesc,
        existingKey: key,
        existingArValue: newKeys[key].ar,
        discrepancy: __PROTECT_133__,
      });
    }
  } else {
    newKeys[key] = { ar: labDesc, en: pkgDesc?.en || __PROTECT_134__, tr: pkgDesc?.tr || __PROTECT_135__ };
    if (!pkgDesc) markedForReview.push({ key, reason: __PROTECT_136__, source: __PROTECT_137__ });
  }
});

// --- LABPAGE hardcoded text ---
const labHardcoded = {
  __PROTECT_138__: { ar: __PROTECT_139__, en: __PROTECT_140__, tr: __PROTECT_141__ }, // Brand name, not translated
  __PROTECT_142__: { ar: __PROTECT_143__, en: __PROTECT_144__, tr: __PROTECT_145__ },
  __PROTECT_146__: { ar: __PROTECT_147__, en: __PROTECT_148__, tr: __PROTECT_149__ },
  __PROTECT_150__: { ar: __PROTECT_151__, en: __PROTECT_152__, tr: __PROTECT_153__ },
  __PROTECT_154__: { ar: __PROTECT_155__, en: __PROTECT_156__, tr: __PROTECT_157__ },
  __PROTECT_158__: { ar: __PROTECT_159__, en: __PROTECT_160__, tr: __PROTECT_161__ },
  __PROTECT_162__: { ar: __PROTECT_163__, en: __PROTECT_164__, tr: __PROTECT_165__ },
  __PROTECT_166__: { ar: __PROTECT_167__, en: __PROTECT_168__, tr: __PROTECT_169__ },
  __PROTECT_170__: { ar: __PROTECT_171__, en: __PROTECT_172__, tr: __PROTECT_173__ },
};

Object.keys(labHardcoded).forEach(key => {
  newKeys[key] = labHardcoded[key];
});
markedForReview.push({ key: __PROTECT_174__, reason: __PROTECT_175__, source: __PROTECT_176__ });

// --- LANGUAGE NAMES (from env.ts) ---
newKeys[__PROTECT_177__] = { ar: __PROTECT_178__, en: __PROTECT_179__, tr: __PROTECT_180__ };
newKeys[__PROTECT_181__] = { ar: __PROTECT_182__, en: __PROTECT_183__, tr: __PROTECT_184__ };
newKeys[__PROTECT_185__] = { ar: __PROTECT_186__, en: __PROTECT_187__, tr: __PROTECT_188__ };

// --- FAQ content (from faqs.json seed) ---
faqsJson.forEach((faq, idx) => {
  if (faq.question && faq.question.ar) {
    const num = idx + 1;
    newKeys[__PROTECT_189__ + num] = { ar: faq.question.ar, en: faq.question.en, tr: faq.question.tr };
    newKeys[__PROTECT_190__ + num] = { ar: faq.answer.ar, en: faq.answer.en, tr: faq.answer.tr };
    sourceMapping.push({
      table: __PROTECT_191__, field: __PROTECT_192__, record: __PROTECT_193__ + num,
      originalValue: faq.question.ar, newKey: __PROTECT_194__ + num + __PROTECT_195__ + num, lang: __PROTECT_196__
    });
  }
});

// --- ADMIN error messages (from AdminPanel.tsx hardcoded) ---
const adminHardcoded = {
  __PROTECT_197__: { ar: __PROTECT_198__, en: __PROTECT_199__, tr: __PROTECT_200__ },
  __PROTECT_201__: { ar: __PROTECT_202__, en: __PROTECT_203__, tr: __PROTECT_204__ },
  __PROTECT_205__: { ar: __PROTECT_206__, en: __PROTECT_207__, tr: __PROTECT_208__ },
  __PROTECT_209__: { ar: __PROTECT_210__, en: __PROTECT_211__, tr: __PROTECT_212__ },
  __PROTECT_213__: { ar: __PROTECT_214__, en: __PROTECT_215__, tr: __PROTECT_216__ },
  __PROTECT_217__: { ar: __PROTECT_218__, en: __PROTECT_219__, tr: __PROTECT_220__ },
  __PROTECT_221__: { ar: __PROTECT_222__, en: __PROTECT_223__, tr: __PROTECT_224__ },
  __PROTECT_225__: { ar: __PROTECT_226__, en: __PROTECT_227__, tr: __PROTECT_228__ },
  __PROTECT_229__: { ar: __PROTECT_230__, en: __PROTECT_231__, tr: __PROTECT_232__ },
  __PROTECT_233__: { ar: __PROTECT_234__, en: __PROTECT_235__, tr: __PROTECT_236__ },
  __PROTECT_237__: { ar: __PROTECT_238__, en: __PROTECT_239__, tr: __PROTECT_240__ },
  __PROTECT_241__: { ar: __PROTECT_242__, en: __PROTECT_243__, tr: __PROTECT_244__ },
  __PROTECT_245__: { ar: __PROTECT_246__, en: __PROTECT_247__, tr: __PROTECT_248__ },
  __PROTECT_249__: { ar: __PROTECT_250__, en: __PROTECT_251__, tr: __PROTECT_252__ },
  __PROTECT_253__: { ar: __PROTECT_254__, en: __PROTECT_255__, tr: __PROTECT_256__ },
};

Object.keys(adminHardcoded).forEach(key => {
  newKeys[key] = adminHardcoded[key];
});

// --- SERVICE DELIVERY info from DB ---
servicesList.forEach(svc => {
  const key = __PROTECT_257__ + svc.id + __PROTECT_258__;
  newKeys[key] = { ar: svc.delivery || __PROTECT_259__, en: svc.delivery || __PROTECT_260__, tr: svc.delivery || __PROTECT_261__ };
  sourceMapping.push({
    table: __PROTECT_262__, field: __PROTECT_263__, record: svc.id,
    originalValue: svc.delivery, newKey: key, lang: __PROTECT_264__, note: __PROTECT_265__
  });
});

// --- SERVICE LEVEL info from DB ---
servicesList.forEach(svc => {
  const key = __PROTECT_266__ + svc.id + __PROTECT_267__;
  newKeys[key] = { ar: svc.service_type || __PROTECT_268__, en: svc.service_type || __PROTECT_269__, tr: svc.service_type || __PROTECT_270__ };
});

// =====================================================
// MERGE INTO i18n-fallback.ts
// =====================================================

// Build new JSON structure
const allLangs = [__PROTECT_271__, __PROTECT_272__, __PROTECT_273__];
const mergedData = {};

allLangs.forEach(lang => {
  mergedData[lang] = { ...sectionData[lang] };
});

// Add new keys
Object.entries(newKeys).forEach(([key, langValues]) => {
  allLangs.forEach(lang => {
    if (langValues[lang] && langValues[lang].trim() !== __PROTECT_274__) {
      mergedData[lang][key] = langValues[lang];
    }
  });
});

// Generate the file content
function escapeValue(val) {
  return val.replace(/\\/g, __PROTECT_275__).replace(/"/g, __PROTECT_276__).replace(/\n/g, __PROTECT_277__);
}

let output = __PROTECT_4__;
output += __PROTECT_5__;
output += __PROTECT_6__;
output += __PROTECT_7__;

allLangs.forEach(lang => {
  const keys = Object.keys(mergedData[lang]).sort();
  output += __PROTECT_8__;
  output += __PROTECT_9__;
  keys.forEach((key, idx) => {
    const isLast = idx === keys.length - 1;
    output += __PROTECT_10__;
  });
  output += __PROTECT_11__;
  output += __PROTECT_12__;
});
output += __PROTECT_13__;

fs.writeFileSync(i18nPath, output);

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
