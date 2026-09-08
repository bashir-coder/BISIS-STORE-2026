import React from 'react'
import { useTranslation } from 'react-i18next'
import { motion } from 'framer-motion'
import { Headphones, Lock, Shield, Wallet } from 'lucide-react'
import { useInView } from '../hooks/useInView'

const icons = { Shield, Lock, Wallet, Headphones }

const TrustBadges: React.FC = () => {
  const { t } = useTranslation()
  const { ref, isInView } = useInView()

  const badges = [
    { icon: 'Lock', label: t('trust.badges.ssl'), detail: t('trust.badges.ssl_detail'), tone: 'from-cyan-300/15' },
    { icon: 'Shield', label: t('trust.badges.recaptcha'), detail: t('trust.badges.recaptcha_detail'), tone: 'from-violet-300/15' },
    { icon: 'Wallet', label: t('trust.badges.payment'), detail: t('trust.badges.payment_detail'), tone: 'from-gold/20' },
    { icon: 'Headphones', label: t('trust.badges.support'), detail: t('trust.badges.support_detail'), tone: 'from-emerald-300/15' },
  ]

  return (
    <section ref={ref} className="relative overflow-hidden border-y border-white/5 bg-transparent px-4 py-20 sm:px-6 lg:px-8">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-40 bg-[radial-gradient(ellipse_at_top,rgba(212,175,55,0.08),transparent_70%)]" />
      <div className="relative mx-auto max-w-7xl">
        <motion.div initial={{ opacity: 0, y: 12 }} animate={isInView ? { opacity: 1, y: 0 } : {}} transition={{ duration: 0.5 }} className="mb-10 text-center">
          <span className="text-sm font-semibold uppercase tracking-[0.2em] text-gold">{t('trust.eyebrow')}</span>
          <h2 className="mt-3 text-2xl font-bold text-white sm:text-3xl">{t('trust.title')}</h2>
        </motion.div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {badges.map((badge, index) => {
            const Icon = icons[badge.icon as keyof typeof icons]
            return (
              <motion.div
                key={badge.label}
                initial={{ opacity: 0, y: 20 }}
                animate={isInView ? { opacity: 1, y: 0 } : {}}
                transition={{ delay: index * 0.08, duration: 0.45 }}
                className={`group relative overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br ${badge.tone} to-transparent p-6 transition-all duration-300 hover:-translate-y-1 hover:border-gold/30 hover:bg-white/[0.06]`}
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
        </div>
      </div>
    </section>
  )
}

export default TrustBadges

