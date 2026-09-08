#!/usr/bin/env node
import { readFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const files = {
  compose: resolve(root, 'infrastructure/docker-compose.yml'),
  edge: resolve(root, 'infrastructure/nginx.conf'),
  backendDockerfile: resolve(root, 'backend/Dockerfile'),
  frontendDockerfile: resolve(root, 'frontend/Dockerfile'),
}
const failures = []
const warnings = [
  'Docker runtime validation is not performed by this static validator.',
  'TLS termination/certificates are intentionally external to the current nginx template.',
]
const content = {}
for (const [name, path] of Object.entries(files)) {
  try {
    content[name] = await readFile(path, 'utf8')
  } catch {
    failures.push(`Missing deployment file: ${name}`)
  }
}

const requireText = (file, text, label = text) => {
  if (!content[file]?.includes(text)) failures.push(`Missing ${label} in ${file}`)
}

for (const service of ['frontend:', 'backend:', 'nginx:']) requireText('compose', service, `${service} service`)
requireText('compose', 'restart: unless-stopped', 'restart policy')
requireText('compose', 'http://localhost:5000/api/ready', 'backend readiness healthcheck')
requireText('compose', 'condition: service_healthy', 'healthy dependency ordering')
requireText('compose', 'ALLOWED_ORIGINS: ${ALLOWED_ORIGINS:?ALLOWED_ORIGINS is required}', 'production CORS requirement')
requireText('edge', 'location /api/', 'API routing')
requireText('edge', 'location /socket.io/', 'Socket.IO routing')
requireText('edge', 'proxy_set_header Upgrade $http_upgrade;', 'WebSocket upgrade')
requireText('edge', 'client_max_body_size 10m;', 'edge body limit')
requireText('backendDockerfile', 'npm ci --omit=dev', 'backend production install')
requireText('frontendDockerfile', 'FROM nginx:alpine', 'frontend runtime stage')
if (/SUPABASE_SERVICE_ROLE_KEY|OPENAI_API_KEY/.test(content.frontendDockerfile || '')) {
  failures.push('Frontend Dockerfile must not contain server-only secret names')
}
if (/COPY\s+\.env|COPY\s+.*\.env\b/i.test(Object.values(content).join('\n'))) {
  failures.push('Deployment files must not copy .env files into images')
}

const result = {
  status: failures.length ? 'FAIL' : 'PASS',
  checks: {
    compose_services: !failures.some((item) => item.includes('service')),
    readiness_healthcheck: content.compose?.includes('/api/ready') || false,
    healthy_dependency_ordering: content.compose?.includes('condition: service_healthy') || false,
    websocket_proxy: content.edge?.includes('proxy_set_header Upgrade') || false,
    frontend_secret_boundary: !/SUPABASE_SERVICE_ROLE_KEY|OPENAI_API_KEY/.test(content.frontendDockerfile || ''),
    env_copy_absent: !/COPY\s+\.env|COPY\s+.*\.env\b/i.test(Object.values(content).join('\n')),
  },
  failures,
  warnings,
  runtime_validation: {
    docker: 'not_run',
    nginx_t: 'not_run',
    tls: 'not_run',
  },
}
console.log(JSON.stringify(result, null, 2))
process.exitCode = failures.length ? 1 : 0
