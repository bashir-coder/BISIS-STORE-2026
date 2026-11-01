const express = require('express')
const router = express.Router()

// The Personas database model was retired by migration 018.
// Keep an explicit response for stale clients instead of querying a dropped table.
router.get('/', (_req, res) => {
  res.status(410).json({
    code: 'PERSONAS_RETIRED',
    message: 'The Personas feature is no longer available.',
  })
})

module.exports = router
