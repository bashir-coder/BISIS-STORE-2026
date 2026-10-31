const express = require('express')
const { authenticate, authorize } = require('../middleware/auth.middleware')
const supabase = require('../../config/supabase.config')
const router = express.Router()

router.get('/', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('blog_posts')
      .select('*')
      .eq('status', 'published')
      .order('published_at', { ascending: false })

    if (error) throw error
    res.json(data || [])
  } catch (err) {
    res.status(500).json({ message: 'Unable to complete request' })
  }
})

router.get('/:slug', async (req, res) => {
  try {
    const { slug } = req.params
    const { data, error } = await supabase
      .from('blog_posts')
      .select('*')
      .eq('slug', slug)
      .single()

    if (error) throw error
    if (!data) return res.status(404).json({ message: 'Article not found' })


    await supabase
      .from('blog_posts')
      .update({ views: (data.views || 0) + 1 })
      .eq('id', data.id)

    res.json(data)
  } catch (err) {
    res.status(500).json({ message: 'Unable to complete request' })
  }
})

router.post('/', authenticate, authorize('admin', 'super_admin'), async (req, res) => {
  try {
    const { title, slug, content, excerpt, cover_image, tags, status } = req.body

    if (!title || !slug || !content) {
      return res.status(400).json({ message: 'Title, slug, and content are required' })
    }

    const { data, error } = await supabase
      .from('blog_posts')
      .insert([{
        title,
        slug,
        content,
        excerpt: excerpt || '',
        cover_image: cover_image || null,
        author_id: req.user.id,
        tags: tags || [],
        status: status || 'draft',
        published_at: status === 'published' ? new Date().toISOString() : null
      }])
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
    const { title, content, excerpt, cover_image, tags, status } = req.body

    const updateData = {}
    if (title) updateData.title = title
    if (content) updateData.content = content
    if (excerpt !== undefined) updateData.excerpt = excerpt
    if (cover_image !== undefined) updateData.cover_image = cover_image
    if (tags) updateData.tags = tags
    if (status) {
      updateData.status = status
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
