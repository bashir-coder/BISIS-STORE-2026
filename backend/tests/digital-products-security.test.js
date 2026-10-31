const express = require('express')
const request = require('supertest')

jest.mock('../src/config/supabase.config', () => ({
  from: jest.fn(),
}))

const supabase = require('../src/config/supabase.config')
const router = require('../src/api/routes/digital-products.routes')

const app = express()
app.use(express.json())
app.use('/products', router)

const productId = '123e4567-e89b-42d3-a456-426614174000'
const product = {
  id: productId,
  name: 'Public product',
  description: 'Public description',
  price: 29,
  preview_url: 'https://example.test/preview',
  thumbnail: 'https://example.test/thumbnail',
  category: 'guide',
  downloads_count: 0,
  created_at: '2026-01-01T00:00:00.000Z',
  file_url: 'private-storage-path',
  storage_key: 'private-storage-key',
  is_active: true,
}

const createQuery = (result) => {
  const calls = { filters: [], selection: null }
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
    maybeSingle: jest.fn(async () => result),
    then: (resolve, reject) => Promise.resolve(result).then(resolve, reject),
    calls,
  }
  return query
}

describe('public digital product catalog', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  test('lists active products without returning private file fields', async () => {
    const query = createQuery({ data: [product], error: null })
    supabase.from.mockReturnValue(query)

    const response = await request(app).get('/products')

    expect(response.status).toBe(200)
    expect(response.body).toEqual([{
      id: productId,
      name: product.name,
      description: product.description,
      price: product.price,
      preview_url: product.preview_url,
      thumbnail: product.thumbnail,
      category: product.category,
      downloads_count: product.downloads_count,
      created_at: product.created_at,
    }])
    expect(query.calls.filters).toContainEqual(['is_active', true])
    expect(query.calls.selection).not.toMatch(/file_url|storage_key/)
  })

  test('does not return an inactive product by id', async () => {
    const query = createQuery({ data: null, error: null })
    supabase.from.mockReturnValue(query)

    const response = await request(app).get(`/products/${productId}`)

    expect(response.status).toBe(404)
    expect(query.calls.filters).toEqual([
      ['id', productId],
      ['is_active', true],
    ])
  })

  test('rejects malformed product identifiers before querying the database', async () => {
    const response = await request(app).get('/products/not-a-uuid')

    expect(response.status).toBe(400)
    expect(supabase.from).not.toHaveBeenCalled()
  })

  test('does not expose internal database error details', async () => {
    const query = createQuery({ data: null, error: new Error('internal database detail') })
    supabase.from.mockReturnValue(query)

    const response = await request(app).get(`/products/${productId}`)

    expect(response.status).toBe(500)
    expect(response.body).toEqual({ message: 'Unable to complete request' })
    expect(JSON.stringify(response.body)).not.toContain('internal database detail')
  })
})
