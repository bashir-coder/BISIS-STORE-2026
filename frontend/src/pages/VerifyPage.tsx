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
  useLocation,
  useNavigate,
} from 'react-router-dom'
import { useLanguage } from '../contexts/LanguageContext'

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

  const { currentLang } =
    useLanguage()

  const { executeRecaptcha } =
    useGoogleReCaptcha()

  const isArabic =
    currentLang === 'ar'

  const [error, setError] =
    useState('')

  const [submitting, setSubmitting] =
    useState(false)

  const handleVerify =
    async () => {
      setError('')

      if (!executeRecaptcha) {
        setError(
          isArabic
            ? 'تعذر تحميل نظام التحقق. أعد تحميل الصفحة وحاول مرة أخرى.'
            : 'Security verification is still loading. Please refresh and try again.',
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
          isArabic
            ? 'فشل التحقق الأمني. حاول مرة أخرى.'
            : 'Security verification failed. Please try again.',
        )
      } finally {
        setSubmitting(false)
      }
    }

  return (
    <main
      dir={
        isArabic
          ? 'rtl'
          : 'ltr'
      }
      className="relative min-h-screen overflow-hidden bg-[#050505] text-white"
    >
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute left-1/2 top-1/2 h-[540px] w-[540px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-emerald-500/[0.06] blur-3xl" />

        <div className="absolute left-1/2 top-1/2 h-[360px] w-[360px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-yellow-400/[0.045] blur-3xl" />
      </div>

      <div className="relative flex min-h-screen items-center justify-center px-5 py-10">
        <section className="w-full max-w-md rounded-[28px] border border-white/10 bg-white/[0.035] p-8 text-center shadow-2xl backdrop-blur-2xl sm:p-10">
          <div className="mb-7 flex justify-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-emerald-400/20 bg-emerald-400/[0.08] shadow-[0_0_36px_rgba(16,185,129,0.12)]">
              <ShieldCheck className="h-8 w-8 text-emerald-300" />
            </div>
          </div>

          <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.32em] text-yellow-300/75">
            BİŞIŞ Security
          </p>

          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
            {isArabic
              ? 'فحص أمني سريع'
              : 'Quick security check'}
          </h1>

          <p className="mx-auto mt-4 max-w-sm text-sm leading-7 text-white/55">
            {isArabic
              ? 'نحن نتحقق من أن الزيارة حقيقية قبل الدخول إلى BİŞIŞ.'
              : 'We are verifying that this is a legitimate visit before entering BİŞIŞ.'}
          </p>

          <div className="mt-8 rounded-2xl border border-white/10 bg-black/20 px-5 py-6">
            <div className="flex items-center justify-center gap-3">
              {submitting ? (
                <Loader2 className="h-5 w-5 animate-spin text-yellow-300" />
              ) : (
                <ShieldCheck className="h-5 w-5 text-emerald-300" />
              )}

              <span className="text-sm text-white/70">
                {submitting
                  ? isArabic
                    ? 'جاري التحقق...'
                    : 'Verifying...'
                  : isArabic
                    ? 'اضغط للمتابعة وإجراء فحص الأمان'
                    : 'Continue to run the security check'}
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
            className="mt-7 flex w-full items-center justify-center gap-2 rounded-2xl border border-yellow-300/20 bg-yellow-300/[0.08] px-5 py-4 text-sm font-semibold text-yellow-100 transition hover:bg-yellow-300/[0.14] disabled:cursor-not-allowed disabled:opacity-40"
          >
            {submitting ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <ArrowRight className="h-5 w-5" />
            )}

            {isArabic
              ? 'متابعة إلى BİŞIŞ'
              : 'Continue to BİŞIŞ'}
          </button>

          <p className="mt-6 text-[11px] leading-5 text-white/30">
            {isArabic
              ? 'هذه الصفحة مخصصة لفحص الأمان الأولي فقط.'
              : 'This page is used for the initial security verification only.'}
          </p>
        </section>
      </div>
    </main>
  )
}

export default VerifyPage