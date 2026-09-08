import React from 'react'
import { motion } from 'framer-motion'
import { useTranslation } from 'react-i18next'
import { DONATION_PERCENTAGE, DONATION_CAUSE } from '../utils/constants'

const DonationPage: React.FC = () => {
  const { t } = useTranslation()
  const suggested = 25
  const donation = (amount: number) => (amount * DONATION_PERCENTAGE).toFixed(2)

  return (
    <div className="min-h-screen pt-24 pb-20 section-padding">
      <div className="max-w-3xl mx-auto">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="glass rounded-2xl p-8 border-gold/10 text-center">
          <h1 className="text-2xl font-bold text-white mb-4">{t('donation.title')} {DONATION_CAUSE}</h1>
          <p className="text-white/60 mb-6">{t('donation.subtitle')}</p>
          <div className="space-y-3">
            {[10, 25, 50, 100].map((amt) => (
              <div key={amt} className="flex items-center justify-between bg-white/5 p-3 rounded-lg">
                <div className="text-white">${amt}</div>
                <div className="text-white/60">{t('donation.partner_contribution')}: ${donation(amt)}</div>
              </div>
            ))}
          </div>
          <p className="text-sm text-white/50 mt-4">{t('donation.suggested')}: ${suggested}</p>
        </motion.div>
      </div>
    </div>
  )
}

export default DonationPage
