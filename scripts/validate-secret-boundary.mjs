#!/usr/bin/env node
import { readdir, readFile } from 'node:fs/promises'
import { dirname, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const scanRoots = ['.']
const sourceRoots = ['backend/src', 'frontend/src', 'infrastructure', 'scripts', '.github']
const ignoredDirs = new Set([
  'node_modules', 'dist', 'build', 'coverage', '.cache', '.git', '.next',
])
const failures = []
const warnings = []
const suspiciousFiles = []
const suspiciousContent = []
const secretNames = [
  'SUPABASE_SERVICE_ROLE_KEY', 'GOOGLE_CLIENT_SECRET', 'TELEGRAM_BOT_TOKEN',
  'RESEND_API_KEY', 'RECAPTCHA_SECRET_KEY', 'EMAIL_PASS', 'JWT_SECRET',
  'OPENAI_API_KEY', 'OPENROUTER_API_KEY', 'CLAUDE_API_KEY', 'DEEPSEEK_API_KEY',
]
const placeholderPattern = /^(?:$|replace-with|your[-_]|change[-_]?me|placeholder|example|__ENCRYPTED__|none|null)$/i
const anglePlaceholderPattern = /<[^>]+>/

function isExampleFile(file) {
  return /(^|\/)\.env\.example$|\.redacted\.(json|md|txt)$/i.test(file)
}

function isIgnoredPath(path) {
  const parts = relative(root, path).split('/')
  return parts.some((part) => ignoredDirs.has(part))
}

async function walk(dir) {
  if (isIgnoredPath(dir)) return
  let entries = []
  try { entries = await readdir(dir, { withFileTypes: true }) } catch { return }
  for (const entry of entries) {
    if (ignoredDirs.has(entry.name)) continue
    const path = join(dir, entry.name)
    if (entry.isDirectory()) await walk(path)
    else await inspectFile(path)
  }
}

async function inspectFile(path) {
  const rel = relative(root, path).replaceAll('\\', '/')
  const isLocalEnv = /(^|\/)\.env$/i.test(rel)
  if (/^\.env(?:\.|$)|\.(pem|key|p12|pfx|secret|secrets)$/i.test(rel.split('/').at(-1)) && !isExampleFile(rel) && !isLocalEnv) {
    suspiciousFiles.push(rel)
  }
  if (isLocalEnv) {
    warnings.push(`Local environment file exists and must remain untracked: ${rel}`)
    return
  }
  let text
  try { text = await readFile(path, 'utf8') } catch { return }
  if (/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/.test(text)) {
    suspiciousContent.push(rel)
  }
  if (!isExampleFile(rel)) {
    for (const line of text.split(/\r?\n/)) {
      const assignment = line.match(new RegExp(`^\\s*(${secretNames.join('|')})\\s*=\\s*(.*?)\\s*$`, 'i'))
      const value = assignment?.[2]?.replace(/["']/g, '').trim() ?? ''
      if (assignment && !placeholderPattern.test(value) && !anglePlaceholderPattern.test(value)) {
        suspiciousContent.push(rel)
        break
      }
    }
  }
  if (sourceRoots.some((sourceRoot) => rel === sourceRoot || rel.startsWith(`${sourceRoot}/`))) {
    if (/(?:logger|console)\.(?:info|warn|error|debug)\([^\n]*(?:password|authorization|bearer|service[_ -]?role|secret|token|socket\.user\?\.email)/i.test(text)) {
      suspiciousContent.push(rel)
    }
  }
}

for (const scanRoot of scanRoots) await walk(resolve(root, scanRoot))

const ignoreFiles = ['.gitignore', '.dockerignore', 'backend/.dockerignore']
for (const file of ignoreFiles) {
  try {
    const text = await readFile(resolve(root, file), 'utf8')
    for (const expected of ['.env', '*.key', 'secrets']) {
      if (!text.includes(expected)) failures.push(`${file} does not ignore ${expected}`)
    }
  } catch { failures.push(`Missing ${file}`) }
}

for (const file of suspiciousFiles) {
  if (file.endsWith('.env') || file.includes('/.env')) warnings.push(`Local environment file exists and must remain untracked: ${file}`)
  else failures.push(`Credential-like file is inside the repository: ${file}`)
}
for (const file of [...new Set(suspiciousContent)]) failures.push(`Credential-like content detected in repository file: ${file}`)

const result = {
  status: failures.length ? 'FAIL' : 'PASS',
  scanned_roots: scanRoots,
  ignored_directories: [...ignoredDirs].sort(),
  ignore_files: ignoreFiles,
  failures,
  warnings,
  policy: 'Real secrets must be injected by a managed secret store and never committed or copied into images.',
}
console.log(JSON.stringify(result, null, 2))
process.exitCode = failures.length ? 1 : 0
