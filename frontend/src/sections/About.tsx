import React from 'react'
import { useTranslation } from 'react-i18next'
import { motion } from 'framer-motion'
import { useInView } from '../hooks/useInView'
import { useReducedMotion } from '../hooks/useReducedMotion'
import { STAGGER, DURATION, EASING } from '../lib/motion'

import AnimatedCounter from '../components/AnimatedCounter'

const About: React.FC = () => {
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

  const leftVariants = {
    hidden: { opacity: 0, x: -30 },
    visible: {
      opacity: 1,
      x: 0,
      transition: { duration: DURATION.slow, ease: EASING.premium },
    },
  }

  const rightVariants = {
    hidden: { opacity: 0, x: 30 },
    visible: {
      opacity: 1,
      x: 0,
      transition: { duration: DURATION.slow, ease: EASING.premium },
    },
  }

  const itemVariants = {
    hidden: { opacity: 0, y: 12 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { duration: DURATION.normal, ease: EASING.premium },
    },
  }

  return (
    <section ref={ref} className="py-24 section-padding relative overflow-hidden">
      <div className="max-w-7xl mx-auto">
        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate={reducedMotion || isInView ? 'visible' : 'hidden'}
          className="grid lg:grid-cols-2 gap-16 items-center"
        >
          <motion.div variants={leftVariants}>
            <span className="eyebrow text-gold text-sm font-semibold tracking-widder uppercase mb-4 block">
              {t('about.eyebrow')}
            </span>
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold font-outfit text-ink-0 leading-tight mb-6">
              {t('about.title').split('<br />').map((line: string, i: number) => (
                <React.Fragment key={i}>
                  {line}
                  {i === 0 && <br />}
                </React.Fragment>
              ))}
            </h2>
            <p className="text-ink-2 text-lg leading-relaxed">
              {t('about.text')}
            </p>
          </motion.div>

          <motion.div variants={rightVariants}>
            <div className="absolute inset-0 bg-gradient-to-br from-gold/20 via-blue/10 to-transparent rounded-3xl blur-3xl" />
            <div className="relative glass rounded-3xl p-8 border border-gold/20 shadow-2xl shadow-gold/5">
              <motion.div
                variants={containerVariants}
                className="grid grid-cols-2 gap-6"
              >
                {stats.map((item, i) => (
                  <motion.div
                    key={i}
                    variants={itemVariants}
                    whileHover={{
                      scale: reducedMotion ? 1 : 1.05,
                      y: reducedMotion ? 0 : -3,
                    }}
                    className="text-center p-4 rounded-2xl bg-surface-1 border border-border-1 hover:border-gold/30 hover:bg-gold/[0.04] transition-all duration-300"
                  >
                    <div className="text-3xl sm:text-4xl font-bold gold-gradient-text font-outfit">
                      <AnimatedCounter value={item.value} isVisible={isInView} />
                    </div>
                     <div className="text-sm text-ink-3 mt-1.5">{item.label}</div>
                  </motion.div>
                ))}
              </motion.div>
            </div>
          </motion.div>
        </motion.div>
      </div>
    </section>
  )
}

export default About
