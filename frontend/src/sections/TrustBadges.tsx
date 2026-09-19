import React from 'react'
import { useTranslation } from 'react-i18next'
import { motion } from 'framer-motion'
import { Shield, Lock, Wallet, Headphones } from 'lucide-react'
import { useInView } from '../hooks/useInView'
import { useReducedMotion } from '../hooks/useReducedMotion'
import { STAGGER, DURATION, EASING } from '../lib/motion'

import { SectionHeader } from '../components/ui/SectionHeader'

const icons = { Shield, Lock, Wallet, Headphones }

const TrustBadges: React.FC = () => {
  const { t } = useTranslation()
  const { ref, isInView } = useInView()
  const reducedMotion = useReducedMotion()

  const badges = [
    { icon: 'Lock', label: t('trust.badges.ssl'), detail: t('trust.badges.ssl_detail'), tone: 'from-cyan-300/15' },
    { icon: 'Shield', label: t('trust.badges.recaptcha'), detail: t('trust.badges.recaptcha_detail'), tone: 'from-violet-300/15' },
    { icon: 'Wallet', label: t('trust.badges.payment'), detail: t('trust.badges.payment_detail'), tone: 'from-gold/20' },
    { icon: 'Headphones', label: t('trust.badges.support'), detail: t('trust.badges.support_detail'), tone: 'from-emerald-300/15' },
  ]

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
    hidden: { opacity: 0, y: 20 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { duration: DURATION.normal, ease: EASING.premium },
    },
  }

  return (
    <section ref={ref} className="relative overflow-hidden border-y border-white/5 bg-transparent px-4 py-20 sm:px-6 lg:px-8">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-40 bg-[radial-gradient(ellipse_at_top,rgba(212,175,55,0.08),transparent_70%)]" />
      <div className="relative mx-auto max-w-7xl">
        <SectionHeader
          eyebrow={t('trust.eyebrow')}
          title={t('trust.title')}
          align="center"
          delay={0.05}
        />

        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate={reducedMotion || isInView ? 'visible' : 'hidden'}
          className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4"
        >
          {badges.map((badge, index) => {
            const Icon = icons[badge.icon as keyof typeof icons]
            return (
              <motion.div
                key={badge.label}
                variants={itemVariants}
                custom={index}
                whileHover={{
                  y: reducedMotion ? 0 : -6,
                  scale: reducedMotion ? 1 : 1.02,
                }}
                className={`group relative overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br ${badge.tone} to-transparent p-6 transition-all duration-300 hover:border-gold/30 hover:bg-white/[0.06]`}
              >
                <div className="mb-6 flex items-center justify-between">
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-gold/20 bg-gold/10 text-gold transition-transform duration-300 group-hover:scale-110">
                    <Icon className="h-5 w-5" />
                  </div>
                  <span className="text-xs font-semibold tracking-wider text-white/30">0{index + 1}</span>
                </div>
                <h3 className="text-sm font-semibold text-white">{badge.label}</h3>
                <p className="mt-2 text-xs leading-6 text-white/45">{badge.detail}</p>
              </motion.div>
            )
          })}
        </motion.div>
      </div>
    </section>
  )
}

export default TrustBadges
