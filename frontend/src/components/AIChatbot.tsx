import React, { useState, useRef, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { motion, AnimatePresence } from 'framer-motion'
import { Bot, User, X, Sparkles, ArrowRight, Home } from 'lucide-react'
import { cn } from '../lib/utils'

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
  isQuestion?: boolean
}

interface FAQItem {
  id: string
  question: string
  answer: string
  category?: string
}

interface AIChatbotProps {
  onClose?: () => void
  variant?: 'floating' | 'page'
}

// ============================================================
// ✅ الترجمات المباشرة للواجهة (العنوان، الأزرار، التصنيفات)
// ============================================================
const uiTranslations = {
  ar: {
    greeting: 'مرحباً! أنا مساعد منصة BİŞİŞ. اختر سؤالاً من الأسفل للحصول على إجابة مفصلة.',
    title: 'المساعد الذكي',
    online: 'متصل',
    footer: 'اختر سؤالاً للحصول على إجابة مفصلة',
    back: 'عودة للأسئلة',
    categories: {
      all: 'الكل',
      pricing: '💰 الباقات والأسعار',
      payment: '💳 الدفع',
      services: '🧠 الخدمات',
      support: '🛠️ الدعم',
      general: 'ℹ️ عام',
    },
  },
  en: {
    greeting: 'Hello! I am the BİŞİŞ chatbot assistant. Choose a question below to get a detailed answer.',
    title: 'Smart Assistant',
    online: 'Online',
    footer: 'Choose a question for detailed answer',
    back: 'Back to questions',
    categories: {
      all: 'All',
      pricing: '💰 Pricing & Packages',
      payment: '💳 Payment',
      services: '🧠 Services',
      support: '🛠️ Support',
      general: 'ℹ️ General',
    },
  },
  tr: {
    greeting: 'Merhaba! BİŞİŞ sohbet botu asistanıyım. Detaylı bir cevap almak için aşağıdan bir soru seçin.',
    title: 'Akıllı Asistan',
    online: 'Çevrimiçi',
    footer: 'Detaylı cevap için bir soru seçin',
    back: 'Sorulara geri dön',
    categories: {
      all: 'Tümü',
      pricing: '💰 Fiyatlar ve Paketler',
      payment: '💳 Ödeme',
      services: '🧠 Hizmetler',
      support: '🛠️ Destek',
      general: 'ℹ️ Genel',
    },
  },
}

