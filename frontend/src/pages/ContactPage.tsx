import React from 'react'
import { motion } from 'framer-motion'
import { useTranslation } from 'react-i18next'
import { Mail, MapPin, Phone } from 'lucide-react'

const ContactPage: React.FC = () => {
  const { t } = useTranslation()

  return (
    <div className="min-h-screen pt-24 pb-20 section-padding">
      <div className="max-w-6xl mx-auto">
        <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }}>
          <h1 className="text-4xl font-bold text-white mb-4">
            <span className="text-gold">{t('contact.title')}</span>
          </h1>
          <p className="text-white/50 mb-12">{t('contact.subtitle')}</p>
          
          <div className="grid md:grid-cols-3 gap-6">
            <div className="glass rounded-2xl border-gold/10 p-6 text-center">
              <Mail className="w-10 h-10 text-gold mx-auto mb-4" />
              <h3 className="text-white font-semibold mb-2">{t('contact.email')}</h3>
              <a href="mailto:info@BİŞİŞ.com" className="text-white/60 hover:text-gold transition">info@BİŞİŞ.com</a>
            </div>
            
            <div className="glass rounded-2xl border-gold/10 p-6 text-center">
              <Phone className="w-10 h-10 text-gold mx-auto mb-4" />
              <h3 className="text-white font-semibold mb-2">{t('contact.phone')}</h3>
              <a href="tel:+970597997040" className="text-white/60 hover:text-gold transition">+970 597 997 040</a>
            </div>
            
            <div className="glass rounded-2xl border-gold/10 p-6 text-center">
              <MapPin className="w-10 h-10 text-gold mx-auto mb-4" />
              <h3 className="text-white font-semibold mb-2">{t('contact.address')}</h3>
              <p className="text-white/60">{t('contact.address_text')}</p>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  )
}

export default ContactPage
