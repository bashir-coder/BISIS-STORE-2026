import React from 'react'
import { motion } from 'framer-motion'
import { useTranslation } from 'react-i18next'
import { DONATION_PERCENTAGE } from '../utils/constants'

const DonationPage: React.FC = () => {
  const { t } = useTranslation()
  const suggested = 25
  const donation = (amount: number) => (amount * DONATION_PERCENTAGE).toFixed(2)

  return (
    <div className="min-h-screen pt-24 pb-20 section-padding">
      <div className="max-w-3xl mx-auto">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="glass rounded-2xl p-8 border-gold/10 text-center">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-gold/30 bg-gold/10 text-gold text-sm font-medium mb-4">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-gold-light opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-gold"></span>
            </span>
            {t('common.coming_soon', { defaultValue: 'Coming Soon' })}
          </div>
          <h1 className="text-2xl font-bold text-ink-0 mb-4">{t('donation.title')}</h1>
          <p className="text-ink-2 mb-6">{t('donation.subtitle')}</p>
          <div className="space-y-3 opacity-70">
            {[10, 25, 50, 100].map((amt) => (
              <div key={amt} className="flex items-center justify-between bg-surface-1 p-3 rounded-lg">
                <div className="text-ink-0">${amt}</div>
                <div className="text-ink-2">{t('donation.partner_contribution')}: ${donation(amt)}</div>
              </div>
            ))}
          </div>
          <p className="text-sm text-ink-3 mt-4">{t('donation.suggested')}: ${suggested}</p>
          <p className="text-ink-3 text-sm mt-4">{t('donation.coming_soon_desc', { defaultValue: 'Donation functionality will be available soon.' })}</p>
        </motion.div>
      </div>
    </div>
  )
}

export default DonationPage
