const swaggerJsdoc = require('swagger-jsdoc')
const swaggerUi = require('swagger-ui-express')

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'BİŞİŞ API',
      version: '1.0.0',
      description: 'BİŞİŞ Platform API Documentation',
      contact: { name: 'BİŞİŞ Team', email: 'contact@bisis.com' }
    },
    servers: [
      { url: 'http://localhost:5000/api', description: 'Development Server' },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
        }
      }
    },
    security: [{ bearerAuth: [] }]
  },
  // ✅ تأكد من هذا المسار الصحيح
  apis: ['./src/api/routes/*.js']
}

const swaggerSpec = swaggerJsdoc(options)

const setupSwagger = (app) => {
  app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec))
  app.get('/api-docs.json', (req, res) => res.json(swaggerSpec))
}

module.exports = setupSwagger