import axios, { type InternalAxiosRequestConfig } from 'axios'
import { supabase } from '../lib/supabase'

const API_URL = import.meta.env.VITE_API_URL || ''

export const api = axios.create({
  baseURL: API_URL.replace(/\/+$/, ''),
  headers: {
    'Content-Type': 'application/json',
  },
})

api.interceptors.request.use((config) => {
  const baseURL = String(config.baseURL || '').replace(/\/+$/, '')
  const url = String(config.url || '')

  if (baseURL.endsWith('/api') && url.startsWith('/api/')) {
    config.url = url.slice(4)
  }

  return config
})

api.interceptors.request.use(
  async (config: InternalAxiosRequestConfig): Promise<InternalAxiosRequestConfig> => {
    const { data: { session } } = await supabase.auth.getSession()
    if (session?.access_token) {
      config.headers.Authorization = `Bearer ${session.access_token}`
    }

    if (config.method?.toUpperCase() === 'GET') {
      config.headers['Cache-Control'] = 'no-cache'
      config.headers['Pragma'] = 'no-cache'
    }

    return config
  },
  (error) => {
    return Promise.reject(error)
  }
)

let isHandling401 = false
const FORTY_ONE_RESET_MS = 2000

// Exported for test-only use: resets the 401 deduplication flag so that
// successive tests start with a clean dedup state. Does not affect production
// behavior outside of tests that import and call it.
export const __reset401Dedup = () => {
  isHandling401 = false
}

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status !== 401) {
      return Promise.reject(error)
    }

    if (isHandling401) {
      return Promise.reject(error)
    }
    isHandling401 = true
    setTimeout(() => {
      isHandling401 = false
    }, FORTY_ONE_RESET_MS)

    const { data: { session } } = await supabase.auth.getSession()
    if (!session?.access_token) {
      return Promise.reject(error)
    }

    window.dispatchEvent(
      new CustomEvent('auth-session-expired', {
        detail: { from: window.location.pathname },
      })
    )

    return Promise.reject(error)
  }
)

export default api
