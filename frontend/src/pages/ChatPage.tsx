import React from 'react'
import { motion } from 'framer-motion'
import { useTranslation } from 'react-i18next'
import { Sparkles } from 'lucide-react'
import AIChatbot from '../components/AIChatbot'

const ChatPage: React.FC = () => {
  const { t, i18n } = useTranslation()

  return (
    <div className="min-h-screen pt-24 pb-20 section-padding bg-transparent relative overflow-hidden">
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-gold/5 rounded-full blur-[128px]" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-gold/3 rounded-full blur-[128px]" />
      </div>

      <div className="relative max-w-4xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="text-center mb-8"
        >
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-gold/10 border border-gold/20 mb-4">
            <Sparkles className="w-4 h-4 text-gold" />
            <span className="text-sm text-gold-light font-medium">
              {t('chat.page.badge', 'المساعد الذكي BİŞIŞ')}
            </span>
          </div>
          <h1 className="text-3xl md:text-4xl font-bold text-white mb-3">
            {t('chat.page.title', 'كيف يمكنني مساعدتك اليوم؟')}
          </h1>
          <p className="text-white/50 max-w-xl mx-auto">
            {t('chat.page.subtitle', 'اختر سؤالاً من الأسفل للحصول على إجابة مفصلة واحترافية.')}
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.6 }}
          className="flex justify-center"
        >
          {}
          <AIChatbot key={i18n.language} variant="page" />
        </motion.div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
          className="text-center mt-8 text-white/20 text-xs"
        >
          <p>© 2026 BİŞIŞ – {t('chat.page.footer', 'جميع الحقوق محفوظة')}</p>
        </motion.div>
      </div>
    </div>
  )
}

export default ChatPage
