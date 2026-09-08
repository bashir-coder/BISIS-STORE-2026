const path = require('path')
require('dotenv').config({
  path: path.resolve(__dirname, '../.env'),
})

const express = require('express')
const cors = require('cors')
const helmet = require('helmet')
const morgan = require('morgan')
const compression = require('compression')
const rateLimit = require('express-rate-limit')
const http = require('http')
const crypto = require('crypto')
const { Server } = require('socket.io')

const supabase = require('./src/config/supabase.config')
const { logger } = require('./src/config/logger.config')
const setupSwagger = require('./src/config/swagger.config')
const {
  authorizeConversationAccess,
} = require('./src/api/utils/conversation-access')
const {
  findOrProvisionUser,
} = require('./src/api/middleware/auth.middleware')
const {
  verifyRecaptcha,
} = require('./src/api/middleware/recaptcha.middleware')
const backendPackage = require('./package.json')

const app = express()
const server = http.createServer(app)
const PORT = process.env.PORT || 5000

// ============================================================
// Trust Proxy
// ============================================================

const configuredTrustProxy =
  process.env.TRUST_PROXY_HOPS

const trustProxyHops =
  configuredTrustProxy === undefined ||
  configuredTrustProxy === ''
    ? process.env.NODE_ENV === 'production'
      ? 1
      : 0
    : Number(configuredTrustProxy)

if (
  !Number.isInteger(trustProxyHops) ||
  trustProxyHops < 0 ||
  trustProxyHops > 5
) {
  throw new Error(
    'TRUST_PROXY_HOPS must be an integer between 0 and 5',
  )
}

app.set('trust proxy', trustProxyHops)

// ============================================================
// CORS
// ============================================================

const configuredOrigins = String(
  process.env.ALLOWED_ORIGINS || '',
)
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean)

if (
  process.env.NODE_ENV === 'production' &&
  configuredOrigins.length === 0
) {
  throw new Error(
    'ALLOWED_ORIGINS is required in production',
  )
}

const allowedOrigins =
  configuredOrigins.length > 0
    ? configuredOrigins
    : [
        'http://localhost:3000',
        'http://127.0.0.1:3000',
      ]

app.use(
  cors({
    origin: function (origin, callback) {
      if (!origin) {
        return callback(null, true)
      }

      if (allowedOrigins.includes(origin)) {
        return callback(null, true)
      }

      const corsError = new Error(
        'Origin is not allowed',
      )

      corsError.status = 403
      corsError.expose = true

      return callback(corsError)
    },
    credentials: true,
    exposedHeaders: ['Content-Disposition'],
  }),
)

// ============================================================
// Cross-Origin Opener Policy
// ============================================================

app.use((req, res, next) => {
  res.setHeader(
    'Cross-Origin-Opener-Policy',
    'same-origin-allow-popups',
  )

  next()
})

// ============================================================
// Security Headers
// ============================================================

app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],

        scriptSrc: [
          "'self'",
          "'unsafe-inline'",
          'https://www.google.com',
          'https://www.gstatic.com',
        ],

        styleSrc: [
          "'self'",
          "'unsafe-inline'",
        ],

        imgSrc: [
          "'self'",
          'data:',
          'https://*.supabase.co',
        ],

        connectSrc: [
          "'self'",
          'https://*.supabase.co',
          'https://api.openai.com',
          'https://www.google.com',
          'https://api.nowpayments.io',
        ],

        fontSrc: [
          "'self'",
          'https://fonts.gstatic.com',
        ],

        frameSrc: [
          "'self'",
          'https://www.google.com',
        ],
      },
    },

    crossOriginEmbedderPolicy: true,

    crossOriginOpenerPolicy: {
      policy: 'same-origin-allow-popups',
    },

    crossOriginResourcePolicy: {
      policy: 'cross-origin',
    },
  }),
)

// ============================================================
// Compression
// ============================================================

app.use(compression())

// ============================================================
// Request ID
// ============================================================

