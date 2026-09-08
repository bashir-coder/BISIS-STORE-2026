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
    greeting: 'مرحباً! أنا مساعد منصة BİŞIŞ. اختر سؤالاً من الأسفل للحصول على إجابة مفصلة.',
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
    greeting: 'Hello! I am the BİŞIŞ chatbot assistant. Choose a question below to get a detailed answer.',
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
    greeting: 'Merhaba! BİŞIŞ sohbet botu asistanıyım. Detaylı bir cevap almak için aşağıdan bir soru seçin.',
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
      answer: '<strong>أسعار باقات BİŞIŞ:</strong><br><br>• <strong>باقة Starter:</strong> $249 – مناسبة للشركات الناشئة والأفراد.<br>• <strong>باقة Growth:</strong> $649 – للشركات المتوسطة التي تبحث عن نمو سريع.<br>• <strong>باقة Investor-Ready:</strong> $1499 – للشركات الجاهزة لجذب الاستثمارات.<br><br>راجع صفحة الباقات لمعرفة النطاق والمخرجات الحالية لكل باقة.',
      category: 'pricing',
    },
    {
      id: 'packages',
      question: '📦 ما هي الباقات التي تقدمونها؟',
      answer: 'نقدم <strong>3 باقات رئيسية:</strong><br><br>• <strong>Starter:</strong> مثالية لبدء مشروعك بسرعة مع الخدمات الأساسية.<br>• <strong>Growth:</strong> تشمل أدوات تسويقية وتحليلية متقدمة.<br>• <strong>Investor-Ready:</strong> باقة متكاملة تشمل كل ما تحتاجه لعرض مشروعك على المستثمرين.<br><br>يمكنك استكشاف الخدمات الأساسية المتاحة ضمن نطاق BİŞIŞ V1.',
      category: 'pricing',
    },
    {
      id: 'payment',
      question: '💳 كيف يمكنني الدفع؟',
      answer: 'الدفع المخطط له هو <strong>USDC</strong> على شبكة <strong>Polygon</strong> بعد تهيئة verifier. حالياً سيعرض مسار الدفع حالة عدم التوفر بوضوح، ولا يبدأ تنفيذ الخدمة دون تحقق النظام من الدفع.',
      category: 'payment',
    },
    {
      id: 'crypto',
      question: '🪙 لماذا تستخدمون العملات الرقمية؟',
      answer: 'اخترنا <strong>Polygon USDC</strong> كطريقة دفع مخطط لها لأنها قابلة للتحقق على الشبكة. الدفع غير متاح حالياً حتى تكتمل تهيئة verifier، ولن يبدأ أي تنفيذ قبل تحقق النظام.',
      category: 'payment',
    },
    {
      id: 'services',
      question: '🧠 ما هي الخدمات التي تقدمونها؟',
      answer: 'نقدم <strong>18 خدمة أساسية</strong> مصنفة في 6 فئات رئيسية ضمن نطاق BİŞIŞ V1:<br><br>• <strong>AI Automation:</strong> أتمتة الذكاء الاصطناعي.<br>• <strong>Business Strategy:</strong> استراتيجية الأعمال.<br>• <strong>Legal & Compliance:</strong> الامتثال القانوني.<br>• <strong>Financial Modeling:</strong> النمذجة المالية.<br>• <strong>Growth Marketing:</strong> التسويق الرقمي.<br>• <strong>Product Development:</strong> تطوير المنتجات.<br><br>تظهر تفاصيل كل خدمة ونطاقها في كتالوج الخدمات.',
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
      answer: '<strong>BİŞIŞ</strong> هي منصة متكاملة تهدف إلى تحويل الأفكار إلى أنظمة أعمال قابلة للتوسع.<br><br>نحن نؤمن بأن كل رائد أعمال يستحق أدوات احترافية لبناء مشروعه بنجاح.<br><br>📌 <strong>رؤيتنا:</strong> تمكين رواد الأعمال والشركات الناشئة من النمو بسرعة وكفاءة.<br>📌 <strong>قيمنا:</strong> الجودة، الشفافية، والابتكار.',
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
      answer: '<strong>BİŞIŞ Package Prices:</strong><br><br>• <strong>Starter Package:</strong> $249 – Suitable for startups and individuals.<br>• <strong>Growth Package:</strong> $649 – For medium businesses seeking rapid growth.<br>• <strong>Investor-Ready Package:</strong> $1499 – For businesses ready to attract investments.<br><br>See the packages page for the current scope and deliverables of each package.',
      category: 'pricing',
    },
    {
      id: 'packages',
      question: '📦 What packages do you offer?',
      answer: 'We offer <strong>3 main packages:</strong><br><br>• <strong>Starter:</strong> Perfect for quickly launching your project with basic services.<br>• <strong>Growth:</strong> Includes advanced marketing and analytical tools.<br>• <strong>Investor-Ready:</strong> A comprehensive package covering everything you need to present your project to investors.<br><br>You can explore the core services available in the BİŞIŞ V1 scope.',
      category: 'pricing',
    },
    {
      id: 'payment',
      question: '💳 How can I pay?',
      answer: 'The planned payment method is <strong>USDC</strong> on <strong>Polygon</strong> once the verifier is configured. For now, the payment flow clearly shows an unavailable state, and delivery never starts without system verification.',
      category: 'payment',
    },
    {
      id: 'crypto',
      question: '🪙 Why do you use cryptocurrencies?',
      answer: 'We selected <strong>Polygon USDC</strong> as the planned payment method because the transaction can be verified on-chain. Payment is currently unavailable until the verifier is configured, and delivery never starts without system verification.',
      category: 'payment',
    },
    {
      id: 'services',
      question: '🧠 What services do you offer?',
      answer: 'We offer <strong>18 core services</strong> across 6 categories in the BİŞIŞ V1 scope:<br><br>• <strong>AI Automation:</strong> Artificial intelligence automation.<br>• <strong>Business Strategy:</strong> Business strategy development.<br>• <strong>Legal & Compliance:</strong> Legal compliance solutions.<br>• <strong>Financial Modeling:</strong> Financial modeling and analysis.<br>• <strong>Growth Marketing:</strong> Digital marketing solutions.<br>• <strong>Product Development:</strong> Product development services.<br><br>The service catalog shows the current details and scope of each service.',
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
      answer: '<strong>BİŞIŞ</strong> is an integrated platform aimed at turning ideas into scalable business systems.<br><br>We believe that every entrepreneur deserves professional tools to successfully build their project.<br><br>📌 <strong>Our Vision:</strong> Empowering entrepreneurs and startups to grow quickly and efficiently.<br>📌 <strong>Our Values:</strong> Quality, transparency, and innovation.',
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
      answer: '<strong>BİŞIŞ Paket Fiyatları:</strong><br><br>• <strong>Starter Paketi:</strong> $249 – Yeni başlayanlar ve bireyler için uygundur.<br>• <strong>Growth Paketi:</strong> $649 – Hızlı büyüme arayan orta ölçekli işletmeler için.<br>• <strong>Investor-Ready Paketi:</strong> $1499 – Yatırım çekmeye hazır işletmeler için.<br><br>Her paketin güncel kapsamı ve teslimatları için paketler sayfasına bakın.',
      category: 'pricing',
    },
    {
      id: 'packages',
      question: '📦 Hangi paketleri sunuyorsunuz?',
      answer: '<strong>3 ana paket</strong> sunuyoruz:<br><br>• <strong>Starter:</strong> Temel hizmetlerle projenizi hızlıca başlatmak için ideal.<br>• <strong>Growth:</strong> Gelişmiş pazarlama ve analitik araçları içerir.<br>• <strong>Investor-Ready:</strong> Projenizi yatırımcılara sunmak için ihtiyacınız olan her şeyi kapsayan kapsamlı bir paket.<br><br>BİŞIŞ V1 kapsamındaki temel hizmetleri inceleyebilirsiniz.',
      category: 'pricing',
    },
    {
      id: 'payment',
      question: '💳 Nasıl ödeme yapabilirim?',
      answer: 'Planlanan ödeme yöntemi verifier yapılandırıldıktan sonra <strong>Polygon</strong> ağında <strong>USDC</strong> olacaktır. Şimdilik ödeme akışı kullanılamayan durumu açıkça gösterir ve sistem doğrulaması olmadan teslimat başlamaz.',
      category: 'payment',
    },
    {
      id: 'crypto',
      question: '🪙 Neden kripto para kullanıyorsunuz?',
      answer: 'Doğrulanabilir bir ağ işlemi sağladığı için planlanan ödeme yöntemi <strong>Polygon USDC</strong> olacaktır. Doğrulayıcı yapılandırılana kadar ödeme kullanılamaz ve sistem doğrulaması olmadan teslimat başlamaz.',
      category: 'payment',
    },
    {
      id: 'services',
      question: '🧠 Hangi hizmetleri sunuyorsunuz?',
      answer: 'BİŞIŞ V1 kapsamında 6 ana kategoride <strong>18 temel hizmet</strong> sunuyoruz:<br><br>• <strong>AI Automation:</strong> Yapay zeka otomasyonu.<br>• <strong>Business Strategy:</strong> İş stratejisi geliştirme.<br>• <strong>Legal & Compliance:</strong> Yasal uyumluluk çözümleri.<br>• <strong>Financial Modeling:</strong> Finansal modelleme ve analiz.<br>• <strong>Growth Marketing:</strong> Dijital pazarlama çözümleri.<br>• <strong>Product Development:</strong> Ürün geliştirme hizmetleri.<br><br>Hizmet kataloğu her hizmetin güncel ayrıntılarını ve kapsamını gösterir.',
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
      answer: '<strong>BİŞIŞ</strong>, fikirleri ölçeklenebilir iş sistemlerine dönüştürmeyi amaçlayan entegre bir platformdur.<br><br>Her girişimcinin projesini başarıyla kurmak için profesyonel araçları hak ettiğine inanıyoruz.<br><br>📌 <strong>Vizyonumuz:</strong> Girişimcileri ve yeni kurulan şirketleri hızlı ve verimli bir şekilde büyümeleri için güçlendirmek.<br>📌 <strong>Değerlerimiz:</strong> Kalite, şeffaflık ve yenilik.',
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
        'bg-[#05070a]/95 backdrop-blur-2xl border border-gold/30 rounded-2xl overflow-hidden flex flex-col shadow-2xl shadow-gold/5 text-white'
      )}
      dir={isRTL ? 'rtl' : 'ltr'}
    >
      {/* Header */}
      <div className="px-4 py-3 border-b border-white/10 flex items-center justify-between bg-gradient-to-r from-gold/15 to-transparent flex-shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-gold to-gold-dark flex items-center justify-center shadow-md shadow-gold/20">
            <Sparkles className="w-4 h-4 text-dark" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-white">{langData.title}</h3>
            <div className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-emerald-light animate-pulse" />
              <span className="text-[10px] text-white/50">{langData.online}</span>
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
            <button onClick={onClose} className="text-white/50 hover:text-white transition-colors">
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
                isUser ? 'bg-white/10' : 'bg-gradient-to-br from-gold to-gold-dark'
              )}>
                {isUser ? <User className="w-4 h-4 text-white" /> : <Bot className="w-4 h-4 text-dark" />}
              </div>
              <div className={cn(
                'max-w-[80%] px-4 py-3 rounded-xl text-sm leading-relaxed',
                isUser
                  ? 'bg-gold/20 text-white rounded-tr-none border border-gold/30'
                  : 'bg-white/[0.05] border border-white/10 text-white/90 rounded-tl-none'
              )}>
                {message.isQuestion ? (
                  <span className="text-gold font-medium">❓ {message.content}</span>
                ) : (
                  <div dangerouslySetInnerHTML={{ __html: message.content }} />
                )}
                <div className="text-[10px] text-white/30 mt-1">
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
            className="p-4 border-t border-white/10 bg-black/40 flex-shrink-0"
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
                        : 'bg-white/5 text-white/50 hover:bg-white/10'
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
                    className="w-full text-left glass border border-white/10 hover:border-gold/30 rounded-xl px-4 py-2.5 transition-all group flex items-center justify-between"
                  >
                    <span className="text-sm text-white/80 group-hover:text-white">
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
      <div className="px-4 py-2 border-t border-white/5 bg-black/30 text-center flex-shrink-0">
        <span className="text-[10px] text-white/25">{langData.footer}</span>
      </div>
    </div>
  )
}

export default AIChatbot
