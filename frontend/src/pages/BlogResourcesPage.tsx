import React from 'react'
import { motion } from 'framer-motion'
import { useTranslation } from 'react-i18next'

const BlogResourcesPage: React.FC = () => {
  const { t } = useTranslation()

  return (
    <div className="min-h-screen pt-24 pb-20 section-padding">
      <div className="max-w-4xl mx-auto">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="text-center mb-10">
          <h1 className="text-4xl font-bold text-white mb-4">ًں“ڑ {t('blog.title')}</h1>
          <p className="text-white/50">{t('blog.subtitle')}</p>
        </motion.div>

        <div className="grid sm:grid-cols-2 gap-6">
          <div className="glass rounded-2xl p-6 border-gold/10 text-center">
            <h2 className="text-xl font-bold text-gold mb-2">{t('blog.coming_soon_articles')}</h2>
            <p className="text-white/50 text-sm">{t('blog.coming_soon_articles_desc')}</p>
          </div>
          <div className="glass rounded-2xl p-6 border-gold/10 text-center">
            <h2 className="text-xl font-bold text-gold mb-2">{t('blog.coming_soon_tools')}</h2>
            <p className="text-white/50 text-sm">{t('blog.coming_soon_tools_desc')}</p>
          </div>
        </div>
      </div>
    </div>
  )
}

export default BlogResourcesPage