// ============================================================
// 📚 الأسئلة والأجوبة بثلاث لغات (كاملة)
// ============================================================
const faqsByLang: Record<string, FAQItem[]> = {
  ar: [
    {
      id: 'prices',
      question: '💰 ما هي أسعار باقاتكم؟',
      answer: '<strong>أسعار باقات BİŞİŞ:</strong><br><br>• <strong>باقة Foundation:</strong> $699 – مناسبة للشركات الناشئة والأفراد.<br>• <strong>باقة Growth:</strong> $1,499 – للشركات المتوسطة التي تبحث عن نمو سريع.<br>• <strong>باقة Scale:</strong> $2,499 – للشركات الجاهزة لجذب الاستثمارات.<br><br>راجع صفحة الباقات لمعرفة النطاق والمخرجات الحالية لكل باقة.',
      category: 'pricing',
    },
    {
      id: 'packages',
      question: '📦 ما هي الباقات التي تقدمونها؟',
      answer: 'نقدم <strong>3 باقات رئيسية:</strong><br><br>• <strong>Foundation:</strong> مثالية لبدء مشروعك بسرعة مع الخدمات الأساسية.<br>• <strong>Growth:</strong> تشمل أدوات تسويقية وتحليلية متقدمة.<br>• <strong>Scale:</strong> باقة متكاملة تشمل كل ما تحتاجه لعرض مشروعك على المستثمرين.<br><br>يمكنك استكشاف الخدمات الأساسية المتاحة ضمن نطاق BİŞİŞ V1.',
      category: 'pricing',
    },
    {
      id: 'payment',
      question: '💳 كيف يمكنني الدفع؟',
      answer: 'الدفع يتم عبر <strong>NOWPayments</strong> باستخدام <strong>USDC على BNB Smart Chain</strong>. تؤكد BİŞİŞ الدفع عبر NOWPayments قبل بدء التسليم.',
      category: 'payment',
    },
    {
      id: 'crypto',
      question: '🪙 لماذا تستخدمون العملات الرقمية؟',
      answer: 'تستخدم BİŞİŞ <strong>NOWPayments</strong> و<strong>USDC على BNB Smart Chain</strong> للدفع. يؤكد NOWPayments الدفع، ثم تبدأ BİŞİŞ مراجعة الطلب والتسليم.',
      category: 'payment',
    },
    {
      id: 'services',
      question: '🧠 ما هي الخدمات التي تقدمونها؟',
      answer: 'يضم كتالوج BİŞİŞ V1 الحالي <strong>18 خدمة أساسية</strong> ضمن فئة كتالوج واحدة هي <strong>Official Services</strong>.<br><br>راجع صفحة الباقات والخدمات للحصول على الأسماء والأسعار ومدة التسليم الحالية لكل خدمة.',
      category: 'services',
    },
    {
      id: 'timeline',
      question: '⏳ كم تستغرق مدة تنفيذ الخدمة؟',
      answer: 'تختلف مدة التنفيذ حسب الخدمة ونطاقها. راجع تفاصيل الخدمة أو اتفق على المدة قبل بدء التنفيذ؛ لا نعرض مدة موحدة غير مثبتة لكل الخدمات.',
      category: 'services',
    },
    {
      id: 'support',
      question: '🛠️ كيف يمكنني الحصول على الدعم الفني؟',
      answer: 'يمكنك الحصول على الدعم بعدة طرق:<br><br>📩 <strong>التذاكر:</strong> إذا كانت متاحة لحسابك، أرسل طلب الدعم من لوحة التحكم.<br>💬 <strong>المحادثة:</strong> استخدم محادثة الطلب ضمن مساحة العمل عند توفر طلب نشط.<br>📧 <strong>قنوات التواصل:</strong> راجع صفحة الاتصال للقنوات الحالية المعتمدة.',
      category: 'support',
    },
    {
      id: 'refund',
      question: '💰 ما هي سياسة الاسترداد؟',
      answer: 'تُحدد أي سياسة استرداد معتمدة في شروط الطلب أو الاتفاق المكتوب. راجع صفحة الاتصال قبل إرسال استفسار عن الاسترداد.',
      category: 'support',
    },
    {
      id: 'about',
      question: '🏢 من نحن؟',
      answer: '<strong>BİŞİŞ</strong> هي منصة متكاملة تهدف إلى تحويل الأفكار إلى أنظمة أعمال قابلة للتوسع.<br><br>نحن نؤمن بأن كل رائد أعمال يستحق أدوات احترافية لبناء مشروعه بنجاح.<br><br>📌 <strong>رؤيتنا:</strong> تمكين رواد الأعمال والشركات الناشئة من النمو بسرعة وكفاءة.<br>📌 <strong>قيمنا:</strong> الجودة، الشفافية، والابتكار.',
      category: 'general',
    },
    {
      id: 'contact',
      question: '📞 كيف يمكنني التواصل معكم؟',
      answer: 'يمكنك التواصل معنا عبر القنوات الحالية المعتمدة في صفحة الاتصال.',
      category: 'general',
    },
  ],
  en: [
    {
      id: 'prices',
      question: '💰 What are your package prices?',
      answer: '<strong>BİŞİŞ Package Prices:</strong><br><br>• <strong>Foundation Package:</strong> $699 – Suitable for startups and individuals.<br>• <strong>Growth Package:</strong> $1,499 – For medium businesses seeking rapid growth.<br>• <strong>Scale Package:</strong> $2,499 – For businesses ready to attract investments.<br><br>See the packages page for the current scope and deliverables of each package.',
      category: 'pricing',
    },
    {
      id: 'packages',
      question: '📦 What packages do you offer?',
      answer: 'We offer <strong>3 main packages:</strong><br><br>• <strong>Foundation:</strong> Perfect for quickly launching your project with basic services.<br>• <strong>Growth:</strong> Includes advanced marketing and analytical tools.<br>• <strong>Scale:</strong> A comprehensive package covering everything you need to present your project to investors.<br><br>You can explore the core services available in the BİŞİŞ V1 scope.',
      category: 'pricing',
    },
    {
      id: 'payment',
      question: '💳 How can I pay?',
      answer: 'Payment is completed through <strong>NOWPayments</strong> using <strong>USDC on BNB Smart Chain</strong>. BİŞİŞ confirms payment through NOWPayments before fulfillment begins.',
      category: 'payment',
    },
    {
      id: 'crypto',
      question: '🪙 Why do you use cryptocurrencies?',
      answer: 'BİŞİŞ uses <strong>NOWPayments</strong> and <strong>USDC on BNB Smart Chain</strong> for payment. NOWPayments confirms the payment, then BİŞİŞ reviews the request and starts fulfillment.',
      category: 'payment',
    },
    {
      id: 'services',
      question: '🧠 What services do you offer?',
      answer: 'The current BİŞİŞ V1 catalog contains <strong>18 core services</strong> in one catalog category: <strong>Official Services</strong>.<br><br>Use the packages and services page to see the current names, prices, and delivery timing for each service.',
      category: 'services',
    },
    {
      id: 'timeline',
      question: '⏳ How long does it take to deliver a service?',
      answer: 'Delivery time varies by service and scope. Review the service details or agree the timeline before work begins; we do not present one unverified duration for every service.',
      category: 'services',
    },
    {
      id: 'support',
      question: '🛠️ How can I get technical support?',
      answer: 'You can get support in several ways:<br><br>📩 <strong>Tickets:</strong> When available for your account, submit support from the dashboard.<br>💬 <strong>Order chat:</strong> Use the workspace conversation when you have an active request.<br>📧 <strong>Contact channels:</strong> Please use the current verified channels listed on the contact page.',
      category: 'support',
    },
    {
      id: 'refund',
      question: '💰 What is your refund policy?',
      answer: 'Any applicable refund policy is defined in the request terms or written agreement. Please review the contact page before asking about a refund.',
      category: 'support',
    },
    {
      id: 'about',
      question: '🏢 Who are we?',
      answer: '<strong>BİŞİŞ</strong> is an integrated platform aimed at turning ideas into scalable business systems.<br><br>We believe that every entrepreneur deserves professional tools to successfully build their project.<br><br>📌 <strong>Our Vision:</strong> Empowering entrepreneurs and startups to grow quickly and efficiently.<br>📌 <strong>Our Values:</strong> Quality, transparency, and innovation.',
      category: 'general',
    },
    {
      id: 'contact',
      question: '📞 How can I contact you?',
      answer: 'Please use the current verified contact channels listed on the contact page.',
      category: 'general',
    },
  ],
  tr: [
    {
      id: 'prices',
      question: '💰 Paket fiyatlarınız nedir?',
      answer: '<strong>BİŞİŞ Paket Fiyatları:</strong><br><br>• <strong>Foundation Paketi:</strong> $699 – Yeni başlayanlar ve bireyler için uygundur.<br>• <strong>Growth Paketi:</strong> $1,499 – Hızlı büyüme arayan orta ölçekli işletmeler için.<br>• <strong>Scale Paketi:</strong> $2,499 – Yatırım çekmeye hazır işletmeler için.<br><br>Her paketin güncel kapsamı ve teslimatları için paketler sayfasına bakın.',
      category: 'pricing',
    },
    {
      id: 'packages',
      question: '📦 Hangi paketleri sunuyorsunuz?',
      answer: '<strong>3 ana paket</strong> sunuyoruz:<br><br>• <strong>Foundation:</strong> Temel hizmetlerle projenizi hızlıca başlatmak için ideal.<br>• <strong>Growth:</strong> Gelişmiş pazarlama ve analitik araçları içerir.<br>• <strong>Scale:</strong> Projenizi yatırımcılara sunmak için ihtiyacınız olan her şeyi kapsayan kapsamlı bir paket.<br><br>BİŞİŞ V1 kapsamındaki temel hizmetleri inceleyebilirsiniz.',
      category: 'pricing',
    },
    {
      id: 'payment',
      question: '💳 Nasıl ödeme yapabilirim?',
      answer: 'Ödeme <strong>NOWPayments</strong> üzerinden <strong>BNB Smart Chain’de USDC</strong> ile yapılır. BİŞİŞ, teslimat başlamadan önce ödemeyi NOWPayments üzerinden onaylar.',
      category: 'payment',
    },
    {
      id: 'crypto',
      question: '🪙 Neden kripto para kullanıyorsunuz?',
      answer: 'BİŞİŞ ödeme için <strong>NOWPayments</strong> ve <strong>BNB Smart Chain’de USDC</strong> kullanır. NOWPayments ödemeyi onaylar, ardından BİŞİŞ talebi inceler ve teslimatı başlatır.',
      category: 'payment',
    },
    {
      id: 'services',
      question: '🧠 Hangi hizmetleri sunuyorsunuz?',
      answer: 'Güncel BİŞİŞ V1 kataloğu <strong>18 temel hizmet</strong> içerir ve bu hizmetler tek katalog kategorisinde toplanır: <strong>Official Services</strong>.<br><br>Her hizmetin güncel adı, fiyatı ve teslim süresi için paketler ve hizmetler sayfasını kullanın.',
      category: 'services',
    },
    {
      id: 'timeline',
      question: '⏳ Bir hizmetin teslimi ne kadar sürer?',
      answer: 'Teslim süresi hizmete ve kapsama göre değişir. Çalışma başlamadan önce hizmet ayrıntılarını inceleyin veya süreyi birlikte netleştirin; tüm hizmetler için doğrulanmamış tek bir süre sunmuyoruz.',
      category: 'services',
    },
    {
      id: 'support',
      question: '🛠️ Teknik desteği nasıl alabilirim?',
      answer: 'Desteği çeşitli yollarla alabilirsiniz:<br><br>📩 <strong>Destek talepleri:</strong> Hesabınızda mevcutsa panelden gönderin.<br>💬 <strong>Sipariş sohbeti:</strong> Aktif bir talebiniz olduğunda çalışma alanındaki sohbeti kullanın.<br>📧 <strong>İletişim kanalları:</strong> İletişim sayfasındaki güncel doğrulanmış kanalları kullanın.',
      category: 'support',
    },
    {
      id: 'refund',
      question: '💰 İade politikanız nedir?',
      answer: 'Varsa iade politikası talep koşullarında veya yazılı anlaşmada belirtilir. İade hakkında soru sormadan önce iletişim sayfasını inceleyin.',
      category: 'support',
    },
    {
      id: 'about',
      question: '🏢 Biz kimiz?',
      answer: '<strong>BİŞİŞ</strong>, fikirleri ölçeklenebilir iş sistemlerine dönüştürmeyi amaçlayan entegre bir platformdur.<br><br>Her girişimcinin projesini başarıyla kurmak için profesyonel araçları hak ettiğine inanıyoruz.<br><br>📌 <strong>Vizyonumuz:</strong> Girişimcileri ve yeni kurulan şirketleri hızlı ve verimli bir şekilde büyümeleri için güçlendirmek.<br>📌 <strong>Değerlerimiz:</strong> Kalite, şeffaflık ve yenilik.',
      category: 'general',
    },
    {
      id: 'contact',
      question: '📞 Sizinle nasıl iletişime geçebilirim?',
      answer: 'İletişim sayfasındaki güncel doğrulanmış kanalları kullanabilirsiniz.',
      category: 'general',
    },
  ],
}

