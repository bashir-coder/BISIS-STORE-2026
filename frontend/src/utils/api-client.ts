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

api.interceptors.response.use(
  (response) => response,
  (error) => {

    if (error.response?.status === 401) {
      localStorage.removeItem('BİŞİŞ_user')
      void supabase.auth.signOut()
      window.location.href = '/login'
      return Promise.reject(error)
    }

    if (error.response?.status === 403) {
      return Promise.reject(error)
    }

    return Promise.reject(error)
  }
)

export default api
