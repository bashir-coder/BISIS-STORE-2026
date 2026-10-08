import { useEffect, useState } from 'react'
import { useSearchParams, Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { CheckCircle, XCircle, Loader2 } from 'lucide-react'
import { supabase } from '../lib/supabase'
import type { EmailOtpType } from '@supabase/supabase-js'
import { useTranslation } from 'react-i18next'

const VerifyEmailPage: React.FC = () => {
  const [searchParams] = useSearchParams()
  const code = searchParams.get('code')
  const tokenHash = searchParams.get('token_hash')
  const tokenType = searchParams.get('type') as EmailOtpType | null
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading')
  const [message, setMessage] = useState('')
  const { t } = useTranslation()

  useEffect(() => {
    const verifyEmail = async () => {
      if (!code && !(tokenHash && tokenType)) {
        setStatus('error')
        setMessage(t('verify_email.invalid_link'))
        return
      }

      const result = code
        ? await supabase.auth.exchangeCodeForSession(code)
        : await supabase.auth.verifyOtp({ token_hash: tokenHash as string, type: tokenType as EmailOtpType })

      if (result.error) {
        setStatus('error')
        setMessage(result.error.message || t('verify_email.error'))
        return
      }

      setStatus('success')
      setMessage(t('verify_email.success'))
    }

    void verifyEmail()
  }, [code, tokenHash, tokenType, t])

  return (
    <div className="min-h-screen flex items-center justify-center section-padding">
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        className="glass rounded-2xl p-8 max-w-md w-full border-gold/10 text-center"
      >
        {status === 'loading' && (
          <>
            <Loader2 className="w-16 h-16 text-gold animate-spin mx-auto mb-4" />
            <h2 className="text-xl font-bold text-ink-0">{t('verify_email.loading')}</h2>
            <p className="text-ink-0/50 mt-2">{t('verify_email.wait')}</p>
          </>
        )}

        {status === 'success' && (
          <>
            <CheckCircle className="w-16 h-16 text-green-400 mx-auto mb-4" />
            <h2 className="text-xl font-bold text-ink-0">{t('verify_email.confirmed')}</h2>
            <p className="text-ink-0/70 mt-2">{message}</p>
            <Link to="/login" className="btn-primary mt-6 inline-block">{t('verify_email.login_now')}</Link>
          </>
        )}

        {status === 'error' && (
          <>
            <XCircle className="w-16 h-16 text-red-400 mx-auto mb-4" />
            <h2 className="text-xl font-bold text-ink-0">{t('verify_email.failed')}</h2>
            <p className="text-ink-0/70 mt-2">{message}</p>
            <Link to="/login" className="btn-secondary mt-6 inline-block">{t('verify_email.back_to_login')}</Link>
          </>
        )}
      </motion.div>
    </div>
  )
}

export default VerifyEmailPage

