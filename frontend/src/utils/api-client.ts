import axios, { type InternalAxiosRequestConfig } from 'axios'
import { supabase } from '../lib/supabase'

// Use an explicit backend URL locally; in production, an empty base URL
// keeps requests same-origin so nginx can proxy /api and /socket.io safely.
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
// ============================================================
// 🔥 Request Interceptor – إضافة التوكن ومنع الكاش
// ============================================================
api.interceptors.request.use(
  async (config: InternalAxiosRequestConfig): Promise<InternalAxiosRequestConfig> => {
    // 1. إضافة التوكن للمصادقة
    const { data: { session } } = await supabase.auth.getSession()
    if (session?.access_token) {
      config.headers.Authorization = `Bearer ${session.access_token}`
    }

    // 2. ✅ منع الكاش لطلبات GET (خاصة للأدمن)
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

// ============================================================
// 🔥 Response Interceptor – معالجة 401 (انتهاء التوكن)
// ============================================================
api.interceptors.response.use(
  (response) => response,
  (error) => {
    // ✅ إذا كان الخطأ 401 (Unauthorized)، نعيد التوجيه إلى صفحة تسجيل الدخول
    if (error.response?.status === 401) {
      localStorage.removeItem('bisis_user')
      void supabase.auth.signOut()
      window.location.href = '/login'
    }
    return Promise.reject(error)
  }
)

export default api
