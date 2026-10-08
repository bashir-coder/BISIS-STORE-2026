import React, { useState } from 'react'
import {
  ArrowRight,
  Loader2,
  ShieldCheck,
} from 'lucide-react'
import {
  useGoogleReCaptcha,
} from 'react-google-recaptcha-v3'
import {
  useTranslation,
} from 'react-i18next'
import {
  useLocation,
  useNavigate,
} from 'react-router-dom'

const API_URL =
  import.meta.env.VITE_API_URL || ''

const HUMAN_VERIFIED_KEY =
  'BİŞİŞ_human_verified'

type VerifyPageProps = {
  onVerified?: () => void
}

const VerifyPage: React.FC<VerifyPageProps> = ({
  onVerified,
}) => {
  const navigate = useNavigate()
  const location = useLocation()

  const { t } = useTranslation()

  const { executeRecaptcha } =
    useGoogleReCaptcha()

  const [error, setError] =
    useState('')

  const [submitting, setSubmitting] =
    useState(false)

  const handleVerify =
    async () => {
      setError('')

      if (!executeRecaptcha) {
        setError(
          t('verify.loading_error'),
        )
        return
      }

      try {
        setSubmitting(true)

        const token =
          await executeRecaptcha(
            'pre_entry',
          )

        if (!token) {
          throw new Error(
            'reCAPTCHA token was not generated',
          )
        }

        const response =
          await fetch(
            `${API_URL}/api/security/verify-recaptcha`,
            {
              method: 'POST',
              headers: {
                'Content-Type':
                  'application/json',
              },
              credentials:
                'include',
              body: JSON.stringify({
                recaptchaToken:
                  token,
              }),
            },
          )

        const data =
          await response
            .json()
            .catch(
              () => null,
            )

        if (
          !response.ok ||
          !data?.success
        ) {
          throw new Error(
            data?.message ||
              'reCAPTCHA verification failed',
          )
        }

        try {
          localStorage.setItem(
            HUMAN_VERIFIED_KEY,
            'true',
          )
        } catch {
          throw new Error(
            'Unable to persist security verification',
          )
        }

        onVerified?.()

        const state =
          location.state as
            | {
                from?: {
                  pathname?: string
                  search?: string
                  hash?: string
                }
              }
            | null

        const from =
          state?.from

        const target =
          from?.pathname
            ? `${from.pathname}${from.search || ''}${from.hash || ''}`
            : '/'

        navigate(
          target,
          {
            replace: true,
          },
        )
      } catch (
        verificationError
      ) {
        console.error(
          'reCAPTCHA verification failed:',
          verificationError,
        )

        setError(
          t('verify.verify_error'),
        )
      } finally {
        setSubmitting(false)
      }
    }

  return (
    <main
      className="relative min-h-screen overflow-hidden bg-[#050505] text-ink-0"
    >
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute left-1/2 top-1/2 h-[540px] w-[540px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-blue/[0.06] blur-3xl" />

        <div className="absolute left-1/2 top-1/2 h-[360px] w-[360px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-gold/5 blur-3xl" />
      </div>

      <div className="relative flex min-h-screen items-center justify-center px-5 py-10">
        <section className="w-full max-w-md rounded-[28px] border border-border-1 bg-surface-1 p-8 text-center shadow-2xl backdrop-blur-2xl sm:p-10">
          <div className="mb-7 flex justify-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-gold/20 bg-gold/10 neon-glow-gold-1">
              <ShieldCheck className="h-8 w-8 text-gold-light" />
            </div>
          </div>

          <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.32em] text-gold/75">
            {t('verify.eyebrow')}
          </p>

          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
            {t('verify.title')}
          </h1>

          <p className="mx-auto mt-4 max-w-sm text-sm leading-7 text-ink-0/55">
            {t('verify.subtitle')}
          </p>

          <div className="mt-8 rounded-2xl border border-border-1 bg-surface-inset px-5 py-6">
            <div className="flex items-center justify-center gap-3">
              {submitting ? (
                <Loader2 className="h-5 w-5 animate-spin text-gold" />
              ) : (
                <ShieldCheck className="h-5 w-5 text-gold-light" />
              )}

              <span className="text-sm text-ink-0/70">
                {submitting
                  ? t('verify.verifying')
                  : t('verify.button')}
            </span>
            </div>
          </div>

          {error && (
            <p className="mt-4 text-sm leading-6 text-red-300">
              {error}
            </p>
          )}

          <button
            type="button"
            onClick={
              handleVerify
            }
            disabled={
              submitting
            }
            className="mt-7 flex w-full items-center justify-center gap-2 rounded-2xl border border-gold/20 bg-gold/[0.08] px-5 py-4 text-sm font-semibold text-gold-light transition hover:bg-gold/[0.14] disabled:cursor-not-allowed disabled:opacity-40"
          >
            {submitting ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <ArrowRight className="h-5 w-5" />
            )}

            {t('verify.button_next')}
          </button>

          <p className="mt-6 text-[11px] leading-5 text-ink-0/30">
            {t('verify.page_info')}
          </p>
        </section>
      </div>
    </main>
  )
}

export default VerifyPage