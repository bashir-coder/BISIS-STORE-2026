import { FormEvent, useEffect, useState } from 'react'
import { useNavigate, useLocation, type Location } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { motion } from 'framer-motion'
import { GoogleLogin } from '@react-oauth/google'
import axios from 'axios'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || ''
const GOOGLE_OAUTH_ENABLED = import.meta.env.VITE_ENABLE_GOOGLE_OAUTH === 'true' && Boolean(GOOGLE_CLIENT_ID)

const LoginPage = () => {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const location = useLocation()
  const { user, loading, login, sessionExpired } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (!loading && user) navigate('/introduction', { replace: true })
  }, [loading, navigate, user])

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError('')
    if (password.length < 8) {
      setError(t('auth.password_min'))
      return
    }

    setSubmitting(true)
    let loginSucceeded = false
    try {
      await login(email.trim(), password)
      loginSucceeded = true
    } catch (caught: unknown) {
      const message = caught instanceof Error ? caught.message : t('notifications.error')
      setError(message)
    } finally {
      setSubmitting(false)
    }
    // Schedule navigation as a macrotask so React flushes auth state
    // updates (user set via onAuthStateChange during login) before we
    // navigate. Without this, RequireRole may still see user === null
    // and bounce us back to /login.
    if (loginSucceeded) {
      setTimeout(() => {
        navigate(getRedirectDestination(location))
      }, 0)
    }
  }

  const handleGoogleSuccess = async (credentialResponse: { credential?: string }) => {
    if (!credentialResponse.credential) {
      setError(t('notifications.error'))
      return
    }
    setError('')
    let loginSucceeded = false
    try {
      const { error: authError } = await supabase.auth.signInWithIdToken({
        provider: 'google',
        token: credentialResponse.credential,
      })
      if (authError) throw authError
      loginSucceeded = true
    } catch (caught: unknown) {
      setError(axios.isAxiosError(caught) ? caught.response?.data?.message || t('notifications.error') : caught instanceof Error ? caught.message : t('notifications.error'))
    }
    if (loginSucceeded) {
      setTimeout(() => {
        navigate(getRedirectDestination(location))
      }, 0)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center section-padding pt-32 pb-20">
      <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-md">
        <div className="glass rounded-2xl p-8 border-gold/10 text-center">
          <h1 className="text-2xl font-bold text-ink-0 mb-2">
            {t('auth.login')}
          </h1>
          <p className="text-ink-3 text-center text-sm mb-8">{t('brand.tagline')}</p>
          {sessionExpired && (
            <p className="text-destructive text-sm text-center mb-8" role="alert">
              {t('auth.session_expired')}
            </p>
          )}

          <form onSubmit={handleSubmit} className="space-y-3 text-start">
            <input
              type="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              aria-label={t('auth.email')}
              placeholder={t('auth.email')}
              className="w-full bg-surface-1 border border-border-1 rounded-lg px-4 py-3 text-ink-0 placeholder:text-ink-3 focus:outline-none focus:border-gold/50"
            />
            <input
              type="password"
              required
              minLength={8}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              aria-label={t('auth.password')}
              placeholder={t('auth.password')}
              className="w-full bg-surface-1 border border-border-1 rounded-lg px-4 py-3 text-ink-0 placeholder:text-ink-3 focus:outline-none focus:border-gold/50"
            />
            {error && <p className="text-destructive text-sm" role="alert">{error}</p>}
            <button type="submit" disabled={submitting} className="w-full btn-primary disabled:opacity-50">
              {submitting ? t('dashboard.loading') : t('auth.submit')}
            </button>
          </form>

          {GOOGLE_OAUTH_ENABLED ? (
            <>
              <div className="flex items-center gap-3 my-6 text-ink-3 text-xs">
                <span className="h-px bg-surface-2 flex-1" />
                <span>{t('auth.or')}</span>
                <span className="h-px bg-surface-2 flex-1" />
              </div>
              <div className="flex justify-center">
                <GoogleLogin onSuccess={handleGoogleSuccess} onError={() => setError(t('notifications.error'))} theme="filled_black" shape="pill" width="350" />
              </div>
            </>
          ) : (
            <p className="text-center text-sm text-ink-3 mt-6" role="status">{t('auth.google_unavailable')}</p>
          )}
        </div>
      </motion.div>
    </div>
  )
}

export default LoginPage

function isSafeInternalPath(path: string | undefined): path is string {
  if (!path || typeof path !== 'string') return false
  if (/^https?:\/\//i.test(path)) return false
  if (/^\/\//.test(path)) return false
  return path.startsWith('/')
}

function getRedirectDestination(location: Location): string {
  const fromRaw = location.state?.from
  let from: string | undefined
  if (typeof fromRaw === 'string') {
    from = fromRaw
  } else if (fromRaw && typeof fromRaw === 'object' && 'pathname' in fromRaw) {
    const loc = fromRaw as { pathname?: string; search?: string; hash?: string }
    from = `${loc.pathname || ''}${loc.search || ''}${loc.hash || ''}`
  }
  return isSafeInternalPath(from) ? from : '/introduction'
}
