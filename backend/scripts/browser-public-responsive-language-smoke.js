const fs = require('fs')
const path = require('path')
const http = require('http')
const WebSocket = require('ws')

const baseUrl = process.env.BROWSER_QA_BASE_URL || 'http://localhost:3000'
const cdpUrl = process.env.BROWSER_QA_CDP_URL || 'http://127.0.0.1:9224'
const screenshotDir = path.resolve(__dirname, '../../docs/evidence/responsive-qa-2026-08-25')
const cases = [
  { lang: 'ar', label: 'العربية', dir: 'rtl' },
  { lang: 'en', label: 'English', dir: 'ltr' },
  { lang: 'tr', label: 'Türkçe', dir: 'ltr' },
]
const viewports = [
  { name: 'mobile', width: 390, height: 844 },
  { name: 'tablet', width: 1024, height: 900 },
  { name: 'desktop', width: 1280, height: 941 },
]

function requestJson(url) {
  return new Promise((resolve, reject) => {
    http.get(url, (response) => {
      let body = ''
      response.on('data', (chunk) => { body += chunk })
      response.on('end', () => {
        try { resolve(JSON.parse(body)) } catch { reject(new Error(`Invalid JSON from ${url}`)) }
      })
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
async function waitFor(send, expression, timeoutMs = 15000) {
  const started = Date.now()
  while (Date.now() - started < timeoutMs) {
    if (await evaluate(send, expression)) return
    await sleep(250)
  }
  throw new Error(`Timed out waiting for browser condition: ${expression}`)
}
async function setLanguage(send, language) {
  const label = cases.find((item) => item.lang === language).label
  await evaluate(send, `(() => { const trigger = document.querySelector('button[aria-haspopup="menu"]'); trigger?.click(); return Boolean(trigger) })()`)
  await waitFor(send, `Array.from(document.querySelectorAll('button')).some((button) => button.innerText.trim().startsWith(${JSON.stringify(label)}))`)
  await evaluate(send, `(() => { const button = Array.from(document.querySelectorAll('button')).find((item) => item.innerText.trim().startsWith(${JSON.stringify(label)})); button?.click(); return Boolean(button) })()`)
  const direction = cases.find((item) => item.lang === language).dir
  await waitFor(send, `document.documentElement.getAttribute('lang') === ${JSON.stringify(language)} && document.documentElement.getAttribute('dir') === ${JSON.stringify(direction)}`)
  await sleep(350)
}
async function main() {
  fs.mkdirSync(screenshotDir, { recursive: true })
  const browser = await cdpWs()
  const { send } = browser
  const checks = {}
  const screenshots = []
  try {
    await send('Page.enable')
    await send('Runtime.enable')
    for (const viewport of viewports) {
      await send('Emulation.setDeviceMetricsOverride', { width: viewport.width, height: viewport.height, deviceScaleFactor: 1, mobile: viewport.width < 600 })
      for (const language of cases) {
        await send('Page.navigate', { url: `${baseUrl}/` })
        await waitFor(send, `document.readyState === 'complete' && !!document.querySelector('button[aria-haspopup="menu"]') && !!document.querySelector('h1')`)
        await setLanguage(send, language.lang)
        const details = await evaluate(send, `(() => { const root = document.documentElement; const body = document.body; const toggle = document.querySelector('button[aria-controls="mobile-navigation"]'); const desktopLinks = Array.from(document.querySelectorAll('header nav a')).filter((link) => getComputedStyle(link).display !== 'none').length; const overflow = root.scrollWidth <= root.clientWidth + 2 && body.scrollWidth <= body.clientWidth + 2; const rawKeys = Array.from(document.querySelectorAll('body *')).filter((node) => /^([a-z]+\\.){1,}[a-z_]+$/.test(node.textContent?.trim() || '')).length; return { lang: root.lang, dir: root.dir, viewport: { width: innerWidth, height: innerHeight }, overflow, heading: Boolean(document.querySelector('h1')?.getBoundingClientRect().height), mobileToggle: Boolean(toggle && getComputedStyle(toggle).display !== 'none'), desktopLinks, rawKeys } })()`)
        const key = `${viewport.name}_${language.lang}`
        const layoutPass = details.lang === language.lang && details.dir === language.dir && details.heading && details.overflow && (viewport.width < 1024 ? details.mobileToggle : details.desktopLinks > 0) && details.rawKeys === 0
        checks[key] = { pass: layoutPass, details }
        if (viewport.width < 600) {
          await evaluate(send, `document.querySelector('button[aria-controls="mobile-navigation"]')?.click()`)
          await waitFor(send, `(() => { const menu = document.querySelector('#mobile-navigation'); return Boolean(menu && getComputedStyle(menu).height !== '0px' && menu.getBoundingClientRect().height > 0) })()`)
          checks[key].mobile_menu_opened = true
          await evaluate(send, `document.querySelector('button[aria-controls="mobile-navigation"]')?.click()`)
        }
        const file = `${language.lang}-${viewport.name}-${viewport.width}x${viewport.height}-public-home.png`
        const capture = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false })
        fs.writeFileSync(path.join(screenshotDir, file), Buffer.from(capture.data, 'base64'))
        screenshots.push(`docs/evidence/responsive-qa-2026-08-25/${file}`)
      }
    }
    const failed = Object.entries(checks).filter(([, value]) => !value.pass || value.mobile_menu_opened === false)
    console.log(JSON.stringify({ status: failed.length === 0 ? 'PASS' : 'FAIL', cases: checks, screenshots }, null, 2))
    if (failed.length) process.exitCode = 1
  } finally {
    browser.socket.close()
  }
}
main().catch((error) => { console.error(error.message); process.exitCode = 1 })
