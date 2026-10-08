import React from 'react'
import { motion } from 'framer-motion'
import { useTranslation } from 'react-i18next'
import { BookOpen } from 'lucide-react'

const BlogResourcesPage: React.FC = () => {
  const { t } = useTranslation()

  return (
    <div className="min-h-screen pt-24 pb-20 section-padding">
      <div className="max-w-4xl mx-auto text-center">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="mb-10">
          <h1 className="text-4xl font-bold text-ink-0 mb-4">📚 {t('blog.title')}</h1>
          <p className="text-ink-3">{t('coming_soon.subtitle')}</p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="glass rounded-2xl p-12 border-gold/10"
        >
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gold/10 border border-gold/20 mb-6">
            <BookOpen className="w-8 h-8 text-gold" />
          </div>
          <h2 className="text-2xl font-bold text-ink-0 mb-4">{t('coming_soon.title')}</h2>
          <p className="text-ink-2 max-w-sm mx-auto">
            {t('coming_soon.subtitle')}
          </p>
        </motion.div>
      </div>
    </div>
  )
}

export default BlogResourcesPage
