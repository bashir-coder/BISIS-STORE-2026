import React from 'react'
import { useTranslation } from 'react-i18next'
import { motion } from 'framer-motion'
import { Quote, Star } from 'lucide-react'
import { useInView } from '../hooks/useInView'
import { useReducedMotion } from '../hooks/useReducedMotion'
import { STAGGER, DURATION, EASING } from '../lib/motion'

import { SectionHeader } from '../components/ui/SectionHeader'

const Testimonials: React.FC = () => {
  const { t } = useTranslation()
  const { ref, isInView } = useInView()
  const reducedMotion = useReducedMotion()

  const quotes = [
    { text: t('testimonials.quote1'), author: t('testimonials.author') },
    { text: t('testimonials.quote2'), author: t('testimonials.author') },
    { text: t('testimonials.quote3'), author: t('testimonials.author') },
  ]

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: STAGGER.normal,
        delayChildren: 0.15,
      },
    },
  }

  const itemVariants = {
    hidden: { opacity: 0, y: 24 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { duration: DURATION.slow, ease: EASING.premium },
    },
  }

  return (
    <section ref={ref} className="py-24 section-padding relative overflow-hidden">
      <div className="absolute inset-0 bg-transparent" />
      <div className="max-w-7xl mx-auto relative">
        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate={reducedMotion || isInView ? 'visible' : 'hidden'}
        >
          <SectionHeader
            title={t('testimonials.title')}
            align="center"
            delay={0}
          />

          <div className="grid md:grid-cols-3 gap-8">
            {quotes.map((quote, index) => (
              <motion.div
                key={index}
                variants={itemVariants}
                custom={index}
                whileHover={{
                  y: reducedMotion ? 0 : -6,
                  scale: reducedMotion ? 1 : 1.02,
                }}
                className="card card-interactive p-8 border-gold/5 hover:border-gold/20 transition-all"
              >
                <Quote className="w-10 h-10 text-gold/20 mb-4" />
                <p className="text-ink-1 text-lg leading-relaxed mb-6">{quote.text}</p>
                <div className="flex items-center gap-2">
                  <div className="flex">
                    {[...Array(5)].map((_, i) => (
                      <Star key={i} className="w-4 h-4 text-gold fill-gold" />
                    ))}
                  </div>
                  <span className="text-sm text-ink-3">- {quote.author}</span>
                </div>
              </motion.div>
            ))}
          </div>
        </motion.div>
      </div>
    </section>
  )
}

export default Testimonials
