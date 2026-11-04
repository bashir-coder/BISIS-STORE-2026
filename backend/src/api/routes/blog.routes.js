const express = require('express')
const { authenticate, authorize } = require('../middleware/auth.middleware')
const supabase = require('../../config/supabase.config')
const router = express.Router()

router.get('/', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('blog_posts')
      .select('id, slug, title, excerpt, content, category, cover_image, published_at, read_time')
      .eq('is_active', true)
      .order('published_at', { ascending: false })

    if (error) throw error
    const sanitized = (data || []).map((post) => ({
      id: post.id,
      slug: post.slug,
      title: post.title,
      excerpt: post.excerpt,
      content: post.content,
      category: post.category,
      cover_image: post.cover_image,
      published_at: post.published_at,
      read_time: post.read_time,
    }))
    res.json(sanitized)
  } catch (err) {
    res.status(500).json({ message: 'Unable to complete request' })
  }
})

router.get('/:slug', async (req, res) => {
  try {
    const { slug } = req.params
    const { data, error } = await supabase
      .from('blog_posts')
      .select('id, slug, title, excerpt, content, category, cover_image, published_at, read_time')
      .eq('slug', slug)
      .eq('is_active', true)
      .maybeSingle()

    if (error) throw error
    if (!data) return res.status(404).json({ message: 'Article not found' })

    res.json(data)
  } catch (err) {
    res.status(500).json({ message: 'Unable to complete request' })
  }
})

router.post('/', authenticate, authorize('admin', 'super_admin'), async (req, res) => {
  try {
    const { title, slug, content, excerpt, cover_image, status } = req.body

    if (!title || !slug || !content) {
      return res.status(400).json({ message: 'Title, slug, and content are required' })
    }

    if (status !== undefined && !['draft', 'published'].includes(status)) {
      return res.status(400).json({ message: 'Invalid publication status' })
    }

    const isActive = status === 'published'

    const insertData = {
      title,
      slug,
      content,
      excerpt: excerpt || '',
      cover_image: cover_image || null,
      is_active: isActive
    }

    if (isActive) {
      insertData.published_at = new Date().toISOString()
    }

    const { data, error } = await supabase
      .from('blog_posts')
      .insert([insertData])
      .select()
      .single()

    if (error) throw error
    res.status(201).json(data)
  } catch (err) {
    res.status(400).json({ message: 'Invalid request' })
  }
})

router.put('/:slug', authenticate, authorize('admin', 'super_admin'), async (req, res) => {
  try {
    const { slug } = req.params
    const { title, content, excerpt, cover_image, status } = req.body

    const updateData = {}
    if (title !== undefined) updateData.title = title
    if (content !== undefined) updateData.content = content
    if (excerpt !== undefined) updateData.excerpt = excerpt
    if (cover_image !== undefined) updateData.cover_image = cover_image
    if (status !== undefined) {
      if (!['draft', 'published'].includes(status)) {
        return res.status(400).json({ message: 'Invalid publication status' })
      }
      updateData.is_active = status === 'published'
      if (status === 'published') {
        updateData.published_at = new Date().toISOString()
      }
    }

    const { data, error } = await supabase
      .from('blog_posts')
      .update(updateData)
      .eq('slug', slug)
      .select()
      .single()

    if (error) throw error
    if (!data) return res.status(404).json({ message: 'Article not found' })
    res.json(data)
  } catch (err) {
    res.status(400).json({ message: 'Invalid request' })
  }
})

router.delete('/:slug', authenticate, authorize('admin', 'super_admin'), async (req, res) => {
  try {
    const { slug } = req.params
    const { error } = await supabase
      .from('blog_posts')
      .delete()
      .eq('slug', slug)

    if (error) throw error
    res.json({ message: 'Article deleted successfully' })
  } catch (err) {
    res.status(400).json({ message: 'Invalid request' })
  }
})

module.exports = router
