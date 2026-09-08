import React from 'react'
import { useTranslation } from 'react-i18next'
import { motion } from 'framer-motion'
import { Quote, Star } from 'lucide-react'
import { useInView } from '../hooks/useInView'

const Testimonials: React.FC = () => {
  const { t } = useTranslation()
  const { ref, isInView } = useInView()

  const quotes = [
    { text: t('testimonials.quote1'), author: t('testimonials.author') },
    { text: t('testimonials.quote2'), author: t('testimonials.author') },
    { text: t('testimonials.quote3'), author: t('testimonials.author') },
  ]

  return (
    <section ref={ref} className="py-24 section-padding relative overflow-hidden">
      <div className="absolute inset-0 bg-transparent" />
      <div className="max-w-7xl mx-auto relative">
        <motion.div initial={{ opacity: 0, y: 30 }} animate={isInView ? { opacity: 1, y: 0 } : {}} className="text-center mb-16">
          <h2 className="text-3xl sm:text-4xl font-bold font-outfit text-white mb-4">{t('testimonials.title')}</h2>
        </motion.div>
        <div className="grid md:grid-cols-3 gap-8">
          {quotes.map((quote, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 30 }}
              animate={isInView ? { opacity: 1, y: 0 } : {}}
              transition={{ delay: index * 0.15 }}
              className="glass rounded-2xl p-8 border-gold/5 hover:border-gold/20 transition-all card-hover"
            >
              <Quote className="w-10 h-10 text-gold/20 mb-4" />
              <p className="text-white/80 text-lg leading-relaxed mb-6">{quote.text}</p>
              <div className="flex items-center gap-2">
                <div className="flex">
                  {[...Array(5)].map((_, i) => (
                    <Star key={i} className="w-4 h-4 text-gold fill-gold" />
                  ))}
                </div>
                <span className="text-sm text-white/50">- {quote.author}</span>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}

export default Testimonials

