const fs = require('fs')
const path = require('path')
const http = require('http')
const WebSocket = require('ws')
const { createClient } = require('@supabase/supabase-js')
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') })

const baseUrl = process.env.BROWSER_QA_BASE_URL || 'http://localhost:3000'
const cdpUrl = process.env.BROWSER_QA_CDP_URL || 'http://127.0.0.1:9224'
const evidenceDir = path.resolve(__dirname, '../../docs/evidence/accessibility-qa-2026-08-25')
const password = `BisisAccessibilityQA!${Date.now()}a`
const email = `bisis.accessibility.qa.${Date.now()}@example.invalid`
const admin = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { autoRefreshToken: false, persistSession: false } })
const pages = [
  { name: 'public-home', path: '/', authenticated: false },
  { name: 'login', path: '/login', authenticated: false },
  { name: 'packages', path: '/packages', authenticated: false },
]
const viewports = [
  { name: 'mobile', width: 390, height: 844 },
  { name: 'desktop', width: 1280, height: 941 },
]

function requestJson(url) {
  return new Promise((resolve, reject) => {
    http.get(url, (response) => {
      let body = ''
      response.on('data', (chunk) => { body += chunk })
      response.on('end', () => { try { resolve(JSON.parse(body)) } catch { reject(new Error(`Invalid JSON from ${url}`)) } })
    }).on('error', reject)
  })
}
function sleep(ms) { return new Promise((resolve) => setTimeout(resolve, ms)) }
async function cdpWs() {
  const targets = await requestJson(`${cdpUrl}/json/list`)
  const target = targets.find((item) => item.type === 'page') || targets[0]
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
      if (message.error) reject(new Error(message.error.message)); else resolve(message.result)
    }
  })
  const send = (method, params = {}) => new Promise((resolve, reject) => {
    const id = nextId++
    pending.set(id, { resolve, reject })
    socket.send(JSON.stringify({ id, method, params }))
  })
  return { socket, send }
}
async function evaluate(send, expression) {
  const result = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true })
  if (result.exceptionDetails) throw new Error(result.exceptionDetails.text || 'Browser evaluation failed')
  return result.result?.value
}
async function waitFor(send, expression, timeoutMs = 20000) {
  const started = Date.now()
  while (Date.now() - started < timeoutMs) {
    if (await evaluate(send, expression)) return
    await sleep(250)
  }
  throw new Error(`Timed out waiting for browser condition: ${expression}`)
}
async function login(send) {
  await send('Page.navigate', { url: `${baseUrl}/login` })
  await waitFor(send, `document.readyState === 'complete' && !!document.querySelector('input[type="email"]')`)
  await evaluate(send, `(() => { const emailInput = document.querySelector('input[type="email"]'); const passwordInput = document.querySelector('input[type="password"]'); const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set; setter.call(emailInput, ${JSON.stringify(email)}); setter.call(passwordInput, ${JSON.stringify(password)}); emailInput.dispatchEvent(new Event('input', { bubbles: true })); passwordInput.dispatchEvent(new Event('input', { bubbles: true })); document.querySelector('form button[type="submit"]').click(); return true })()`)
  await waitFor(send, `location.pathname === '/dashboard'`, 20000)
  await sleep(1200)
}
async function auditPage(send, page, viewport) {
  await send('Page.navigate', { url: `${baseUrl}${page.path}` })
  await waitFor(send, `location.pathname === ${JSON.stringify(page.path)} && document.readyState === 'complete'`)
  await sleep(page.authenticated ? 1500 : 500)
  const audit = await evaluate(send, `(() => {
    const visible = (node) => { const style = getComputedStyle(node); const box = node.getBoundingClientRect(); return style.display !== 'none' && style.visibility !== 'hidden' && box.width > 0 && box.height > 0 }
    const name = (node) => (node.getAttribute('aria-label') || node.getAttribute('title') || node.innerText || node.textContent || '').replace(/\\s+/g, ' ').trim()
    const unnamedButtons = Array.from(document.querySelectorAll('button')).filter((node) => visible(node) && !name(node)).map((node) => node.outerHTML.slice(0, 180))
    const unnamedLinks = Array.from(document.querySelectorAll('a')).filter((node) => visible(node) && !name(node)).map((node) => node.outerHTML.slice(0, 180))
    const unlabeledInputs = Array.from(document.querySelectorAll('input, textarea, select')).filter((node) => visible(node)).filter((node) => { const id = node.id; const hasLabel = Boolean(node.getAttribute('aria-label') || node.getAttribute('aria-labelledby') || (id && document.querySelector('label[for="' + CSS.escape(id) + '"]')) || node.closest('label')); return !hasLabel }).map((node) => node.outerHTML.slice(0, 180))
    const headings = Array.from(document.querySelectorAll('h1,h2,h3,h4,h5,h6')).filter(visible).map((node) => ({ level: Number(node.tagName.slice(1)), text: name(node).slice(0, 120) }))
    const focusables = Array.from(document.querySelectorAll('a[href],button,input,textarea,select,[tabindex]:not([tabindex="-1"])')).filter(visible)
    const focusResults = focusables.slice(0, 80).map((node) => { node.focus(); return { tag: node.tagName.toLowerCase(), name: name(node).slice(0, 80), visibleFocus: Boolean(document.activeElement === node && (getComputedStyle(node).outlineStyle !== 'none' || getComputedStyle(node).boxShadow !== 'none' || node.matches(':focus-visible'))) } })
    return { path: location.pathname, lang: document.documentElement.lang, dir: document.documentElement.dir, unnamedButtons, unnamedLinks, unlabeledInputs, headings, focusableCount: focusables.length, focusResults, horizontalOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth + 2 || document.body.scrollWidth > document.body.clientWidth + 2 }
  })()`)
  return audit
}
async function main() {
  fs.mkdirSync(evidenceDir, { recursive: true })
  const browser = await cdpWs()
  const { send } = browser
  const results = {}
  try {
    await send('Page.enable')
    await send('Runtime.enable')
    await send('Network.clearBrowserCookies')
    await send('Storage.clearDataForOrigin', { origin: baseUrl, storageTypes: 'all' })
    for (const viewport of viewports) {
      await send('Emulation.setDeviceMetricsOverride', { width: viewport.width, height: viewport.height, deviceScaleFactor: 1, mobile: viewport.width < 600 })
      for (const page of pages) {
        const key = `${page.name}_${viewport.name}`
        const audit = await auditPage(send, page, viewport)
        const screenshot = `${key}.png`
        const capture = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false })
        fs.writeFileSync(path.join(evidenceDir, screenshot), Buffer.from(capture.data, 'base64'))
        results[key] = { pass: audit.unnamedButtons.length === 0 && audit.unnamedLinks.length === 0 && audit.unlabeledInputs.length === 0 && !audit.horizontalOverflow, audit }
      }
    }
    const failures = Object.entries(results).filter(([, value]) => !value.pass)
    console.log(JSON.stringify({ status: failures.length === 0 ? 'PASS' : 'FAIL', results, screenshots: Object.keys(results).map((key) => `docs/evidence/accessibility-qa-2026-08-25/${key}.png`), scope: 'DOM name/label, visible focus sampling, headings, lang/dir, horizontal overflow; not a full WCAG conformance audit' }, null, 2))
    if (failures.length) process.exitCode = 1
  } finally {
    browser.socket.close()
  }
}
main().catch((error) => { console.error(error.message); process.exitCode = 1 })
