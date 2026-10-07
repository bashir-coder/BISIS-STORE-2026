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
        className="relative w-full max-w-2xl overflow-hidden rounded-3xl border border-border-1 bg-surface-1 p-8 text-center shadow-2xl shadow-black/20 backdrop-blur-xl sm:p-12"
      >
        <div className="pointer-events-none absolute -left-20 -top-20 h-48 w-48 rounded-full bg-gold/10 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-24 -right-16 h-56 w-56 rounded-full bg-blue/10 blur-3xl" />
        <div className="relative">
          <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl border border-gold/20 bg-gold/10 text-gold">
            <Compass aria-hidden="true" size={30} />
          </div>
          <p className="mb-3 text-sm font-semibold uppercase tracking-[0.28em] text-gold/80">404</p>
          <h1 id="not-found-title" className="text-3xl font-bold text-ink-0 sm:text-4xl">
            {t('notFound.title')}
          </h1>
          <p className="mx-auto mt-4 max-w-xl text-base leading-7 text-ink-2">
             {t('notFound.subtitle')}
          </p>
          <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
            <Link
              to="/"
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-gold px-5 py-3 font-semibold text-ink-0 transition-transform duration-150 hover:-translate-y-0.5 hover:bg-gold/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold focus-visible:ring-offset-2 focus-visible:ring-offset-black active:scale-[0.98]"
            >
              <Home aria-hidden="true" size={18} />
              {t('notFound.homeCta')}
            </Link>
            <Link
              to="/contact"
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-border-2 bg-surface-2 px-5 py-3 font-semibold text-ink-0 transition-colors duration-150 hover:bg-surface-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold focus-visible:ring-offset-2 focus-visible:ring-offset-black active:scale-[0.98]"
            >
              {t('notFound.contactCta')}
              <ArrowLeft aria-hidden="true" className="rtl:rotate-180" size={18} />
            </Link>
          </div>
        </div>
      </section>
    </main>
  )
}

export default NotFoundPage

