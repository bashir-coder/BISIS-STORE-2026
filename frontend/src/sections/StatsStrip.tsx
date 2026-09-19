import React from 'react'
import { motion } from 'framer-motion'
import { useTranslation } from 'react-i18next'
import { useInView } from '../hooks/useInView'
import { useReducedMotion } from '../hooks/useReducedMotion'
import { STAGGER, DURATION, EASING } from '../lib/motion'
import AnimatedCounter from '../components/AnimatedCounter'

const StatsStrip: React.FC = () => {
  const { t } = useTranslation()
  const { ref, isInView } = useInView()
  const reducedMotion = useReducedMotion()

  const stats = [
    { value: '18', label: t('stats.services') },
    { value: '3', label: t('stats.packages') },
    { value: '1', label: t('stats.categories') },
    { value: 'V1', label: t('stats.scope') },
  ]

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: STAGGER.tight,
        delayChildren: 0.05,
      },
    },
  }

  const itemVariants = {
    hidden: { opacity: 0, y: 16 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { duration: DURATION.normal, ease: EASING.premium },
    },
  }

  return (
    <section ref={ref} className="py-12 section-padding border-y border-white/5 bg-transparent">
      <div className="max-w-7xl mx-auto">
        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate={reducedMotion || isInView ? 'visible' : 'hidden'}
          className="grid grid-cols-2 md:grid-cols-4 gap-8"
        >
          {stats.map((stat, index) => (
            <motion.div
              key={index}
              variants={itemVariants}
              custom={index}
              whileHover={{
                scale: reducedMotion ? 1 : 1.04,
                y: reducedMotion ? 0 : -4,
              }}
              className="text-center"
            >
              <div className="text-3xl sm:text-4xl font-bold gold-gradient-text font-outfit">
                <AnimatedCounter value={stat.value} isVisible={isInView} />
              </div>
              <div className="text-sm text-white/40 mt-1">{stat.label}</div>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  )
}

export default StatsStrip
