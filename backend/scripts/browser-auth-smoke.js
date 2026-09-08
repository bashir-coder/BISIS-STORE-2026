const fs = require('fs')
const path = require('path')
const http = require('http')
const WebSocket = require('ws')
const { createClient } = require('@supabase/supabase-js')
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') })

const baseUrl = process.env.BROWSER_QA_BASE_URL || 'http://localhost:3000'
const cdpUrl = process.env.BROWSER_QA_CDP_URL || 'http://127.0.0.1:9222'
const screenshotDir = path.resolve(__dirname, '../../docs/evidence/visual-qa-2026-08-25')
const viewportWidth = Number(process.env.BROWSER_QA_WIDTH || 1280)
const viewportHeight = Number(process.env.BROWSER_QA_HEIGHT || 941)
const screenshotName = process.env.BROWSER_QA_SCREENSHOT || 'dashboard-authenticated-client.png'
const password = `BisisBrowserQA!${Date.now()}a`
const email = `bisis.browser.qa.${Date.now()}@example.invalid`
const admin = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { autoRefreshToken: false, persistSession: false } })

function requestJson(url, options = {}) {
  return new Promise((resolve, reject) => {
    const request = http.request(url, options, (response) => {
      let body = ''
      response.on('data', (chunk) => { body += chunk })
      response.on('end', () => {
        try { resolve({ statusCode: response.statusCode, body: JSON.parse(body) }) } catch { reject(new Error(`Invalid JSON from ${url}`)) }
      })
    })
    request.on('error', reject)
    request.end()
  })
}

function sleep(ms) { return new Promise((resolve) => setTimeout(resolve, ms)) }

async function cdpWs() {
  const targets = await requestJson(`${cdpUrl}/json/list`)
  const target = targets.body.find((item) => item.type === 'page') || targets.body[0]
  if (!target?.webSocketDebuggerUrl) throw new Error('No Chromium CDP page target available')
  const socket = new WebSocket(target.webSocketDebuggerUrl)
  await new Promise((resolve, reject) => { socket.once('open', resolve); socket.once('error', reject) })
  let nextId = 1
  const pending = new Map()
  socket.on('message', (raw) => {
    const message = JSON.parse(raw.toString())
    if (message.id && pending.has(message.id)) {
      const { resolve, reject } = pending.get(message.id)
      pending.delete(message.id)
      if (message.error) reject(new Error(message.error.message))
      else resolve(message.result)
    }
  })
  const send = (method, params = {}) => new Promise((resolve, reject) => {
    const id = nextId++
    pending.set(id, { resolve, reject })
    socket.send(JSON.stringify({ id, method, params }))
  })
  return { socket, send }
}

async function evaluate(send, expression, awaitPromise = true) {
  const result = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise })
  if (result.exceptionDetails) throw new Error(result.exceptionDetails.text || 'Browser evaluation failed')
  return result.result?.value
}

async function waitFor(send, expression, timeoutMs = 15000) {
  const started = Date.now()
  while (Date.now() - started < timeoutMs) {
    const value = await evaluate(send, expression)
    if (value) return value
    await sleep(250)
  }
  throw new Error(`Timed out waiting for browser condition: ${expression}`)
}

