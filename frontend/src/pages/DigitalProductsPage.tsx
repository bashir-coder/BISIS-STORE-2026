import React from 'react'
import { motion } from 'framer-motion'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'

const DigitalProductsPage: React.FC = () => {
  const { t } = useTranslation()

  const products = [
    { id: 1, name: t('digital_products.product1_name'), price: '$49', desc: t('digital_products.product1_desc') },
    { id: 2, name: t('digital_products.product2_name'), price: '$29', desc: t('digital_products.product2_desc') },
    { id: 3, name: t('digital_products.product3_name'), price: '$39', desc: t('digital_products.product3_desc') },
  ]

  return (
    <div className="min-h-screen pt-24 pb-20 section-padding">
      <div className="max-w-4xl mx-auto">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="text-center mb-10">
          <h1 className="text-4xl font-bold text-white mb-4">ًں›’ {t('digital_products.title')}</h1>
          <p className="text-white/50">{t('digital_products.subtitle')}</p>
        </motion.div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {products.map((prod) => (
            <div key={prod.id} className="glass rounded-2xl p-6 border-gold/10 text-center hover:border-gold/20 transition-all">
              <h3 className="text-lg font-bold text-white mb-2">{prod.name}</h3>
              <p className="text-white/50 text-sm mb-3">{prod.desc}</p>
              <p className="text-gold font-bold mb-4">{prod.price}</p>
              <Link
                to="/payment"
                className="btn-primary text-sm px-4 py-2"
                state={{ package: prod.name, amount: prod.price }}
              >
                {t('digital_products.buy')}
              </Link>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export default DigitalProductsPage