app.use((req, res, next) => {
  const incomingRequestId = String(
    req.get('x-request-id') || '',
  ).trim()

  const requestId =
    /^[A-Za-z0-9._:-]{1,100}$/.test(
      incomingRequestId,
    )
      ? incomingRequestId
      : crypto.randomUUID()

  req.requestId = requestId

  res.setHeader(
    'X-Request-Id',
    requestId,
  )

  next()
})

// ============================================================
// Body Parsing
// ============================================================

app.use(
  express.json({
    limit: '10mb',
  }),
)

app.use(
  express.urlencoded({
    extended: true,
    limit: '10mb',
  }),
)

// ============================================================
// Logging
// ============================================================

app.use(
  morgan('combined', {
    stream: {
      write: (message) => {
        logger.info(message.trim())
      },
    },
  }),
)

// ============================================================
// Rate Limiting
// ============================================================

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,

  message: {
    message:
      'Too many requests, please try again later.',
  },
})

app.use('/api/', limiter)

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,

  message: {
    message:
      'Too many login attempts, please try again later.',
  },
})

app.use(
  '/api/auth/login',
  authLimiter,
)

// ============================================================
// Security / reCAPTCHA v3
// ============================================================

app.post(
  '/api/security/verify-recaptcha',
  verifyRecaptcha,
  (_req, res) => {
    return res.status(200).json({
      success: true,
      message:
        'Security verification successful',
    })
  },
)

// ============================================================
// NOWPayments IPN
// ============================================================

// Main IPN endpoint
app.use(
  '/api/nowpayments/ipn',
  require('./src/api/routes/nowpayments.routes'),
)

// Compatibility endpoint used by the order payment flow
app.use(
  '/api/orders/:id/nowpayments-ipn',
  require('./src/api/routes/nowpayments.routes'),
)

// ============================================================
// Routes
// ============================================================

app.use(
  '/api/auth',
  require('./src/api/routes/auth.routes'),
)

app.use(
  '/api/orders',
  require('./src/api/routes/orders.routes'),
)

app.use(
  '/api/services',
  require('./src/api/routes/services.routes'),
)

app.use(
  '/api/users',
  require('./src/api/routes/users.routes'),
)

app.use(
  '/api/blog',
  require('./src/api/routes/blog.routes'),
)

app.use(
  '/api/donations',
  require('./src/api/routes/donation.routes'),
)

app.use(
  '/api/digital-products',
  require('./src/api/routes/digital-products.routes'),
)

app.use(
  '/api/subscriptions',
  require('./src/api/routes/subscription.routes'),
)

app.use(
  '/api/projects',
  require('./src/api/routes/projects.routes'),
)

app.use(
  '/api/execution',
  require('./src/api/routes/execution.routes'),
)

app.use(
  '/api/service-delivery',
  require('./src/api/routes/service-delivery.routes'),
)

app.use(
  '/api/chat',
  require('./src/api/routes/chat.routes'),
)

app.use(
  '/api/faqs',
  require('./src/api/routes/faqs.routes'),
)

app.use(
  '/api/packages',
  require('./src/api/routes/packages.routes'),
)

app.use(
  '/api/tickets',
  require('./src/api/routes/tickets.routes'),
)

app.use(
  '/api/ai',
  require('./src/api/routes/ai.routes'),
)

app.use(
  '/api/invoices',
  require('./src/api/routes/invoices.routes'),
)

app.use(
  '/api/config',
  require('./src/api/routes/config.routes'),
)

app.use(
  '/api/personas',
  require('./src/api/routes/personas.routes'),
)

// ============================================================
// Runtime Status
// ============================================================

const runtimeStatus = () => ({
  version: backendPackage.version,

  timestamp: new Date().toISOString(),

  uptime: process.uptime(),

  environment:
    process.env.NODE_ENV || 'development',
})

// ============================================================
// Live
// ============================================================

app.get('/api/live', (_req, res) => {
  res.status(200).json({
    status: 'LIVE',
    ...runtimeStatus(),
  })
})

// ============================================================
// Readiness
// ============================================================

