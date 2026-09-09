import React, { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { ArrowUp } from 'lucide-react'
import { useTranslation } from 'react-i18next'

const WHATSAPP_NUMBER = '970597997040'
const socialLabels = {
  ar: { instagram: 'تواصل عبر Instagram', x: 'تواصل عبر X', youtube: 'تواصل عبر YouTube' },
  en: { instagram: 'Contact via Instagram', x: 'Contact via X', youtube: 'Contact via YouTube' },
  tr: { instagram: 'Instagram üzerinden iletişim', x: 'X üzerinden iletişim', youtube: 'YouTube üzerinden iletişim' },
} as const

const FloatingButtons: React.FC = () => {
  const { t } = useTranslation()
  const [isVisible, setIsVisible] = useState(false)
  const [footerSocialVisible, setFooterSocialVisible] = useState(false)

  useEffect(() => {
    const handleScroll = () => setIsVisible(window.scrollY > 180)
    handleScroll()
    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  useEffect(() => {
    const footerSocial = document.getElementById('footer-social-links')
    if (!footerSocial) return
    const observer = new IntersectionObserver(([entry]) => setFooterSocialVisible(entry.isIntersecting), { threshold: 0.2 })
    observer.observe(footerSocial)
    return () => observer.disconnect()
  }, [])

  const telegramShareUrl = 'https://t.me/share/url?url=https%3A%2F%2FBİŞİŞ.com&text=BİŞİŞ'
  const language = (document.documentElement.lang || 'en').split('-')[0] as keyof typeof socialLabels
  const labels = socialLabels[language] || socialLabels.en

  const scrollToTop = () => window.scrollTo({ top: 0, behavior: 'smooth' })

  return (
    <>
      {!footerSocialVisible && <motion.div
        initial={{ opacity: 0, x: 28, scale: 0.85 }}
        animate={{ opacity: 1, x: 0, scale: 1 }}
        transition={{ type: 'spring', stiffness: 260, damping: 22 }}
        className="fixed bottom-24 right-4 z-50 flex flex-col gap-3 sm:right-6"
      >
            <a
              href={`https://wa.me/${WHATSAPP_NUMBER}`}
              target="_blank"
              rel="noreferrer"
              aria-label={t('floating.whatsapp')}
              title={t('floating.whatsapp_hint')}
              className="group relative flex h-12 w-12 items-center justify-center rounded-full border border-[#25D366]/50 bg-[#10261a]/90 text-[#25D366] shadow-[0_0_24px_rgba(37,211,102,0.22)] backdrop-blur-xl transition-all duration-300 hover:-translate-x-1 hover:bg-[#25D366] hover:text-white hover:shadow-[0_0_34px_rgba(37,211,102,0.5)]"
            >
              <span className="absolute inset-0 -z-10 rounded-full border border-[#25D366]/30 opacity-0 transition-all duration-300 group-hover:scale-125 group-hover:opacity-100" />
              <i aria-hidden="true" className="fa-brands fa-whatsapp text-xl" />
              <span className="pointer-events-none absolute right-14 whitespace-nowrap rounded-lg border border-white/10 bg-black/70 px-3 py-2 text-xs text-white/80 opacity-0 shadow-xl transition-opacity group-hover:opacity-100">
                {t('floating.whatsapp')}
              </span>
            </a>

            <a
              href={telegramShareUrl}
              target="_blank"
              rel="noreferrer"
              aria-label={t('floating.telegram')}
              title={t('floating.telegram_hint')}
              className="group relative flex h-12 w-12 items-center justify-center rounded-full border border-[#229ED9]/50 bg-[#10212d]/90 text-[#229ED9] shadow-[0_0_24px_rgba(34,158,217,0.22)] backdrop-blur-xl transition-all duration-300 hover:-translate-x-1 hover:bg-[#229ED9] hover:text-white hover:shadow-[0_0_34px_rgba(34,158,217,0.5)]"
            >
              <span className="absolute inset-0 -z-10 rounded-full border border-[#229ED9]/30 opacity-0 transition-all duration-300 group-hover:scale-125 group-hover:opacity-100" />
              <i aria-hidden="true" className="fa-brands fa-telegram text-xl" />
              <span className="pointer-events-none absolute right-14 whitespace-nowrap rounded-lg border border-white/10 bg-black/70 px-3 py-2 text-xs text-white/80 opacity-0 shadow-xl transition-opacity group-hover:opacity-100">
                {t('floating.telegram')}
              </span>
            </a>

            <a href="https://instagram.com/bishish_30" target="_blank" rel="noreferrer" aria-label="Instagram" title="Instagram" className="group relative flex h-12 w-12 items-center justify-center rounded-full border border-[#E4405F]/50 bg-[#321521]/90 text-[#E4405F] shadow-[0_0_24px_rgba(228,64,95,0.22)] backdrop-blur-xl transition-all hover:-translate-x-1 hover:bg-[#E4405F] hover:text-white">
              <i aria-hidden="true" className="fa-brands fa-instagram text-xl" />
              <span className="pointer-events-none absolute right-14 whitespace-nowrap rounded-lg border border-white/10 bg-black/70 px-3 py-2 text-xs text-white/80 opacity-0 shadow-xl transition-opacity group-hover:opacity-100">{labels.instagram}</span>
            </a>

            <a href="https://x.com/BİŞİŞHQ" target="_blank" rel="noreferrer" aria-label="X" title="X" className="group relative flex h-12 w-12 items-center justify-center rounded-full border border-white/25 bg-white/[0.06] text-white shadow-[0_0_24px_rgba(255,255,255,0.12)] backdrop-blur-xl transition-all hover:-translate-x-1 hover:bg-white hover:text-black">
              <i aria-hidden="true" className="fa-brands fa-x-twitter text-xl" />
              <span className="pointer-events-none absolute right-14 whitespace-nowrap rounded-lg border border-white/10 bg-black/70 px-3 py-2 text-xs text-white/80 opacity-0 shadow-xl transition-opacity group-hover:opacity-100">{labels.x}</span>
            </a>

            <a href="https://www.youtube.com/@BİŞİŞ-2030" target="_blank" rel="noreferrer" aria-label="YouTube" title="YouTube" className="group relative flex h-12 w-12 items-center justify-center rounded-full border border-[#FF0000]/50 bg-[#321010]/90 text-[#FF0000] shadow-[0_0_24px_rgba(255,0,0,0.22)] backdrop-blur-xl transition-all hover:-translate-x-1 hover:bg-[#FF0000] hover:text-white">
              <i aria-hidden="true" className="fa-brands fa-youtube text-xl" />
              <span className="pointer-events-none absolute right-14 whitespace-nowrap rounded-lg border border-white/10 bg-black/70 px-3 py-2 text-xs text-white/80 opacity-0 shadow-xl transition-opacity group-hover:opacity-100">{labels.youtube}</span>
            </a>
      </motion.div>}

      <AnimatePresence>
        {isVisible && (
          <motion.button
            initial={{ opacity: 0, y: 18, scale: 0.92 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 18, scale: 0.92 }}
            transition={{ delay: 0.12, type: 'spring', stiffness: 240, damping: 20 }}
            whileHover={{ scale: 1.08 }}
            whileTap={{ scale: 0.92 }}
            onClick={scrollToTop}
            className="fixed bottom-6 right-6 z-50 flex h-11 w-11 items-center justify-center rounded-full border border-white/10 bg-black/60 text-gold shadow-lg shadow-black/20 backdrop-blur-xl transition-colors hover:border-gold/30 hover:bg-gold/10"
            aria-label={t('floating.back_to_top')}
          >
            <ArrowUp className="h-4 w-4" />
          </motion.button>
        )}
      </AnimatePresence>
    </>
  )
}

export default FloatingButtons

