/**
 * Final additions to master backup - captures remaining hardcoded content
 */
const fs = require('fs')
const path = require('path')

const ROOT = path.resolve(__dirname)
const masterPath = path.join(ROOT, 'database/seeds/_master_translations_backup.json')
const master = JSON.parse(fs.readFileSync(masterPath, 'utf8'))

function addKey(key, lang, value, source) {
  if (!value || typeof value !== 'string' || value.trim() === '') return
  const trimmed = value.trim()
  if (!master[key]) master[key] = {}
  if (!master[key][lang]) {
    master[key][lang] = []
  } else if (typeof master[key][lang] === 'string') {
    // Already resolved to string, convert to array for new additions
    master[key][lang] = [{ value: master[key][lang], source: 'existing' }]
  } else if (!Array.isArray(master[key][lang])) {
    master[key][lang] = []
  }
  master[key][lang].push({ value: trimmed, source })
}

// ===== PaymentPage.tsx hardcoded strings =====
// Line 568
addKey('payment.invoice_note', 'ar', 'سيتم إنشاء صفحة دفع آمنة عبر NOWPayments.', 'PaymentPage.tsx (hardcoded)')
addKey('payment.invoice_note', 'en', 'A secure payment page will be created via NOWPayments.', 'PaymentPage.tsx (hardcoded)')

// Line 611
addKey('payment.payment_created', 'ar', 'تم إنشاء عملية الدفع', 'PaymentPage.tsx (hardcoded)')
addKey('payment.payment_created', 'en', 'Payment created', 'PaymentPage.tsx (hardcoded)')

// Line 677
addKey('payment.address_copied', 'ar', 'تم نسخ العنوان', 'PaymentPage.tsx (hardcoded)')
addKey('payment.address_copied', 'en', 'Address copied', 'PaymentPage.tsx (hardcoded)')

// Line 819
addKey('payment.file_uploaded', 'ar', 'تم الرفع', 'PaymentPage.tsx (hardcoded)')
addKey('payment.file_uploaded', 'en', 'Uploaded', 'PaymentPage.tsx (hardcoded)')

// ===== VerifyEmailPage.tsx =====
// Line 30
addKey('verify_email.error_ar', 'ar', 'حدث خطأ أثناء تأكيد البريد الإلكتروني.', 'VerifyEmailPage.tsx (hardcoded)')

// Line 35
addKey('verify_email.success_ar', 'ar', 'تم تأكيد بريدك الإلكتروني بنجاح.', 'VerifyEmailPage.tsx (hardcoded)')

// Line 59
addKey('verify_email.confirmed_title', 'ar', 'تم التأكيد', 'VerifyEmailPage.tsx (hardcoded)')
addKey('verify_email.confirmed_title', 'en', 'Confirmed', 'VerifyEmailPage.tsx (hardcoded)')

// Line 68
addKey('verify_email.failed_title', 'ar', 'فشل التأكيد', 'VerifyEmailPage.tsx (hardcoded)')
addKey('verify_email.failed_title', 'en', 'Verification failed', 'VerifyEmailPage.tsx (hardcoded)')

// ===== AdminPanel.tsx invoice hardcoded Arabic =====
// Lines 2127-2139
addKey('order.status.ar.new', 'ar', 'جديد', 'AdminPanel.tsx (hardcoded)')
addKey('order.status.ar.processing', 'ar', 'قيد التنفيذ', 'AdminPanel.tsx (hardcoded)')
addKey('order.status.ar.completed', 'ar', 'مكتمل', 'AdminPanel.tsx (hardcoded)')
addKey('order.status.ar.cancelled', 'ar', 'ملغي', 'AdminPanel.tsx (hardcoded)')
addKey('order.status.ar.refunded', 'ar', 'مسترد', 'AdminPanel.tsx (hardcoded)')

// Line 566
addKey('admin.invoice_load_error', 'en', 'Unable to load the invoice. Please try again.', 'AdminPanel.tsx (hardcoded)')
addKey('admin.invoice_load_error', 'ar', '❌ فشل تحميل الفاتورة. يرجى المحاولة مرة أخرى.', 'AdminPanel.tsx (hardcoded)')

// ===== LoginPage.tsx =====
// Line 90-91
addKey('auth.full_name', 'ar', 'الاسم الكامل', 'LoginPage.tsx (hardcoded)')
addKey('auth.full_name', 'en', 'Full name', 'LoginPage.tsx (hardcoded)')

// ===== Header.tsx / Footer.tsx =====
// aria-labels with BİŞİŞ (brand only, but let's capture the accessible names)
addKey('brand.name', 'ar', 'BİŞIŞ', 'frontend (brand name across components)')
addKey('brand.name', 'en', 'BİŞIŞ', 'frontend (brand name across components)')
addKey('brand.name', 'tr', 'BİŞIŞ', 'frontend (brand name across components)')

