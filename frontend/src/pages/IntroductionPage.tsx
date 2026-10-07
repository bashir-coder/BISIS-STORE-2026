import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { motion } from 'framer-motion'
import { Sparkles } from 'lucide-react'

const INTRODUCTION_SHOWN_KEY = 'BİŞİŞ_introduction_shown'

const IntroductionPage: React.FC = () => {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [show, setShow] = useState(false)

  useEffect(() => {
    const shown = localStorage.getItem(INTRODUCTION_SHOWN_KEY) === 'true'
    if (shown) {
      navigate('/', { replace: true })
    } else {
      setShow(true)
    }
  }, [navigate])

  const handleComplete = () => {
    localStorage.setItem(INTRODUCTION_SHOWN_KEY, 'true')
    navigate('/', { replace: true })
  }

  if (!show) return null

  return (
    <div className="min-h-screen flex items-center justify-center section-padding">
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="w-full max-w-lg"
      >
        <div className="glass rounded-2xl p-8 border-gold/10 text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gold/10 border border-gold/20 mb-6">
            <Sparkles className="w-8 h-8 text-gold" />
          </div>

          <h1 className="text-3xl font-bold text-ink-0 mb-4">
            {t('introduction.title', { defaultValue: 'BİŞİŞ' })}
          </h1>

          <p className="text-ink-2 mb-8 leading-relaxed">
            {t('introduction.subtitle', {
              defaultValue: 'Welcome to your platform. Access your dashboard to track orders, projects, and deliverables.',
            })}
          </p>

          <button
            onClick={handleComplete}
            className="btn-primary w-full flex items-center justify-center gap-2"
          >
            {t('nav.start')}
          </button>
        </div>
      </motion.div>
    </div>
  )
}

export default IntroductionPage
