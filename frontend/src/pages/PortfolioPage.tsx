import React from 'react'
import { motion } from 'framer-motion'
import { useTranslation } from 'react-i18next'

const PortfolioPage: React.FC = () => {
  const { t } = useTranslation()

  return (
    <div className="min-h-screen pt-24 pb-20 section-padding">
      <div className="max-w-4xl mx-auto">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="text-center mb-10">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-gold/30 bg-gold/10 text-gold text-sm font-medium mb-4">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-gold-light opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-gold"></span>
            </span>
            {t('common.coming_soon', { defaultValue: 'Coming Soon' })}
          </div>
          <h1 className="text-4xl font-bold text-ink-0 mb-4">{t('nav.portfolio')}</h1>
          <p className="text-ink-3">{t('portfolio.description')}</p>
        </motion.div>

        <div className="glass rounded-2xl p-8 border-gold/10 text-center">
          <p className="text-ink-2 text-lg mb-6">{t('portfolio.coming_soon_desc', { defaultValue: 'Our portfolio of completed projects will be displayed here soon.' })}</p>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6 opacity-50">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="glass p-6 rounded-lg">
                <div className="h-40 bg-surface-1 rounded-md mb-4" />
                <h3 className="text-lg text-ink-0 font-semibold">{t('portfolio.project')} {i + 1}</h3>
                <p className="text-ink-3 text-sm">{t('portfolio.description')}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

export default PortfolioPage
