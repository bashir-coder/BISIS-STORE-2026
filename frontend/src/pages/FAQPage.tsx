import React, { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { ChevronDown, HelpCircle } from 'lucide-react'
import { useTranslation } from 'react-i18next'

const FAQPage: React.FC = () => {
  const { t } = useTranslation()
  const faqs = [
    { q: t('faq.question1'), a: t('faq.answer1') },
    { q: t('faq.question2'), a: t('faq.answer2') },
    { q: t('faq.question3'), a: t('faq.answer3') },
  ]
  const [openIndex, setOpenIndex] = useState<number | null>(null)

  useEffect(() => {
    const hash = window.location.hash.match(/^#faq-(\d+)$/)
    if (hash) setOpenIndex(Number(hash[1]))
  }, [])

  const toggle = (index: number) => {
    const next = openIndex === index ? null : index
    setOpenIndex(next)
    if (next === null) window.history.replaceState(null, '', window.location.pathname)
    else window.history.replaceState(null, '', `#faq-${next}`)
  }

  return (
    <div className="min-h-screen px-4 pb-20 pt-24 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-3xl">
        <motion.div initial={{ opacity: 0, y: 22 }} animate={{ opacity: 1, y: 0 }} className="mb-10 text-center">
          <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-2xl border border-gold/20 bg-gold/10 text-gold shadow-lg shadow-gold/10">
            <HelpCircle className="h-5 w-5" />
          </div>
          <h1 className="text-4xl font-bold text-white sm:text-5xl">{t('faq.title')}</h1>
          <p className="mx-auto mt-4 max-w-xl text-sm leading-7 text-white/50">{t('faq.subtitle')}</p>
        </motion.div>

        <div className="space-y-3">
          {faqs.map((faq, index) => {
            const isOpen = openIndex === index
            return (
              <motion.section
                key={index}
                layout
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.08 }}
                className={`overflow-hidden rounded-2xl border transition-colors ${isOpen ? 'border-gold/40 bg-gold/[0.06]' : 'border-white/10 bg-white/[0.03] hover:border-white/20'}`}
              >
                <button
                  type="button"
                  onClick={() => toggle(index)}
                  aria-expanded={isOpen}
                  aria-controls={`faq-answer-${index}`}
                  className="flex w-full items-center justify-between gap-6 px-5 py-5 text-start text-white transition-colors hover:text-gold sm:px-6"
                >
                  <span className="text-sm font-semibold leading-6 sm:text-base">{faq.q}</span>
                  <ChevronDown className={`h-5 w-5 shrink-0 text-gold transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`} />
                </button>
                <AnimatePresence initial={false}>
                  {isOpen && (
                    <motion.div
                      id={`faq-answer-${index}`}
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.25, ease: 'easeOut' }}
                    >
                      <p className="border-t border-gold/10 px-5 pb-6 pt-4 text-sm leading-7 text-white/60 sm:px-6">{faq.a}</p>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.section>
            )
          })}
        </div>
      </div>
    </div>
  )
}

export default FAQPage

