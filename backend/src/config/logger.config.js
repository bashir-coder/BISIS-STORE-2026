const winston = require('winston')
const path = require('path')

// تحديد مستوى التسجيل حسب البيئة
const level = process.env.LOG_LEVEL || (process.env.NODE_ENV === 'production' ? 'info' : 'debug')

// تنسيق السجلات
const format = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.splat(),
  winston.format.json()
)

// نقل إلى Console مع تنسيق جميل في التطوير
const transports = [
  new winston.transports.Console({
    format: winston.format.combine(
      winston.format.colorize(),
      winston.format.printf(({ timestamp, level, message, ...meta }) => {
        const metaStr = Object.keys(meta).length ? `\n${JSON.stringify(meta, null, 2)}` : ''
        return `[${timestamp}] ${level}: ${message}${metaStr}`
      })
    )
  })
]

// في الإنتاج، نكتب الملفات أيضاً
if (process.env.NODE_ENV === 'production') {
  transports.push(
    new winston.transports.File({
      filename: path.join(__dirname, '../../logs/error.log'),
      level: 'error',
      maxsize: 5242880, // 5MB
      maxFiles: 5,
    }),
    new winston.transports.File({
      filename: path.join(__dirname, '../../logs/combined.log'),
      maxsize: 5242880,
      maxFiles: 5,
    })
  )
}

const logger = winston.createLogger({
  level,
  format,
  transports,
  exitOnError: false,
})

// دالة مساعدة لإنشاء Logger مع Context
const createLogger = (context) => {
  return {
    info: (message, meta = {}) => logger.info(`[${context}] ${message}`, meta),
    error: (message, meta = {}) => logger.error(`[${context}] ${message}`, meta),
    warn: (message, meta = {}) => logger.warn(`[${context}] ${message}`, meta),
    debug: (message, meta = {}) => logger.debug(`[${context}] ${message}`, meta),
  }
}

module.exports = { logger, createLogger }