async function main() {
  fs.mkdirSync(screenshotDir, { recursive: true })
  const created = await admin.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { full_name: 'BİŞIŞ Browser QA' } })
  if (created.error || !created.data.user) throw created.error || new Error('Unable to create browser QA user')
  const userId = created.data.user.id
  const persona = await admin.from('personas').select('id').limit(1).single()
  if (persona.error || !persona.data?.id) throw persona.error || new Error('No real persona available for browser QA')
  const profile = await admin.from('users').update({ persona_id: persona.data.id }).eq('id', userId)
  if (profile.error) throw profile.error
  const browser = await cdpWs()
  const { send } = browser
  try {
    await send('Page.enable')
    await send('Runtime.enable')
    await send('Emulation.setDeviceMetricsOverride', { width: viewportWidth, height: viewportHeight, deviceScaleFactor: 1, mobile: viewportWidth < 600 })
    await send('Page.navigate', { url: `${baseUrl}/login` })
    await waitFor(send, `document.readyState === 'complete' && !!document.querySelector('input[type="email"]')`)
    await evaluate(send, `(() => { const emailInput = document.querySelector('input[type="email"]'); const passwordInput = document.querySelector('input[type="password"]'); const setValue = (element, value) => { const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set; setter.call(element, value); element.dispatchEvent(new Event('input', { bubbles: true })); element.dispatchEvent(new Event('change', { bubbles: true })); }; setValue(emailInput, ${JSON.stringify(email)}); setValue(passwordInput, ${JSON.stringify(password)}); document.querySelector('form button[type="submit"]').click(); return true })()`)
    await waitFor(send, `location.pathname === '/dashboard'`, 20000)
    const dashboard = await waitFor(send, `(() => { const overlay = document.querySelector('.fixed.inset-0'); const heading = document.querySelector('h1'); return Boolean(!overlay && heading && heading.getBoundingClientRect().height > 0 && document.body.innerText.includes('BİŞIŞ') && !document.body.innerText.includes('Unable to load')); })()`, 20000)
    const clientHomeProbe = await evaluate(send, `(async () => { const authEntry = Object.values(localStorage).find((value) => value && value.includes('access_token')); let token = null; try { token = authEntry ? JSON.parse(authEntry).access_token : null; } catch {} if (!token) return { status: 0, body: 'no-browser-token' }; const response = await fetch('http://localhost:5000/api/service-delivery/client/home', { headers: { Authorization: 'Bearer ' + token } }); return { status: response.status, body: (await response.text()).slice(0, 240) }; })()`)
    if (clientHomeProbe.status !== 200) throw new Error(`client/home probe failed: ${JSON.stringify({ status: clientHomeProbe.status, body: clientHomeProbe.body })}`)
    const clientHomeReady = await waitFor(send, `(() => { const loading = Array.from(document.querySelectorAll('section')).some((section) => section.getAttribute('aria-label') && section.getAttribute('aria-label').includes('تحميل')); const error = Array.from(document.querySelectorAll('section[role="alert"]')).some((section) => section.innerText.includes('مساحة العمل')); return !loading && !error; })()`, 15000)
    await sleep(1500)
    await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false }).then((result) => fs.writeFileSync(path.join(screenshotDir, screenshotName), Buffer.from(result.data, 'base64')))
    const protectedRedirect = await evaluate(send, `location.pathname === '/dashboard'`)
    const direction = await evaluate(send, `document.documentElement.getAttribute('dir')`)
    const title = await evaluate(send, `document.title`)
    console.log(JSON.stringify({ status: 'PASS', user: 'redacted', auth_redirect: protectedRedirect, dashboard_loaded: Boolean(dashboard), client_home_probe: clientHomeProbe.status, client_home_ready: Boolean(clientHomeReady), direction, title, screenshot: 'docs/evidence/visual-qa-2026-08-25/dashboard-authenticated-client.png' }))
  } catch (error) {
    try { await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false }).then((result) => fs.writeFileSync(path.join(screenshotDir, 'dashboard-authenticated-client-debug.png'), Buffer.from(result.data, 'base64'))) } catch {}
    const currentState = await evaluate(send, `({ path: location.pathname, body: document.body.innerText.slice(0, 500) })`).catch(() => ({ path: 'unknown', body: 'unavailable' }))
    console.error(JSON.stringify({ error: error.message, currentState }))
    throw error
  } finally {
    browser.socket.close()
    const deleted = await admin.auth.admin.deleteUser(userId)
    if (deleted.error) throw deleted.error
  }
}

main().catch((error) => { console.error(error.message); process.exitCode = 1 })
