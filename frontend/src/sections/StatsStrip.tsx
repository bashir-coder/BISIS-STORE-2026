import React from 'react'
import { motion } from 'framer-motion'
import { useTranslation } from 'react-i18next'
import { useInView } from '../hooks/useInView'
import AnimatedCounter from '../components/AnimatedCounter'

const StatsStrip: React.FC = () => {
  const { t } = useTranslation()
  const { ref, isInView } = useInView()

  const stats = [
    { value: '18', label: t('stats.services') },
    { value: '3', label: t('stats.packages') },
    { value: '6', label: t('stats.categories') },
    { value: 'V1', label: t('stats.scope') },
  ]

  return (
    <section ref={ref} className="py-12 section-padding border-y border-white/5 bg-transparent">
      <div className="max-w-7xl mx-auto">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
          {stats.map((stat, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, scale: 0.8 }}
              animate={isInView ? { opacity: 1, scale: 1 } : {}}
              transition={{ delay: index * 0.1 }}
              className="text-center"
            >
              <div className="text-3xl sm:text-4xl font-bold gold-gradient-text font-outfit"><AnimatedCounter value={stat.value} isVisible={isInView} /></div>
              <div className="text-sm text-white/40 mt-1">{stat.label}</div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}

export default StatsStrip
