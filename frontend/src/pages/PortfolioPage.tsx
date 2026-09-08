import React from 'react'
import { motion } from 'framer-motion'
import { useTranslation } from 'react-i18next'

const PortfolioPage: React.FC = () => {
  const { t } = useTranslation()
  const items = Array.from({ length: 6 }).map((_, i) => ({ id: i + 1, title: `${t('portfolio.project')} ${i + 1}` }))

  return (
    <div className="min-h-screen pt-24 pb-20 section-padding">
      <div className="max-w-7xl mx-auto">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          <h1 className="text-3xl font-bold text-white mb-6">{t('nav.portfolio')}</h1>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {items.map((it) => (
              <div key={it.id} className="glass p-6 rounded-lg">
                <div className="h-40 bg-white/5 rounded-md mb-4" />
                <h3 className="text-lg text-white font-semibold">{it.title}</h3>
                <p className="text-white/60 text-sm">{t('portfolio.description', { title: it.title })}</p>
              </div>
            ))}
          </div>
        </motion.div>
      </div>
    </div>
  )
}

export default PortfolioPage
