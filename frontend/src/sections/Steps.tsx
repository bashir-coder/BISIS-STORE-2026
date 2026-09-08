import React from 'react'
import { useTranslation } from 'react-i18next'
import { motion } from 'framer-motion'
import { useInView } from '../hooks/useInView'
import { STEPS } from '../utils/constants'

const Steps: React.FC = () => {
  const { t } = useTranslation()
  const { ref, isInView } = useInView()

  return (
    <section ref={ref} className="py-24 section-padding bg-transparent relative">
      <div className="max-w-7xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          className="text-center mb-16"
        >
          <span className="text-gold text-sm font-semibold tracking-wider uppercase mb-4 block">
            {t('steps.eyebrow')}
          </span>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold font-outfit text-white mb-4">
            {t('steps.title')}
          </h2>
          <p className="text-white/50 max-w-xl mx-auto">{t('steps.sub')}</p>
        </motion.div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {STEPS.map((step, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 30 }}
              animate={isInView ? { opacity: 1, y: 0 } : {}}
              transition={{ delay: index * 0.15 }}
              className="relative"
            >
              <div className="glass rounded-2xl p-6 h-full card-hover border-gold/5 hover:border-gold/20">
                <div className="text-4xl mb-4">{step.icon}</div>
                <div className="text-gold text-sm font-semibold mb-2">0{index + 1}</div>
                <h3 className="text-lg font-semibold text-white mb-2">{t(step.titleKey)}</h3>
                <p className="text-sm text-white/50">{t(step.descKey)}</p>
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