app.get('/api/ready', async (_req, res) => {
  const databaseConfigured = Boolean(
    process.env.SUPABASE_URL &&
      process.env.SUPABASE_SERVICE_ROLE_KEY,
  )

  let databaseReady = false

  if (databaseConfigured) {
    try {
      const { error } = await supabase
        .from('users')
        .select('id')
        .limit(1)

      databaseReady = !error
    } catch (_error) {
      databaseReady = false
    }
  }

  const ready =
    databaseConfigured &&
    databaseReady

  const nowPaymentsApiConfigured =
    Boolean(
      process.env.NOWPAYMENTS_API_KEY,
    )

  const nowPaymentsIpnConfigured =
    Boolean(
      process.env.NOWPAYMENTS_IPN_SECRET_KEY,
    )

  res.status(
    ready ? 200 : 503,
  ).json({
    status: ready
      ? 'READY'
      : 'NOT_READY',

    database: databaseReady
      ? 'reachable'
      : databaseConfigured
        ? 'unreachable'
        : 'missing',

    critical_configuration: {
      nowpayments_api:
        nowPaymentsApiConfigured
          ? 'configured'
          : 'missing',

      nowpayments_ipn:
        nowPaymentsIpnConfigured
          ? 'configured'
          : 'missing',
    },

    ...runtimeStatus(),
  })
})

// ============================================================
// Health
// ============================================================

app.get('/api/health', (_req, res) => {
  const databaseConfigured =
    Boolean(
      process.env.SUPABASE_URL &&
        process.env.SUPABASE_SERVICE_ROLE_KEY,
    )

  const nowPaymentsConfigured =
    Boolean(
      process.env.NOWPAYMENTS_API_KEY &&
        process.env
          .NOWPAYMENTS_IPN_SECRET_KEY,
    )

  const status =
    databaseConfigured
      ? nowPaymentsConfigured
        ? 'OK'
        : 'DEGRADED'
      : 'UNHEALTHY'

  res.status(
    status === 'UNHEALTHY'
      ? 503
      : 200,
  ).json({
    status,

    database:
      databaseConfigured
        ? 'configured'
        : 'missing',

    critical_configuration: {
      nowpayments:
        nowPaymentsConfigured
          ? 'configured'
          : 'missing',
    },

    ...runtimeStatus(),
  })
})

// ============================================================
// Swagger
// ============================================================

setupSwagger(app)

// ============================================================
// Socket.IO
// ============================================================

const io = new Server(server, {
  cors: {
    origin: allowedOrigins,
    credentials: true,
  },
})

// ============================================================
// Socket Authentication
// ============================================================

io.use(async (socket, next) => {
  try {
    const token =
      socket.handshake.auth.token

    if (!token) {
      return next(
        new Error(
          'Authentication required',
        ),
      )
    }

    const {
      data: authData,
      error: authError,
    } =
      await supabase.auth.getUser(token)

    if (
      authError ||
      !authData?.user
    ) {
      return next(
        new Error(
          'Invalid session',
        ),
      )
    }

    const user =
      await findOrProvisionUser(
        authData.user,
      )

    if (!user) {
      return next(
        new Error(
          'User not found',
        ),
      )
    }

    socket.user = user

    next()
  } catch (_err) {
    next(
      new Error(
        'Invalid token',
      ),
    )
  }
})

// ============================================================
// Socket Connections
// ============================================================

