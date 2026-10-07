'use strict'

const { sendToAIOS } = require('./client')

async function sendTask(request, options = {}) {
  return sendToAIOS(request, options)
}

module.exports = {
  sendTask,
}
