const fs = require('fs')
const path = require('path')
const dotenv = require('dotenv')
const { createClient } = require('@supabase/supabase-js')

dotenv.config({ path: path.resolve(__dirname, '../../.env') })

const supabaseUrl = process.env.SUPABASE_URL
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!supabaseUrl || !serviceRoleKey) {
  throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required to run the seed')
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false },
  db: { schema: 'public' },
})

const seedsDir = path.resolve(__dirname, '../../database/seeds')
const readJson = (fileName) => JSON.parse(fs.readFileSync(path.join(seedsDir, fileName), 'utf8'))

const flattenServices = () => {
  const source = readJson('services.json')
  return source.categories.flatMap((category) => category.services.map((service) => ({
    source_id: service.id,
    name: service.name,
    description: service.description,
    category: category.id,
    level: ['Starter', 'Growth', 'Investor-Ready'][Number(service.level) - 1] || 'Starter',
    price: service.price,
    duration_days: null,
    is_active: true,
    metadata: {
      source_id: service.id,
      category_name: category.name,
      delivery: service.delivery,
      billing_period: service.billing_period || null,
      service_type: service.service_type || 'one_time',
    },
    persona_ids: [],
    requirements: null,
    prompt: null,
    name_en: service.name,
    name_tr: service.name,
    description_en: `${service.name} — a focused BİŞIŞ service for ${category.name}.`,
    description_tr: `${service.name} — ${category.name} alanında odaklı bir BİŞIŞ hizmeti.`,
  })))
}

const ensureServices = async () => {
  const desired = flattenServices()
  const { data: existing, error: readError } = await supabase.from('services').select('id, metadata')
  if (readError) throw readError
  const existingBySourceId = new Map((existing || []).map((row) => [row.metadata?.source_id, row.id]).filter(([sourceId]) => sourceId))
  let inserted = 0
  let updated = 0
  for (const row of desired) {
    const existingId = existingBySourceId.get(row.source_id)
    const payload = { ...row, metadata: { ...row.metadata, source_id: row.source_id } }
    delete payload.source_id
    if (existingId) {
      const { error } = await supabase.from('services').update({ ...payload, updated_at: new Date().toISOString() }).eq('id', existingId)
      if (error) throw error
      updated += 1
    } else {
      const { error } = await supabase.from('services').insert([payload])
      if (error) throw error
      inserted += 1
    }
  }
  const officialIds = new Set(desired.map((row) => row.source_id))
  const legacyIds = (existing || []).filter((row) => !officialIds.has(row.metadata?.source_id)).map((row) => row.id)
  if (legacyIds.length) {
    const { error } = await supabase.from('services').update({ is_active: false, updated_at: new Date().toISOString() }).in('id', legacyIds)
    if (error) throw error
  }
  return { inserted, updated, archived: legacyIds.length, total: desired.length }
}

const ensurePackages = async () => {
  const rows = readJson('packages.json')
  const { data, error } = await supabase.from('packages').upsert(rows, { onConflict: 'slug' }).select('id, slug')
  if (error) throw error
  const desiredSlugs = new Set(rows.map((row) => row.slug))
  const { data: activePackages, error: activeError } = await supabase.from('packages').select('id, slug').eq('is_active', true)
  if (activeError) throw activeError
  const legacyIds = (activePackages || []).filter((row) => !desiredSlugs.has(row.slug)).map((row) => row.id)
  if (legacyIds.length) {
    const { error: archiveError } = await supabase.from('packages').update({ is_active: false, updated_at: new Date().toISOString() }).in('id', legacyIds)
    if (archiveError) throw archiveError
  }
  return { upserted: data?.length || rows.length, archived: legacyIds.length }
}

const ensurePersonas = async () => {
  const rows = readJson('personas.json')
  const { data, error } = await supabase.from('personas').upsert(rows, { onConflict: 'slug' }).select('id, slug')
  if (error) throw error
  return { upserted: data?.length || rows.length }
}

const ensureTranslations = async () => {
  const source = readJson('translations.json')
  const rows = source.flatMap((item) => ['ar', 'en', 'tr'].map((lang) => ({
    lang,
    ns: 'common',
    key: item.key,
    value: item[lang],
  })))
  const { data: existing, error: readError } = await supabase.from('translations').select('lang, ns, key')
  if (readError) throw readError
  const existingKeys = new Set((existing || []).map((row) => `${row.lang}:${row.ns}:${row.key}`))
  const missing = rows.filter((row) => !existingKeys.has(`${row.lang}:${row.ns}:${row.key}`))
  if (missing.length === 0) return { inserted: 0, existing: rows.length }
  const { error } = await supabase.from('translations').insert(missing)
  if (error) throw error
  return { inserted: missing.length, existing: rows.length - missing.length }
}

const ensureFaqs = async () => {
  const rows = readJson('faqs.json')
  const { data: existing, error: readError } = await supabase.from('faqs').select('id, question')
  if (readError) throw readError
  const existingQuestions = new Set((existing || []).map((row) => JSON.stringify(row.question)))
  const missing = rows.filter((row) => !existingQuestions.has(JSON.stringify(row.question)))
  if (missing.length === 0) return { inserted: 0, existing: rows.length }
  const { error } = await supabase.from('faqs').insert(missing)
  if (error) throw error
  return { inserted: missing.length, existing: rows.length - missing.length }
}

const countRows = async (table) => {
  const { count, error } = await supabase.from(table).select('id', { count: 'exact', head: true })
  if (error) throw error
  return count || 0
}

const main = async () => {
  console.log('BISIS seed started')
  const services = await ensureServices()
  const packages = await ensurePackages()
  const personas = await ensurePersonas()
  const faqs = await ensureFaqs()
  const translations = await ensureTranslations()
  const counts = {}
  for (const table of ['services', 'packages', 'personas', 'faqs', 'translations']) counts[table] = await countRows(table)
  console.log(JSON.stringify({ services, packages, personas, faqs, translations, counts }, null, 2))
  console.log('BISIS seed completed')
}

main().catch((error) => {
  console.error('BISIS seed failed:', error.message)
  process.exitCode = 1
})
