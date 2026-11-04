const express = require('express')
const crypto = require('crypto')
const multer = require('multer')
const { authenticate, authorize } = require('../middleware/auth.middleware')
const supabase = require('../../config/supabase.config')
const router = express.Router()

const DIGITAL_PRODUCTS_BUCKET = process.env.DIGITAL_PRODUCTS_BUCKET || 'digital-products'

function isValidUuid(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(value || ''))
}

const storage = multer.memoryStorage()
const upload = multer({ storage, limits: { fileSize: 100 * 1024 * 1024 } })
const uploadMiddleware = (req, res, next) => {
  upload.single('file')(req, res, (error) => {
    if (!error) return next()
    if (error.code === 'LIMIT_FILE_SIZE') return res.status(400).json({ message: 'File exceeds the limit' })
    return res.status(400).json({ message: 'Invalid file upload' })
  })
}

router.get('/', async (req, res) => {
  try {
    const { data, error } = await supabase.from('digital_products').select('id, name, description, price, preview_url, thumbnail, category, downloads_count, created_at').eq('is_active', true).order('created_at', { ascending: false })
    if (error) throw error
    const sanitized = (data || []).map((item) => ({ id: item.id, name: item.name, description: item.description, price: item.price, preview_url: item.preview_url, thumbnail: item.thumbnail, category: item.category, downloads_count: item.downloads_count, created_at: item.created_at }))
    res.json(sanitized)
  } catch (err) {
    res.status(500).json({ message: 'Unable to complete request' })
  }
})

router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params
    if (!isValidUuid(id)) return res.status(400).json({ message: 'Invalid product id' })
    const { data, error } = await supabase.from('digital_products').select('id, name, description, price, preview_url, thumbnail, category, downloads_count, created_at').eq('id', id).eq('is_active', true).maybeSingle()
    if (error) throw error
    if (!data) return res.status(404).json({ message: 'Product not found' })
    const sanitized = { id: data.id, name: data.name, description: data.description, price: data.price, preview_url: data.preview_url, thumbnail: data.thumbnail, category: data.category, downloads_count: data.downloads_count, created_at: data.created_at }
    res.json(sanitized)
  } catch (err) {
    res.status(500).json({ message: 'Unable to complete request' })
  }
})

router.post('/', authenticate, authorize('admin', 'super_admin', 'manager'), async (req, res) => {
  try {
    const { name, description, price, file_url, thumbnail, category, storage_key } = req.body
    if (!name || price === undefined || price === null) return res.status(400).json({ message: 'Name and price are required' })
    const payload = { name, description: description || '', price, file_url: file_url || null, thumbnail: thumbnail || null, category: category || 'general', downloads_count: 0, is_active: true }
    if (storage_key !== undefined) payload.storage_key = storage_key
    const { data, error } = await supabase.from('digital_products').insert([payload]).select().single()
    if (error) throw error
    res.status(201).json(data)
  } catch (err) {
    res.status(400).json({ message: 'Invalid request' })
  }
})

router.post('/:id/upload', authenticate, authorize('admin', 'super_admin', 'manager'), uploadMiddleware, async (req, res) => {
  try {
    const { id } = req.params
    if (!isValidUuid(id)) return res.status(400).json({ message: 'Invalid product id' })
    if (!req.file) return res.status(400).json({ message: 'File is required' })
    const { data: product, error: productError } = await supabase.from('digital_products').select('id').eq('id', id).maybeSingle()
    if (productError) throw productError
    if (!product) return res.status(404).json({ message: 'Product not found' })
    const fileExt = req.file.originalname && req.file.originalname.includes('.') ? req.file.originalname.substring(req.file.originalname.lastIndexOf('.')) : ''
    const fileName = crypto.randomUUID() + fileExt
    const storageKey = 'digital-products/' + id + '/' + fileName
    const { error: uploadError } = await supabase.storage.from(DIGITAL_PRODUCTS_BUCKET).upload(storageKey, req.file.buffer, { contentType: req.file.mimetype, cacheControl: '3600', upsert: false })
    if (uploadError) throw uploadError
    const updatePayload = { storage_key: storageKey, file_mime_type: req.file.mimetype, file_size: req.file.size }
    const { data: updated, error: updateError } = await supabase.from('digital_products').update(updatePayload).eq('id', id).select().single()
    if (updateError) throw updateError
    res.json({ message: 'File uploaded successfully', storage_key: storageKey, product: updated })
  } catch (err) {
    res.status(500).json({ message: 'Unable to complete request' })
  }
})

router.get('/:id/download', authenticate, async (req, res) => {
  try {
    const { id } = req.params
    if (!isValidUuid(id)) return res.status(400).json({ message: 'Invalid product id' })
    const user = req.user
    const isStaff = user && ['admin', 'super_admin', 'manager', 'editor'].includes(user.role)
    const { data: product, error: productError } = await supabase.from('digital_products').select('id, name, storage_key, file_url, is_active').eq('id', id).maybeSingle()
    if (productError) throw productError
    if (!product || product.is_active === false) return res.status(404).json({ message: 'Product not found' })
    let hasAccess = false
    if (isStaff) {
      hasAccess = true
    } else {
      const { data: purchase, error: purchaseError } = await supabase.from('digital_product_purchases').select('id, payment_confirmed').eq('product_id', id).eq('user_id', user.id).maybeSingle()
      if (purchaseError) return res.status(403).json({ message: 'Not authorized to download this product' })
      if (purchase && purchase.payment_confirmed) hasAccess = true
    }
    if (!hasAccess) return res.status(403).json({ message: 'Not authorized to download this product' })
    const storageKey = product.storage_key
    if (!storageKey) return res.status(404).json({ message: 'File not found' })
    const { data: signed, error: signedError } = await supabase.storage.from(DIGITAL_PRODUCTS_BUCKET).createSignedUrl(storageKey, 60, { download: product.name })
    if (signedError || !signed?.signedUrl) throw signedError || new Error('Unable to create download URL')
    res.json({ url: signed.signedUrl, expires_in: 60 })
  } catch (err) {
    res.status(500).json({ message: 'Unable to complete request' })
  }
})

module.exports = router