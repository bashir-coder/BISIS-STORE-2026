import React from 'react'
import { motion } from 'framer-motion'
import { Activity, ShieldCheck, Zap, Globe2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useInView } from '../hooks/useInView'
import { useReducedMotion } from '../hooks/useReducedMotion'
import { STAGGER, EASING } from '../lib/motion'

const LiveStatusRibbon: React.FC = () => {
  const { t } = useTranslation()

  const metrics = [
    {
      icon: Activity,
      label: 'BİŞİŞ Core V1',
      status: t('livestatus.operational'),
      highlight: true,
    },
    {
      icon: Zap,
      label: t('livestatus.dispatch'),
      status: t('livestatus.dispatch_speed'),
    },
    {
      icon: ShieldCheck,
      label: t('livestatus.escrow'),
      status: t('livestatus.crypto'),
    },
    {
      icon: Globe2,
      label: t('livestatus.delivery'),
      status: t('livestatus.languages'),
    },
  ]

  const { ref, isInView } = useInView({ threshold: 0.1 })
  const reducedMotion = useReducedMotion()

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

  const leftSideVariants = {
    hidden: { opacity: 0, x: -12 },
    visible: {
      opacity: 1,
      x: 0,
      transition: { duration: 0.35, ease: EASING.premium },
    },
  }

  const itemVariants = {
    hidden: { opacity: 0, x: -12 },
    visible: (i: number) => ({
      opacity: 1,
      x: 0,
      transition: {
        duration: 0.3,
        ease: EASING.premium,
        delay: reducedMotion ? 0 : i * STAGGER.tight,
      },
    }),
  }

  return (
    <motion.div
      ref={ref}
      variants={containerVariants}
      initial="hidden"
      animate={reducedMotion || isInView ? 'visible' : 'hidden'}
      className="w-full border-y border-border-1 bg-surface-inset backdrop-blur-md py-2.5 overflow-hidden"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-wrap items-center justify-between gap-4 text-xs">
          <motion.div
            variants={leftSideVariants}
            className="flex items-center gap-2"
          >
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500" />
            </span>
              <span className="gold-glow-text font-semibold uppercase tracking-wider text-ink-0">
              {t('livestatus.system_health')}
            </span>
          </motion.div>

          <div className="flex flex-wrap items-center gap-6 sm:gap-8 text-ink-3">
            {metrics.map((m, idx) => (
              <motion.div
                key={idx}
                custom={idx}
                variants={itemVariants}
                className="flex items-center gap-2"
              >
                <m.icon className="w-3.5 h-3.5 text-gold/80" />
                <span className="text-ink-4">{m.label}:</span>
                <span className={m.highlight ? 'text-green-300 font-medium success-glow-text' : 'text-ink-1 font-medium'}>
                  {m.status}
                </span>
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </motion.div>
  )
}

export default LiveStatusRibbon