const AIChatbot: React.FC<AIChatbotProps> = ({ onClose, variant = 'floating' }) => {
  const { i18n } = useTranslation()
  
  // ✅ اللغة من i18n مباشرة (تتغير تلقائياً)
  const [currentLang, setCurrentLang] = useState(i18n.language || 'ar')

  // ✅ مراقبة تغيير اللغة
  useEffect(() => {
    const handleLanguageChange = () => {
      setCurrentLang(i18n.language || 'ar')
    }
    i18n.on('languageChanged', handleLanguageChange)
    return () => i18n.off('languageChanged', handleLanguageChange)
  }, [i18n])

  const langData = uiTranslations[currentLang as keyof typeof uiTranslations] || uiTranslations.ar
  const faqs = faqsByLang[currentLang] || faqsByLang.ar
  
  const [messages, setMessages] = useState<Message[]>([
    { id: 'welcome', role: 'assistant', content: langData.greeting, timestamp: new Date() },
  ])
  const [selectedCategory, setSelectedCategory] = useState<string | null>('all')
  const [showQuestions, setShowQuestions] = useState(true)
  const containerRef = useRef<HTMLDivElement>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const isRTL = ['ar'].includes(currentLang)

  // تحديث رسالة الترحيب عند تغير اللغة
  useEffect(() => {
    setMessages(prev => {
      const updated = [...prev]
      if (updated.length > 0 && updated[0].id === 'welcome') {
        updated[0] = { ...updated[0], content: langData.greeting }
      }
      return updated
    })
  }, [langData.greeting])

  const categories = [
    { id: 'all', label: langData.categories.all },
    { id: 'pricing', label: langData.categories.pricing },
    { id: 'payment', label: langData.categories.payment },
    { id: 'services', label: langData.categories.services },
    { id: 'support', label: langData.categories.support },
    { id: 'general', label: langData.categories.general },
  ]

  const getFilteredQuestions = () => {
    if (selectedCategory === 'all' || !selectedCategory) return faqs
    return faqs.filter(f => f.category === selectedCategory)
  }

  const handleQuestionClick = (e: React.MouseEvent, faq: FAQItem) => {
    e.preventDefault()
    e.stopPropagation()

    const userMessage: Message = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: faq.question,
      timestamp: new Date(),
      isQuestion: true,
    }
    const assistantMessage: Message = {
      id: `assistant-${Date.now()}`,
      role: 'assistant',
      content: faq.answer,
      timestamp: new Date(),
    }
    setMessages(prev => [...prev, userMessage, assistantMessage])
    setShowQuestions(false)

    setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    }, 100)
  }

  const handleBackToQuestions = () => {
    setShowQuestions(true)
  }

  const handleCategoryChange = (categoryId: string) => {
    setSelectedCategory(categoryId)
  }

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
  }, [messages])

  const isPage = variant === 'page'

  return (
    <div
      ref={containerRef}
      className={cn(
        isPage
          ? 'w-full max-w-3xl h-[600px] max-h-[80vh]'
          : 'w-[400px] h-[550px] max-h-[90vh]',
        'bg-[#05070a]/95 backdrop-blur-2xl border border-gold/30 rounded-2xl overflow-hidden flex flex-col shadow-2xl shadow-gold/5 text-ink-0'
      )}
      dir={isRTL ? 'rtl' : 'ltr'}
    >
      {/* Header */}
      <div className="px-4 py-3 border-b border-border-1 flex items-center justify-between bg-gradient-to-r from-gold/15 to-transparent flex-shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-gold to-gold-deep flex items-center justify-center shadow-md shadow-gold/20">
            <Sparkles className="w-4 h-4 text-dark" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-ink-0">{langData.title}</h3>
            <div className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
              <span className="text-[10px] text-ink-0/50">{langData.online}</span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {!showQuestions && messages.length > 1 && (
            <button
              onClick={handleBackToQuestions}
              className="flex items-center gap-1.5 text-xs text-gold/80 hover:text-gold transition-all px-3 py-1.5 rounded-full border border-gold/20 hover:bg-gold/10"
            >
              <Home className="w-3.5 h-3.5" />
              {langData.back}
            </button>
          )}
          {onClose && variant === 'floating' && (
            <button onClick={onClose} className="text-ink-0/50 hover:text-ink-0 transition-colors">
              <X className="w-5 h-5" />
            </button>
          )}
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-hide">
        {messages.map((message) => {
          const isUser = message.role === 'user'
          return (
            <motion.div
              key={message.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className={cn('flex gap-2', isUser ? 'flex-row-reverse' : 'flex-row')}
            >
              <div className={cn(
                'w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0',
                isUser ? 'bg-surface-2' : 'bg-gradient-to-br from-gold to-gold-deep'
              )}>
                {isUser ? <User className="w-4 h-4 text-ink-0" /> : <Bot className="w-4 h-4 text-dark" />}
              </div>
              <div className={cn(
                'max-w-[80%] px-4 py-3 rounded-xl text-sm leading-relaxed',
                isUser
                  ? 'bg-gold/20 text-ink-0 rounded-tr-none border border-gold/30'
                  : 'bg-surface-1 border border-border-1 text-ink-0/90 rounded-tl-none'
              )}>
                {message.isQuestion ? (
                  <span className="text-gold font-medium">❓ {message.content}</span>
                ) : (
                  <div dangerouslySetInnerHTML={{ __html: message.content }} />
                )}
                <div className="text-[10px] text-ink-0/30 mt-1">
                  {message.timestamp.toLocaleTimeString()}
                </div>
              </div>
            </motion.div>
          )
        })}
        <div ref={messagesEndRef} />
      </div>

      {/* Questions Section */}
      <AnimatePresence>
        {showQuestions && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="p-4 border-t border-border-1 bg-surface-inset flex-shrink-0"
          >
            <div className="space-y-3">
              <div className="flex flex-wrap gap-1.5 mb-3">
                {categories.map((cat) => (
                  <button
                    key={cat.id}
                    onClick={() => handleCategoryChange(cat.id)}
                    className={cn(
                      'px-2.5 py-1 rounded-full text-[10px] font-medium transition-all',
                      selectedCategory === cat.id || (cat.id === 'all' && !selectedCategory)
                        ? 'bg-gold text-dark font-semibold shadow-sm shadow-gold/20'
                        : 'bg-surface-1 text-ink-0/50 hover:bg-surface-2'
                    )}
                  >
                    {cat.label}
                  </button>
                ))}
              </div>
              <div className="space-y-2 max-h-[180px] overflow-y-auto pr-1 scrollbar-hide">
                {getFilteredQuestions().map((faq) => (
                  <button
                    key={faq.id}
                    onClick={(e) => handleQuestionClick(e, faq)}
                    className="w-full text-left glass border border-border-1 hover:border-gold/30 rounded-xl px-4 py-2.5 transition-all group flex items-center justify-between"
                  >
                    <span className="text-sm text-ink-0/80 group-hover:text-ink-0">
                      {faq.question}
                    </span>
                    <ArrowRight className="w-4 h-4 text-gold/50 group-hover:text-gold transition-all" />
                  </button>
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Footer */}
      <div className="px-4 py-2 border-t border-border-1 bg-surface-inset text-center flex-shrink-0">
        <span className="text-[10px] text-ink-0/25">{langData.footer}</span>
      </div>
    </div>
  )
}

export default AIChatbot