io.on('connection', (socket) => {
  logger.info(
    `🟢 Socket connected: ${socket.id}`,
  )

  // ==========================================================
  // Join Conversation
  // ==========================================================

  socket.on(
    'join-conversation',
    async (conversationId) => {
      try {
        if (
          !conversationId ||
          (typeof conversationId !==
            'string' &&
            typeof conversationId !==
              'number')
        ) {
          return socket.emit(
            'error',
            {
              message:
                'A valid conversation is required.',
            },
          )
        }

        const access =
          await authorizeConversationAccess(
            conversationId,
            socket.user,
          )

        if (access.error) {
          return socket.emit(
            'error',
            {
              message:
                'Conversation access denied',
            },
          )
        }

        socket.join(
          `conv-${conversationId}`,
        )

        logger.info(
          `📢 Conversation join accepted: ${conversationId}`,
        )
      } catch (err) {
        logger.error(
          `Socket join failure: ${
            err.stack ||
            err.message
          }`,
        )

        socket.emit(
          'error',
          {
            message:
              'Unable to join the conversation right now.',
          },
        )
      }
    },
  )

  // ==========================================================
  // Send Message
  // ==========================================================

  socket.on(
    'send-message',
    async (data) => {
      try {
        const {
          conversationId,
          content,
        } = data || {}

        if (
          !content ||
          !content.trim()
        ) {
          return socket.emit(
            'error',
            {
              message:
                'Message content is required',
            },
          )
        }

        const access =
          await authorizeConversationAccess(
            conversationId,
            socket.user,
          )

        if (access.error) {
          return socket.emit(
            'error',
            {
              message:
                'Conversation access denied',
            },
          )
        }

        const {
          data: message,
          error,
        } = await supabase
          .from('messages')
          .insert([
            {
              conversation_id:
                conversationId,

              sender_id:
                socket.user.id,

              content:
                content.trim(),

              read: false,

              created_at:
                new Date().toISOString(),
            },
          ])
          .select(
            '*, sender:sender_id(id, full_name, email, role, avatar)',
          )
          .single()

        if (error) {
          throw error
        }

        io.to(
          `conv-${conversationId}`,
        ).emit(
          'new-message',
          message,
        )

        logger.info(
          `💬 New message accepted in conversation ${conversationId}`,
        )
      } catch (err) {
        logger.error(
          `Socket message failure: ${
            err.stack ||
            err.message
          }`,
        )

        socket.emit(
          'error',
          {
            message:
              'Unable to send the message right now.',
          },
        )
      }
    },
  )

  // ==========================================================
  // Disconnect
  // ==========================================================

  socket.on(
    'disconnect',
    () => {
      logger.info(
        `🔴 Socket disconnected: ${socket.id}`,
      )
    },
  )
})

// ============================================================
// Error Handling
// ============================================================

app.use(
  (err, req, res, _next) => {
    const status =
      Number(err.status) >= 400 &&
      Number(err.status) < 500
        ? Number(err.status)
        : 500

    logger.error(
      `[${req.requestId || 'no-request-id'}] ❌ ${
        err.stack ||
        err.message
      }`,
    )

    const message =
      status < 500 &&
      err.expose !== false
        ? err.message ||
          'Request failed'
        : 'Internal Server Error'

    res.status(status).json({
      message,

      requestId:
        req.requestId,
    })
  },
)

// ============================================================
// Start Server
// ============================================================

if (require.main === module) {
  server.listen(PORT, () => {
    logger.info(
      `🚀 BISIS Server running on port ${PORT}`,
    )

    logger.info(
      `📚 Swagger UI: http://localhost:${PORT}/api-docs`,
    )

    logger.info(
      `💚 Health Check: http://localhost:${PORT}/api/health`,
    )
  })
}

// ============================================================
// Graceful Shutdown
// ============================================================

let shutdownStarted = false

const shutdown = (signal) => {
  if (shutdownStarted) {
    return
  }

  shutdownStarted = true

  logger.info(
    `Shutting down gracefully (${signal})`,
  )

  server.close(() => {
    logger.info('Server closed')

    process.exit(0)
  })
}

process.on(
  'SIGINT',
  () => shutdown('SIGINT'),
)

process.on(
  'SIGTERM',
  () => shutdown('SIGTERM'),
)

process.on(
  'unhandledRejection',
  (err) => {
    logger.error(
      '❌ Unhandled Rejection:',
      err,
    )
  },
)

process.on(
  'uncaughtException',
  (err) => {
    logger.error(
      '❌ Uncaught Exception:',
      err,
    )

    process.exit(1)
  },
)

// ============================================================
// Export app for tests
// ============================================================

module.exports = app