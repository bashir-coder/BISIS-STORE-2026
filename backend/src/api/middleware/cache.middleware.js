// backend/src/api/middleware/cache.middleware.js
const { logger } = require('../../config/logger.config')
const cacheStore = new Map()

const cache = (duration = 60) => {
  return (req, res, next) => {
    if (req.method !== 'GET') {
      return next()
    }

    const key = `cache:${req.originalUrl || req.url}`
    const cached = cacheStore.get(key)
    if (cached) {
      const { data, timestamp } = cached
      if (Date.now() - timestamp < duration * 1000) {
        logger.debug(`Cache hit: ${req.path}`)
        return res.json(data)
      } else {
        cacheStore.delete(key)
        logger.debug(`Cache expired: ${req.path}`)
      }
    }

    const originalJson = res.json.bind(res)
    res.json = (body) => {
      cacheStore.set(key, { data: body, timestamp: Date.now() })
      logger.debug(`Cache stored: ${req.path}`)
      return originalJson(body)
    }

    next()
  }
}

const clearCache = (pattern) => {
  if (!pattern) {
    cacheStore.clear()
    logger.debug('All cache cleared')
    return
  }
  for (const key of cacheStore.keys()) {
    if (key.includes(pattern)) {
      cacheStore.delete(key)
      logger.debug('Cache cleared')
    }
  }
}

// ✅ تصدير الدالة مباشرة
module.exports = cache
// ✅ تصدير clearCache كخاصية إضافية
module.exports.clearCache = clearCache