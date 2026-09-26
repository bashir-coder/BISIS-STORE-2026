import React from 'react'
import { motion } from 'framer-motion'
import { ArrowRight, Check, Sparkles } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'

const LifePlanPage: React.FC = () => {
  const navigate = useNavigate()
  const { t } = useTranslation()
  const includes = [
    t('lifeplan.includes.0'),
    t('lifeplan.includes.1'),
    t('lifeplan.includes.2'),
  ]

  return (
    <div className="min-h-screen px-4 pb-32 pt-28 sm:px-6 lg:px-8">
      <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} className="mx-auto max-w-5xl">
        <div className="mb-10 text-center">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-gold/30 bg-gold/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.16em] text-gold">
            <Sparkles className="h-4 w-4" />{t('lifeplan.eyebrow')}
          </div>
          <h1 className="text-4xl font-bold font-outfit text-white sm:text-6xl">{t('lifeplan.title')}</h1>
          <p className="mx-auto mt-4 max-w-2xl text-base leading-7 text-white/60 sm:text-lg">{t('lifeplan.subtitle')}</p>
        </div>
        <article className="mx-auto max-w-2xl rounded-2xl border border-gold/40 bg-white/[0.04] p-6 shadow-2xl shadow-gold/10 sm:p-8">
          <div className="flex items-end justify-between gap-4 border-b border-white/10 pb-6">
            <span className="text-sm font-semibold uppercase tracking-[0.16em] text-gold">{t('lifeplan.eyebrow')}</span>
            <span className="text-3xl font-bold font-outfit text-gold">{t('lifeplan.price')}</span>
          </div>
          <div className="mt-6 space-y-4">
            {includes.map((item) => <div key={item} className="flex items-start gap-3 text-sm text-white/75"><Check className="mt-0.5 h-4 w-4 shrink-0 text-gold" />{item}</div>)}
          </div>
          <button type="button" onClick={() => navigate('/payment', { state: { serviceId: 42, service: 'The Life Plan™', amount: 150 } })} className="mt-8 flex w-full items-center justify-center gap-2 rounded-xl bg-gold px-5 py-3 text-sm font-semibold text-dark transition hover:bg-gold-light">
            {t('lifeplan.cta')}<ArrowRight className="h-4 w-4" />
          </button>
        </article>
      </motion.div>
    </div>
  )
}

export default LifePlanPage