// ===== ContactPage / AboutPage if they exist =====
const contactPath = path.join(ROOT, 'frontend/src/pages/ContactPage.tsx')
if (fs.existsSync(contactPath)) {
  const content = fs.readFileSync(contactPath, 'utf8')
  // Extract any hardcoded strings
  const arabicStrings = content.match(/['"`]([^'""]*[\u0600-\u06FF\u0750-\u077F][^'""]*)['""]/g) || []
  arabicStrings.forEach((s, i) => {
    const text = s.slice(1, -1)
    if (text.length > 2 && !text.includes('BİŞIŞ') && !text.startsWith('/')) {
      addKey(`contact.hardcoded.${i}`, 'ar', text, 'ContactPage.tsx')
    }
  })
}

// ===== Client360Page =====
const client360Path = path.join(ROOT, 'frontend/src/pages/Client360Page.tsx')
if (fs.existsSync(client360Path)) {
  const content = fs.readFileSync(client360Path, 'utf8')
  const lines = content.split('\n')
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    // Look for hardcoded Arabic strings in context
    const arabicStrings = [...line.matchAll(/['`]([^'']*[\u0600-\u06FF\u0750-\u077F][^'']*)['`]/g)]
    for (const m of arabicStrings) {
      const text = m[1].trim()
      if (text.length > 3 && !text.includes('BİŞIŞ') && !text.includes('${') && !text.startsWith('/')) {
        addKey(`client360.hardcoded.${i}`, 'ar', text, 'Client360Page.tsx')
      }
    }
  }
}

// ===== Scan for any remaining t() fallback values from coverage report =====
const coveragePath = path.join(ROOT, 'database/seeds/_master_coverage_report.json')
const coverage = JSON.parse(fs.readFileSync(coveragePath, 'utf8'))
const fallbacks = coverage.coverage.t_fallbacks_detail || []

// Add all fallback values as their respective languages
for (const fb of fallbacks) {
  const key = fb.key
  if (!key) continue
  
  // Determine language: if fallback contains Arabic chars, it's ar; otherwise en
  const hasArabic = /[\u0600-\u06FF\u0750-\u077F]/.test(fb.fallback)
  const hasTurkish = /[ÇĞİçğıİŞşÜüÖö]/.test(fb.fallback)
  
  if (!master[key]) {
    addKey(key, hasArabic ? 'ar' : hasTurkish ? 'tr' : 'en', fb.fallback, `${fb.location} (fallback)`)
  } else {
    // If key exists but missing this language
    const lang = hasArabic ? 'ar' : hasTurkish ? 'tr' : 'en'
    if (!master[key][lang]) {
      addKey(key, lang, fb.fallback, `${fb.location} (fallback)`)
    }
  }
}

// ===== RESOLVE AND WRITE =====
console.log('=== RESOLVING AND WRITING MASTER FILE ===')

const conflicts = []
const duplicates = []
const finalMaster = {}

for (const [key, langs] of Object.entries(master)) {
  finalMaster[key] = {}
  for (const lang of ['ar', 'en', 'tr']) {
    const entries = langs[lang]
    if (!entries || (Array.isArray(entries) && entries.length === 0)) continue
    if (!Array.isArray(entries)) continue // Skip conflict objects
    
    if (entries.length === 1) {
      finalMaster[key][lang] = entries[0].value
    } else {
      const uniqueValues = new Set(entries.map(e => e.value))
      if (uniqueValues.size === 1) {
        duplicates.push({ key, lang, sources: entries.map(e => e.source) })
        finalMaster[key][lang] = entries[0].value
      } else {
        conflicts.push({ key, lang, versions: entries })
        finalMaster[key][lang] = { _conflict: true, versions: entries }
      }
    }
  }
}

fs.writeFileSync(masterPath, JSON.stringify(finalMaster, null, 2))
const tsPath = masterPath.replace('.json', '.ts')
const tsContent = `// AUTO-GENERATED MASTER BACKUP - DO NOT EDIT MANUALLY\n// Total keys: ${Object.keys(finalMaster).length}\nexport type SupportedLanguage = 'ar' | 'en' | 'tr'\nexport const masterTranslations = ${JSON.stringify(finalMaster, null, 2)}\n`
fs.writeFileSync(tsPath, tsContent)

console.log('\n=== FINAL MASTER BACKUP SUMMARY ===')
console.log(`Total unique keys: ${Object.keys(finalMaster).length}`)
console.log(`AR: ${Object.values(finalMaster).filter(v => v.ar).length}`)
console.log(`EN: ${Object.values(finalMaster).filter(v => v.en).length}`)
console.log(`TR: ${Object.values(finalMaster).filter(v => v.tr).length}`)
console.log(`Keys with all 3: ${Object.values(finalMaster).filter(v => v.ar && v.en && v.tr).length}`)
console.log(`Keys with 2 langs: ${Object.values(finalMaster).filter(v => Object.keys(v).length === 2).length}`)
console.log(`Keys with 1 lang: ${Object.values(finalMaster).filter(v => Object.keys(v).length === 1).length}`)
console.log(`Conflicts: ${conflicts.length}`)
console.log(`Duplicates: ${duplicates.length}`)

// Verify key categories
console.log('\n=== KEY CATEGORIES ===')
const categories = {}
for (const key of Object.keys(finalMaster)) {
  const prefix = key.split('.')[0]
  categories[prefix] = (categories[prefix] || 0) + 1
}
for (const [prefix, count] of Object.entries(categories).sort((a, b) => b[1] - a[1])) {
  console.log(`  ${prefix}: ${count}`)
}
