import { FormEvent, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
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
  const { user, loading, login, register } = useAuth()
  const [mode, setMode] = useState<'login' | 'signup'>(() => window.location.pathname === '/register' ? 'signup' : 'login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [fullName, setFullName] = useState('')
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (!loading && user) navigate('/dashboard', { replace: true })
  }, [loading, navigate, user])

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError('')
    setNotice('')
    if (password.length < 8) {
      setError(t('auth.password_min'))
      return
    }

    setSubmitting(true)
    try {
      if (mode === 'login') {
        await login(email.trim(), password)
        navigate('/dashboard')
      } else {
        const data = await register(email.trim(), password, fullName.trim() || email.split('@')[0])
        const signupResult = data && typeof data === 'object' ? data as { session?: unknown } : null
        if (signupResult?.session) navigate('/dashboard')
        else setNotice(t('auth.signup_success'))
      }
    } catch (caught: unknown) {
      const message = caught instanceof Error ? caught.message : t('notifications.error')
      setError(message)
    } finally {
      setSubmitting(false)
    }
  }

  const handleGoogleSuccess = async (credentialResponse: { credential?: string }) => {
    if (!credentialResponse.credential) {
      setError(t('notifications.error'))
      return
    }
    setError('')
    setNotice('')
    try {
      const { error: authError } = await supabase.auth.signInWithIdToken({
        provider: 'google',
        token: credentialResponse.credential,
      })
      if (authError) throw authError
      navigate('/dashboard')
    } catch (caught: unknown) {
      setError(axios.isAxiosError(caught) ? caught.response?.data?.message || t('notifications.error') : caught instanceof Error ? caught.message : t('notifications.error'))
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center section-padding pt-32 pb-20">
      <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-md">
        <div className="glass rounded-2xl p-8 border-gold/10 text-center">
          <h1 className="text-2xl font-bold text-white mb-2">
            {mode === 'login' ? t('auth.login') : t('auth.create_account')}
          </h1>
          <p className="text-white/50 text-center text-sm mb-8">{t('brand.tagline')}</p>

          <form onSubmit={handleSubmit} className="space-y-3 text-start">
            {mode === 'signup' && (
              <input
                value={fullName}
                onChange={(event) => setFullName(event.target.value)}
                aria-label={t('auth.full_name', 'Full name')}
                placeholder={t('auth.email') === 'Email' ? 'Full name' : 'الاسم الكامل'}
                className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-white placeholder:text-white/30 focus:outline-none focus:border-gold/50"
              />
            )}
            <input
              type="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              aria-label={t('auth.email')}
              placeholder={t('auth.email')}
              className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-white placeholder:text-white/30 focus:outline-none focus:border-gold/50"
            />
            <input
              type="password"
              required
              minLength={8}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              aria-label={t('auth.password')}
              placeholder={t('auth.password')}
              className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-white placeholder:text-white/30 focus:outline-none focus:border-gold/50"
            />
            {error && <p className="text-red-300 text-sm" role="alert">{error}</p>}
            {notice && <p className="text-green-300 text-sm" role="status">{notice}</p>}
            <button type="submit" disabled={submitting} className="w-full btn-primary disabled:opacity-50">
              {submitting ? t('dashboard.loading') : mode === 'login' ? t('auth.submit') : t('auth.create_account')}
            </button>
          </form>

          <button
            type="button"
            onClick={() => { setMode(mode === 'login' ? 'signup' : 'login'); setError(''); setNotice('') }}
            className="text-gold/80 hover:text-gold text-sm mt-4"
          >
            {mode === 'login' ? t('auth.switch_to_signup') : t('auth.switch_to_login')}
          </button>

          {GOOGLE_OAUTH_ENABLED ? (
            <>
              <div className="flex items-center gap-3 my-6 text-white/30 text-xs">
                <span className="h-px bg-white/10 flex-1" />
                <span>OR</span>
                <span className="h-px bg-white/10 flex-1" />
              </div>
              <div className="flex justify-center">
                <GoogleLogin onSuccess={handleGoogleSuccess} onError={() => setError(t('notifications.error'))} theme="filled_black" shape="pill" width="350" />
              </div>
            </>
          ) : (
            <p className="text-center text-sm text-white/40 mt-6" role="status">{t('auth.google_unavailable')}</p>
          )}
        </div>
      </motion.div>
    </div>
  )
}

export default LoginPage

