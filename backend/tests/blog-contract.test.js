const express = require('express')
const request = require('supertest')

jest.mock('../src/api/middleware/auth.middleware', () => ({
  authenticate: (req, _res, next) => {
    const role = req.get('x-test-role') || 'client'
    req.user = { id: `${role}-1`, role }
    next()
  },
  authorize: (...roles) => (req, res, next) => (
    roles.includes(req.user?.role)
      ? next()
      : res.status(403).json({ message: 'Insufficient permissions' })
  ),
}))

jest.mock('../src/config/supabase.config', () => ({
  from: jest.fn(),
}))

const supabase = require('../src/config/supabase.config')
const router = require('../src/api/routes/blog.routes')

const app = express()
app.use(express.json())
app.use('/blog', router)

const publishedPost = {
  id: '123e4567-e89b-42d3-a456-426614174000',
  slug: 'published-post',
  title: { en: 'Published', tr: 'Yayında' },
  excerpt: { en: 'Intro' },
  content: { en: 'Body' },
  category: 'news',
  cover_image: null,
  published_at: '2026-01-01T00:00:00.000Z',
  read_time: 5,
  is_active: true,
  views: 999,
  author_id: 'internal-author-id',
  status: 'published',
}

const createQuery = (result) => {
  const calls = { filters: [], selection: null, insert: null, update: null, deleted: false }
  const query = {
    select: jest.fn((fields) => {
      calls.selection = fields
      return query
    }),
    eq: jest.fn((field, value) => {
      calls.filters.push([field, value])
      return query
    }),
    order: jest.fn(() => query),
    insert: jest.fn((rows) => {
      calls.insert = rows
      return query
    }),
    update: jest.fn((values) => {
      calls.update = values
      return query
    }),
    delete: jest.fn(() => {
      calls.deleted = true
      return query
    }),
    single: jest.fn(async () => result),
    maybeSingle: jest.fn(async () => result),
    then: (resolve, reject) => Promise.resolve(result).then(resolve, reject),
    calls,
  }
  return query
}

describe('blog posts follow the local schema and publication contract', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  test('lists active posts using existing schema fields and omits internal fields', async () => {
    const query = createQuery({ data: [publishedPost], error: null })
    supabase.from.mockReturnValue(query)

    const response = await request(app).get('/blog')

    expect(response.status).toBe(200)
    expect(query.calls.filters).toContainEqual(['is_active', true])
    expect(query.calls.selection).not.toMatch(/status|views|author_id/)
    expect(response.body[0]).toMatchObject({
      slug: publishedPost.slug,
      title: publishedPost.title,
      content: publishedPost.content,
    })
    expect(response.body[0]).not.toHaveProperty('views')
    expect(response.body[0]).not.toHaveProperty('author_id')
    expect(response.body[0]).not.toHaveProperty('status')
  })

  test('hides drafts from public slug lookup', async () => {
    const query = createQuery({ data: null, error: null })
    supabase.from.mockReturnValue(query)

    const response = await request(app).get('/blog/draft-post')

    expect(response.status).toBe(404)
    expect(query.calls.filters).toEqual([
      ['slug', 'draft-post'],
      ['is_active', true],
    ])
  })

  test('stores localized JSON content and maps draft status to is_active', async () => {
    const query = createQuery({ data: { ...publishedPost, is_active: false }, error: null })
    supabase.from.mockReturnValue(query)
    const title = { en: 'Draft', tr: 'Taslak' }
    const content = { en: 'Draft body', tr: 'Taslak metni' }

    const response = await request(app)
      .post('/blog')
      .set('x-test-role', 'admin')
      .send({ title, slug: 'draft-post', content, status: 'draft', views: 500 })

    expect(response.status).toBe(201)
    expect(query.calls.insert).toEqual([expect.objectContaining({
      title,
      slug: 'draft-post',
      content,
      is_active: false,
    })])
    expect(query.calls.insert[0]).not.toHaveProperty('status')
    expect(query.calls.insert[0]).not.toHaveProperty('views')
    expect(query.calls.insert[0]).not.toHaveProperty('author_id')
  })

  test('rejects invalid publication status and non-admin writes', async () => {
    const invalidStatus = await request(app)
      .post('/blog')
      .set('x-test-role', 'admin')
      .send({ title: 'Title', slug: 'valid-slug', content: 'Body', status: 'active' })
    expect(invalidStatus.status).toBe(400)
    expect(supabase.from).not.toHaveBeenCalled()

    const unauthorized = await request(app)
      .post('/blog')
      .set('x-test-role', 'client')
      .send({ title: 'Title', slug: 'valid-slug', content: 'Body' })
    expect(unauthorized.status).toBe(403)
    expect(supabase.from).not.toHaveBeenCalled()
  })

  test('maps publishing and unpublishing to the schema publication flag', async () => {
    const query = createQuery({ data: publishedPost, error: null })
    supabase.from.mockReturnValue(query)

    const response = await request(app)
      .put('/blog/published-post')
      .set('x-test-role', 'admin')
      .send({ status: 'published', title: { en: 'Updated' } })

    expect(response.status).toBe(200)
    expect(query.calls.update).toMatchObject({
      is_active: true,
      title: { en: 'Updated' },
    })
    expect(query.calls.update).not.toHaveProperty('status')
  })
})
