import React from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, Compass, Home } from 'lucide-react'
import { useTranslation } from 'react-i18next'

const NotFoundPage: React.FC = () => {
  const { t } = useTranslation()

  return (
    <main className="container mx-auto flex min-h-[62vh] items-center justify-center px-4 py-20">
      <section
        aria-labelledby="not-found-title"
        className="relative w-full max-w-2xl overflow-hidden rounded-3xl border border-white/10 bg-white/[0.04] p-8 text-center shadow-2xl shadow-black/20 backdrop-blur-xl sm:p-12"
      >
        <div className="pointer-events-none absolute -left-20 -top-20 h-48 w-48 rounded-full bg-cyan-400/10 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-24 -right-16 h-56 w-56 rounded-full bg-fuchsia-400/10 blur-3xl" />
        <div className="relative">
          <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl border border-cyan-300/20 bg-cyan-300/10 text-cyan-200">
            <Compass aria-hidden="true" size={30} />
          </div>
          <p className="mb-3 text-sm font-semibold uppercase tracking-[0.28em] text-cyan-200/80">404</p>
          <h1 id="not-found-title" className="text-3xl font-bold text-white sm:text-4xl">
            {t('notFound.title', 'This page could not be found')}
          </h1>
          <p className="mx-auto mt-4 max-w-xl text-base leading-7 text-white/65">
            {t('notFound.subtitle', 'The link may be outdated or the page may have moved. Choose a safe place to continue.')}
          </p>
          <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
            <Link
              to="/"
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-cyan-300 px-5 py-3 font-semibold text-slate-950 transition-transform duration-150 hover:-translate-y-0.5 hover:bg-cyan-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-200 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950 active:scale-[0.98]"
            >
              <Home aria-hidden="true" size={18} />
              {t('notFound.homeCta', 'Back to home')}
            </Link>
            <Link
              to="/packages"
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/15 bg-white/[0.06] px-5 py-3 font-semibold text-white transition-colors duration-150 hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-200 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950 active:scale-[0.98]"
            >
              {t('notFound.packagesCta', 'Explore packages')}
              <ArrowLeft aria-hidden="true" className="rtl:rotate-180" size={18} />
            </Link>
          </div>
        </div>
      </section>
    </main>
  )
}

export default NotFoundPage

