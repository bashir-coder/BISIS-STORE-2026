import React from 'react'
import { motion } from 'framer-motion'
import { ArrowRight, Check, Sparkles } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useLanguage } from '../contexts/LanguageContext'

const LifePlanPage: React.FC = () => {
  const navigate = useNavigate()
  const { currentLang } = useLanguage()
  const copy = {
    ar: { eyebrow: 'BİŞIŞ Signature Subscription', title: 'The Life Plan™', subtitle: 'نظام تخطيط حياة مستمر يجمع بين تحليل AI والمراجعة البشرية والخطة والمتابعة.', price: '$150/month', cta: 'متابعة إلى الدفع', includes: ['تحليل أفكارك وأهدافك وظروفك', 'مراجعة بشرية وإعداد خطة عملية', 'روتين قابل للتنفيذ ومتابعة وتحديث مستمر'] },
    en: { eyebrow: 'BİŞIŞ Signature Subscription', title: 'The Life Plan™', subtitle: 'An ongoing life-planning system combining AI analysis, human review, planning, and continuous support.', price: '$150/month', cta: 'Continue to payment', includes: ['Analysis of your ideas, goals, and circumstances', 'Human review and a practical plan', 'An actionable routine with ongoing updates'] },
    tr: { eyebrow: 'BİŞIŞ Signature Subscription', title: 'The Life Plan™', subtitle: 'Yapay zeka analizi, insan incelemesi, planlama ve sürekli desteği birleştiren yaşam planlama sistemi.', price: '$150/month', cta: 'Ödemeye devam et', includes: ['Fikirlerinizin, hedeflerinizin ve koşullarınızın analizi', 'İnsan incelemesi ve uygulanabilir plan', 'Uygulanabilir rutin ve sürekli güncellemeler'] },
  }[currentLang as 'ar' | 'en' | 'tr'] || undefined
  const content = copy || { eyebrow: 'BİŞIŞ Signature Subscription', title: 'The Life Plan™', subtitle: 'An ongoing life-planning system.', price: '$150/month', cta: 'Continue to payment', includes: ['AI analysis', 'Human review', 'Ongoing updates'] }

  return (
    <div className="min-h-screen px-4 pb-32 pt-28 sm:px-6 lg:px-8">
      <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} className="mx-auto max-w-5xl">
        <div className="mb-10 text-center">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-gold/30 bg-gold/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.16em] text-gold">
            <Sparkles className="h-4 w-4" />{content.eyebrow}
          </div>
          <h1 className="text-4xl font-bold font-outfit text-white sm:text-6xl">{content.title}</h1>
          <p className="mx-auto mt-4 max-w-2xl text-base leading-7 text-white/60 sm:text-lg">{content.subtitle}</p>
        </div>
        <article className="mx-auto max-w-2xl rounded-2xl border border-gold/40 bg-white/[0.04] p-6 shadow-2xl shadow-gold/10 sm:p-8">
          <div className="flex items-end justify-between gap-4 border-b border-white/10 pb-6">
            <span className="text-sm font-semibold uppercase tracking-[0.16em] text-gold">Signature Subscription</span>
            <span className="text-3xl font-bold font-outfit text-gold">{content.price}</span>
          </div>
          <div className="mt-6 space-y-4">
            {content.includes.map((item) => <div key={item} className="flex items-start gap-3 text-sm text-white/75"><Check className="mt-0.5 h-4 w-4 shrink-0 text-gold" />{item}</div>)}
          </div>
          <button type="button" onClick={() => navigate('/payment', { state: { serviceId: 42, service: 'The Life Plan™', amount: 150 } })} className="mt-8 flex w-full items-center justify-center gap-2 rounded-xl bg-gold px-5 py-3 text-sm font-semibold text-dark transition hover:bg-gold-light">
            {content.cta}<ArrowRight className="h-4 w-4" />
          </button>
        </article>
      </motion.div>
    </div>
  )
}

export default LifePlanPage
