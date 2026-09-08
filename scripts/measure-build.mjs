import { readdir, stat, mkdir, writeFile } from 'node:fs/promises'
import { join, extname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { gzipSync } from 'node:zlib'
import { readFile } from 'node:fs/promises'

const root = fileURLToPath(new URL('../frontend/dist/assets/', import.meta.url))
const output = new URL('../docs/evidence/performance-2026-08-25/', import.meta.url)
const phase = process.argv[2] || 'current'
const files = []

async function walk(directory, relative = '') {
  for (const name of await readdir(directory)) {
    const full = join(directory, name)
    const nextRelative = join(relative, name)
    const details = await stat(full)
    if (details.isDirectory()) await walk(full, nextRelative)
    else if (['.js', '.css', '.html'].includes(extname(name))) {
      const content = await readFile(full)
      files.push({ file: nextRelative.replaceAll('\\', '/'), bytes: content.length, gzip_bytes: gzipSync(content, { level: 9 }).length })
    }
  }
}

await mkdir(output, { recursive: true })
await walk(root)
files.sort((a, b) => b.bytes - a.bytes)
const total = files.reduce((sum, file) => sum + file.bytes, 0)
const gzipTotal = files.reduce((sum, file) => sum + file.gzip_bytes, 0)
const result = { phase, generated_at: new Date().toISOString(), asset_count: files.length, total_bytes: total, total_gzip_bytes: gzipTotal, largest_assets: files.slice(0, 12), warning_assets_over_500kb: files.filter((file) => file.bytes > 500 * 1024).map((file) => file.file) }
await writeFile(new URL(`${phase}.json`, output), JSON.stringify(result, null, 2) + '\n')
console.log(JSON.stringify(result, null, 2))
