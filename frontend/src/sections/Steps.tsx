import React from 'react'
import { useTranslation } from 'react-i18next'
import { motion } from 'framer-motion'
import { useInView } from '../hooks/useInView'
import { useReducedMotion } from '../hooks/useReducedMotion'
import { STEPS } from '../utils/constants'
import { STAGGER, DURATION, EASING } from '../lib/motion'

const Steps: React.FC = () => {
  const { t } = useTranslation()
  const { ref, isInView } = useInView()
  const reducedMotion = useReducedMotion()

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: STAGGER.tight,
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
    <section ref={ref} className="py-24 section-padding bg-transparent relative">
      <div className="max-w-7xl mx-auto">
        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate={reducedMotion || isInView ? 'visible' : 'hidden'}
          className="text-center mb-16"
        >
          <motion.span
            variants={itemVariants}
            className="eyebrow text-gold text-sm font-semibold tracking-wider uppercase mb-4 block"
          >
            {t('steps.eyebrow')}
          </motion.span>
          <motion.h2
            variants={itemVariants}
            className="text-3xl sm:text-4xl lg:text-5xl font-bold font-outfit text-ink-0 mb-4"
          >
            {t('steps.title')}
          </motion.h2>
          <motion.p
            variants={itemVariants}
            className="text-ink-0/50 max-w-xl mx-auto"
          >
            {t('steps.sub')}
          </motion.p>
        </motion.div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {STEPS.map((step, index) => (
            <motion.div
              key={index}
              variants={itemVariants}
              custom={index}
              whileHover={{
                y: reducedMotion ? 0 : -6,
                scale: reducedMotion ? 1 : 1.03,
              }}
              className="relative"
            >
              <div className="card card-interactive p-6 h-full border-gold/5 hover:border-gold/20">
                <div className="text-4xl mb-4">{step.icon}</div>
                <div className="text-gold text-sm font-semibold mb-2">0{index + 1}</div>
                <h3 className="text-lg font-semibold text-ink-0 mb-2">{t(step.titleKey)}</h3>
                <p className="text-sm text-ink-0/50">{t(step.descKey)}</p>
              </div>
              {index < STEPS.length - 1 && (
                <div className="hidden lg:block absolute top-1/2 -right-3 w-6 h-px bg-gradient-to-r from-gold/30 to-transparent" />
              )}
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}

export default Steps
