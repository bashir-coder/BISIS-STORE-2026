// frontend/src/pages/PackagesPage.tsx
import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { ArrowRight, Check, Sparkles, SlidersHorizontal, Table2, X } from 'lucide-react'
import { Link } from 'react-router-dom'
import MagneticButton from '../components/MagneticButton'
import { api } from '../utils/api-client'
import { useTranslate } from '../hooks/useTranslate'
import { useLanguage } from '../contexts/LanguageContext'

interface Package {
  id: number
  slug: string
  category: string | null
  name: string
  description: string | null
  price: number
  features: string[]
  services: string[]
  persona_ids: string[]
  is_popular: boolean
  is_active: boolean
}

interface Service {
  id: number
  name: string
  description: string | null
  price: number
  delivery: string | null
  metadata?: { source_id?: string; service_type?: string; billing_period?: string } | null
  is_active: boolean
}

const serviceCopy: Record<string, Record<'ar' | 'en' | 'tr', string>> = {
  'svc-001': { ar: 'يحوّل التشتت إلى اتجاه واضح وخريطة عمل من 3 نقاط.', en: 'Turns scattered thinking into clear direction and a three-point action map.', tr: 'Dağınık düşünceleri net bir yöne ve üç maddelik eylem haritasına dönüştürür.' },
  'svc-002': { ar: 'تحليل معضلة استراتيجية مع الخيارات، التوصية، والخطة البديلة.', en: 'Analyzes a strategic dilemma with options, a recommendation, and a fallback plan.', tr: 'Stratejik bir ikilemi seçenekler, öneri ve alternatif planla analiz eder.' },
  'svc-003': { ar: 'جلسة استراتيجية واحدة لتحديد البوصلة للمرحلة القادمة.', en: 'One focused strategy session to set the compass for the next phase.', tr: 'Bir sonraki aşamanın yönünü belirleyen tek bir strateji oturumu.' },
  'svc-004': { ar: 'جلسة دعم نصي مركزة لقرار أو مشكلة محددة.', en: 'A focused text-based support session for one decision or problem.', tr: 'Tek bir karar veya sorun için odaklı yazılı destek oturumu.' },
  'svc-005': { ar: 'تحويل الفكرة إلى 3 رسائل: للمستثمر، للعميل، وللجمهور.', en: 'Turns an idea into three messages for investors, customers, and the wider audience.', tr: 'Fikri yatırımcı, müşteri ve genel kitle için üç mesaja dönüştürür.' },
  'svc-006': { ar: 'أقوى الاعتراضات المتوقعة مع ردود عملية جاهزة.', en: 'The strongest expected objections with practical ready-to-use responses.', tr: 'Beklenen en güçlü itirazlar ve kullanıma hazır pratik yanıtlar.' },
  'svc-007': { ar: 'الاختيار الأساسي + المخاطر + أول خطوة تنفيذية.', en: 'The core choice, its risks, and the first execution step.', tr: 'Ana seçim, riskleri ve ilk uygulama adımı.' },
  'svc-008': { ar: 'تحويل الفكرة التقنية إلى سردية إنسانية قابلة للاستخدام.', en: 'Turns a technical idea into a usable human-centered story.', tr: 'Teknik fikri kullanılabilir, insan odaklı bir hikayeye dönüştürür.' },
  'svc-009': { ar: 'تحليل استخدام الوقت وتحديد أهم فرص التفويض والتحسين.', en: 'Audits time use and identifies the highest-value delegation and improvement opportunities.', tr: 'Zaman kullanımını inceler ve en önemli yetki devri ve iyileştirme fırsatlarını belirler.' },
  'svc-010': { ar: 'تحديد الفجوة بين الوضع الحالي والرؤية مع حلول لسدها.', en: 'Maps the gap between the current state and the vision with ways to close it.', tr: 'Mevcut durum ile vizyon arasındaki boşluğu ve kapatma yollarını belirler.' },
  'svc-011': { ar: 'تحليل المنافسين وتحديد فرص محتوى غير مستغلة.', en: 'Analyzes competitors and identifies untapped content opportunities.', tr: 'Rakipleri analiz eder ve kullanılmamış içerik fırsatlarını ortaya çıkarır.' },
  'svc-012': { ar: 'اختبار الفكرة من وجهات نظر نقدية متعددة.', en: 'Tests the idea from multiple critical perspectives.', tr: 'Fikri birden fazla eleştirel bakış açısından test eder.' },
  'svc-013': { ar: 'تصميم نظام أسبوعي عملي لإدارة وقت المؤسس.', en: 'Designs a practical weekly operating system for the founder.', tr: 'Kurucunun zamanını yönetmesi için pratik bir haftalık sistem tasarlar.' },
  'svc-014': { ar: 'بناء positioning واضح ومميز وقابل للاستخدام تجاريًا.', en: 'Builds clear, distinctive positioning that can be used commercially.', tr: 'Net, ayırt edici ve ticari olarak kullanılabilir bir konumlandırma oluşturur.' },
  'svc-015': { ar: 'خريطة أتمتة عملية لتقليل الأعمال المتكررة.', en: 'A practical automation roadmap to reduce repetitive work.', tr: 'Tekrarlayan işleri azaltmak için pratik bir otomasyon yol haritası.' },
  'svc-016': { ar: 'خارطة استراتيجية 12–18 شهرًا مع milestones وKPIs.', en: 'A 12–18 month strategic roadmap with milestones and KPIs.', tr: 'Kilometre taşları ve KPI\'lar içeren 12–18 aylık stratejik yol haritası.' },
  'svc-017': { ar: 'هيكلة ومحتوى وقصة عرض استثماري متكامل، وليس مجرد تصميم شرائح.', en: 'Structure, content, and story for a complete investor pitch, not just slide design.', tr: 'Sadece slayt tasarımı değil, eksiksiz bir yatırım sunumunun yapısı, içeriği ve hikayesi.' },
  'svc-018': { ar: 'نظام تخطيط حياة مستمر مع تحليل AI ومراجعة بشرية وخطة وروتين ومتابعة.', en: 'An ongoing life-planning system with AI analysis, human review, planning, routines, and updates.', tr: 'Yapay zeka analizi, insan incelemesi, plan, rutin ve sürekli güncellemeler içeren yaşam planlama sistemi.' },
}

const uiCopy = {
  ar: { calculator: 'حاسبة النطاق والتقدير الفوري', hideCalculator: 'إخفاء الحاسبة الذكية', compare: 'مقارنة الباقات', calculatorTitle: 'حاسبة النطاق المخصص الفوري', chooseScope: 'اختر نطاقًا رسميًا', estimate: 'التقدير الموصى به', outputs: 'مخرجات', selectPackage: 'تحديد الباقة المطابقة', serviceOrOutput: 'الخدمة أو المخرج', compareHint: 'اختر الباقة المثالية التي تلبي احتياجك', close: 'إغلاق المقارنة' },
  en: { calculator: 'Live scope calculator', hideCalculator: 'Hide calculator', compare: 'Compare packages', calculatorTitle: 'Live scope calculator', chooseScope: 'Choose an official scope', estimate: 'Recommended estimate', outputs: 'outputs', selectPackage: 'Select matching package', serviceOrOutput: 'Service or deliverable', compareHint: 'Choose the package that fits your needs', close: 'Close comparison' },
  tr: { calculator: 'Canlı kapsam hesaplayıcı', hideCalculator: 'Hesaplayıcıyı gizle', compare: 'Paketleri karşılaştır', calculatorTitle: 'Canlı kapsam hesaplayıcı', chooseScope: 'Resmi bir kapsam seçin', estimate: 'Önerilen tahmin', outputs: 'çıktı', selectPackage: 'Eşleşen paketi seç', serviceOrOutput: 'Hizmet veya çıktı', compareHint: 'İhtiyacınıza uygun paketi seçin', close: 'Karşılaştırmayı kapat' },
} as const

const packageDescriptionCopy: Record<string, Record<'ar' | 'en' | 'tr', string>> = {
  foundation: { ar: 'وضوح واتجاه', en: 'Clarity & Direction', tr: 'Netlik ve Yön' },
  growth: { ar: 'استراتيجية ونمو', en: 'Strategy & Growth', tr: 'Strateji ve Büyüme' },
  scale: { ar: 'نمو وأتمتة وجاهزية استثمارية', en: 'Growth, Automation & Investment Readiness', tr: 'Büyüme, Otomasyon ve Yatırım Hazırlığı' },
}

const PackagesPage: React.FC = () => {
  const { t } = useTranslate()
  const { currentLang } = useLanguage()
  const copy = uiCopy[currentLang as 'ar' | 'en' | 'tr'] || uiCopy.en

  const [packages, setPackages] = useState<Package[]>([])
  const [services, setServices] = useState<Service[]>([])
  const [selectedPackageId, setSelectedPackageId] = useState<number | null>(null)
  const [selectedServiceId, setSelectedServiceId] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [showCalculator, setShowCalculator] = useState(false)
  const [showComparison, setShowComparison] = useState(false)

  // Scope Calculator State
  const [calcSlug, setCalcSlug] = useState('growth')

  const fetchPackages = useCallback(async () => {
    setLoading(true)
    setError(false)

    try {
      const [{ data: packageData }, { data: serviceData }] = await Promise.all([
        api.get('/api/packages'),
        api.get('/api/services'),
      ])
      setPackages(Array.isArray(packageData) ? packageData : [])
      setServices(Array.isArray(serviceData) ? serviceData : [])
    } catch (err) {
      console.error('Error fetching packages:', err)
      setPackages([])
      setError(true)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void fetchPackages()
  }, [fetchPackages])

  const uniqueServices = useMemo(() => {
    const seen = new Set<string>()
    return services.filter((service) => {
      if (service.metadata?.service_type === 'signature_subscription') return false
      const key = service.metadata?.source_id || service.name
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
  }, [services])

  const lifePlan = useMemo(
    () => services.find((service) => service.metadata?.service_type === 'signature_subscription') ?? null,
    [services],
  )

  const selectedPackage = useMemo(
    () => packages.find((pkg) => pkg.id === selectedPackageId) ?? null,
    [packages, selectedPackageId],
  )

  const selectedService = useMemo(
    () => uniqueServices.find((service) => service.id === selectedServiceId) ?? null,
    [selectedServiceId, uniqueServices],
  )

  const calculatedEstimate = useMemo(() => {
    const selected = packages.find((pkg) => pkg.slug === calcSlug) ?? packages[0]

    return {
      estimatedPrice: selected?.price ?? 0,
      recommendedSlug: selected?.slug ?? calcSlug,
      packageName: selected?.name ?? calcSlug,
      serviceCount: selected?.services?.length ?? 0,
    }
  }, [calcSlug, packages])

  return (
    <div className="min-h-screen px-4 pb-36 pt-24 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        {/* Header Badge & Title */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-10 text-center"
        >
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-gold/30 bg-gold/10 px-3.5 py-1.5 text-xs font-semibold uppercase tracking-[0.18em] text-gold shadow-lg shadow-gold/10">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-light opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald"></span>
            </span>
            <Sparkles className="h-3.5 w-3.5" />
            {String(t('hero.badge'))}
          </div>

          <h1 className="mb-4 text-4xl font-bold font-outfit text-white sm:text-5xl lg:text-6xl">
            {String(t('packages.title'))}
          </h1>

          <p className="mx-auto max-w-2xl text-base sm:text-lg text-white/60">
            {String(t('packages.subtitle'))}
          </p>

          {/* Action Bar: Calculator & Comparison Buttons */}
          {packages.length > 0 && <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <button
              type="button"
              onClick={() => setShowCalculator(!showCalculator)}
              className="inline-flex items-center gap-2 rounded-full border border-gold/30 bg-gold/10 px-4 py-2 text-xs sm:text-sm font-medium text-gold hover:bg-gold/20 transition-all shadow-sm shadow-gold/10"
            >
              <SlidersHorizontal className="h-4 w-4" />
              <span>{showCalculator ? copy.hideCalculator : copy.calculator}</span>
            </button>

            <button
              type="button"
              onClick={() => setShowComparison(true)}
              className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs sm:text-sm font-medium text-white/80 hover:border-gold/30 hover:bg-white/10 transition-all"
            >
              <Table2 className="h-4 w-4 text-emerald-light" />
              <span>{copy.compare}</span>
            </button>
          </div>}
        </motion.div>

        {/* Interactive Scope Calculator */}
        <AnimatePresence>
          {packages.length > 0 && showCalculator && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.3 }}
              className="mb-12 overflow-hidden"
            >
              <div className="glass-card rounded-3xl border border-gold/30 p-6 sm:p-8 shadow-2xl shadow-gold/5">
                <div className="flex items-center justify-between pb-4 border-b border-white/10">
                  <div className="flex items-center gap-2.5">
                    <Sparkles className="h-5 w-5 text-gold" />
                    <h3 className="text-lg font-bold font-outfit text-white">
                      {copy.calculatorTitle}
                    </h3>
                  </div>
                  <button
                    onClick={() => setShowCalculator(false)}
                    className="p-1.5 text-white/50 hover:text-white rounded-lg hover:bg-white/10 transition-colors"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>

                <div className="mt-6 grid gap-6 md:grid-cols-2">
                  <div>
                    <label className="block text-xs uppercase tracking-wider text-white/60 mb-2">
                      {copy.chooseScope}
                    </label>
                    <div className="space-y-2">
                      {packages.map((pkg) => (
                        <button
                          key={pkg.id}
                          type="button"
                          onClick={() => setCalcSlug(pkg.slug)}
                          className={`w-full p-3 rounded-xl border text-sm text-start font-medium transition-all ${
                            calcSlug === pkg.slug
                              ? 'border-gold bg-gold/15 text-gold shadow-md shadow-gold/10'
                              : 'border-white/10 bg-white/[0.02] text-white/70 hover:border-gold/30 hover:bg-white/5'
                          }`}
                        >
                          {pkg.name} · ${Number(pkg.price).toFixed(0)}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Recommendation Card */}
                  <div className="rounded-2xl border border-gold/40 bg-gradient-to-br from-gold/[0.08] to-transparent p-5 flex flex-col justify-between">
                    <div>
                      <span className="text-xs uppercase tracking-widest text-gold font-semibold">
                        {copy.estimate}
                      </span>
                      <div className="mt-2 text-3xl font-bold font-outfit text-white">
                        ~ ${calculatedEstimate.estimatedPrice}
                      </div>
                      <p className="mt-1 text-xs text-white/60">
                        {calculatedEstimate.packageName} · {calculatedEstimate.serviceCount} {copy.outputs}
                      </p>
                    </div>

                    <div className="mt-4 pt-4 border-t border-white/10">
                      <button
                        type="button"
                        onClick={() => {
                          const matched = packages.find((p) => p.slug === calculatedEstimate.recommendedSlug)
                          if (matched) setSelectedPackageId(matched.id)
                          setShowCalculator(false)
                        }}
                        className="w-full py-2.5 px-4 rounded-xl bg-gold text-dark text-xs font-bold uppercase tracking-wider hover:bg-gold-light transition-all shadow-lg shadow-gold/20"
                      >
                        {copy.selectPackage}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <section className="mb-14" aria-labelledby="official-services-title">
          <div className="mb-6 flex items-end justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gold">BİŞİŞ V1</p>
              <h2 id="official-services-title" className="mt-2 text-2xl font-bold font-outfit text-white sm:text-3xl">
                {t('packages.official_services', 'Official services')}
              </h2>
            </div>
            <span className="text-sm text-white/50">{uniqueServices.length} {t('packages.services_count', 'services')}</span>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {uniqueServices.map((service) => {
              const isSubscription = service.metadata?.service_type === 'signature_subscription'
              return (
                <article key={service.id} className={`rounded-2xl border p-5 transition-all ${selectedServiceId === service.id ? 'border-gold bg-gold/[0.12] shadow-xl shadow-gold/10' : 'border-white/10 bg-white/[0.03]'}`}>
                  <div className="flex items-start justify-between gap-3">
                    <h3 className="font-semibold text-white">{service.name}</h3>
                    {isSubscription && <span className="shrink-0 rounded-full border border-gold/30 bg-gold/10 px-2 py-1 text-[10px] font-semibold text-gold">Signature Subscription</span>}
                  </div>
                  <p className="mt-2 min-h-12 text-sm leading-6 text-white/60">{serviceCopy[service.metadata?.source_id || '']?.[currentLang as 'ar' | 'en' | 'tr'] || service.description}</p>
                  <div className="mt-4 flex items-center justify-between border-t border-white/10 pt-4 text-sm">
                    <span className="font-semibold text-gold">${Number(service.price).toFixed(0)}{isSubscription ? '/month' : ''}</span>
                    <span className="text-white/45">{service.delivery}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      if (isSubscription) {
                        window.location.assign('/services/life-plan')
                        return
                      }
                      setSelectedServiceId(selectedServiceId === service.id ? null : service.id)
                      setSelectedPackageId(null)
                    }}
                    className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl border border-gold/30 bg-gold/10 py-3 text-sm font-semibold text-gold transition-all hover:bg-gold hover:text-dark"
                  >
                    {selectedServiceId === service.id ? String(t('packages.selected')) : String(t('packages.select'))}
                    {selectedServiceId === service.id && <Check className="h-4 w-4" />}
                  </button>
                </article>
              )
            })}
          </div>
        </section>

        {lifePlan && (
          <section className="mb-14" aria-labelledby="life-plan-feature-title">
            <article className="mx-auto max-w-4xl rounded-2xl border border-gold/50 bg-gradient-to-br from-gold/[0.12] via-white/[0.04] to-transparent p-6 shadow-2xl shadow-gold/10 sm:p-8">
              <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
                <div>
                  <span className="inline-flex rounded-full border border-gold/30 bg-gold/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-gold">Signature Subscription</span>
                  <h2 id="life-plan-feature-title" className="mt-4 text-3xl font-bold font-outfit text-white">{lifePlan.name}</h2>
                  <p className="mt-2 max-w-2xl text-sm leading-6 text-white/65">{serviceCopy[lifePlan.metadata?.source_id || '']?.[currentLang as 'ar' | 'en' | 'tr'] || lifePlan.description}</p>
                  <p className="mt-4 text-2xl font-bold font-outfit text-gold">${Number(lifePlan.price).toFixed(0)}/month</p>
                </div>
                <Link to="/services/life-plan" className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-gold px-5 py-3 text-sm font-semibold text-dark transition hover:bg-gold-light">
                  {currentLang === 'ar' ? 'استكشف The Life Plan™' : currentLang === 'tr' ? 'The Life Plan™\'ı keşfet' : 'Explore The Life Plan™'}
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
            </article>
          </section>
        )}

        {/* Packages Grid */}
        {loading ? (
          <div
            className="mx-auto max-w-2xl rounded-2xl border border-white/10 bg-white/[0.03] py-16 text-center text-white/40"
            role="status"
          >
            {String(t('dashboard.loading'))}
          </div>
        ) : error ? (
          <div
            className="mx-auto max-w-2xl rounded-2xl border border-red-300/20 bg-red-300/5 p-8 text-center"
            role="alert"
          >
            <p className="text-white/70">
              {String(t('dashboard.error'))}
            </p>

            <button
              type="button"
              onClick={() => void fetchPackages()}
              className="mt-4 rounded-full border border-gold/30 px-5 py-2 text-sm text-gold transition-colors hover:bg-gold/10"
            >
              {String(t('dashboard.retry'))}
            </button>
          </div>
        ) : packages.length === 0 ? (
          <div className="py-16 text-center text-white/40">
            {String(t('packages.noPackages'))}
          </div>
        ) : (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {packages.map((pkg, index) => {
              const isSelected = selectedPackageId === pkg.id

              return (
                <motion.article
                  key={pkg.id}
                  id={pkg.slug}
                  initial={{ opacity: 0, y: 24 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{
                    delay: index * 0.08,
                    duration: 0.45,
                  }}
                  whileHover={{ y: -4, rotateX: 1 }}
                  className={`group spotlight-card relative flex flex-col overflow-hidden rounded-2xl border p-6 transition-all duration-300 ${
                    pkg.is_popular ? 'neon-shimmer-border border-gold/40 shadow-xl shadow-gold/10' : ''
                  } ${
                    isSelected
                      ? 'border-gold bg-gold/[0.12] shadow-2xl shadow-gold/20'
                      : 'border-white/10 bg-white/[0.03] hover:border-gold/30 hover:bg-white/[0.055]'
                  }`}
                >
                  <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-gold/60 to-transparent opacity-0 transition-opacity group-hover:opacity-100" />

                  <div className="flex items-start justify-between gap-4">
                    {pkg.category ? (
                      <span className="rounded-full bg-gold/10 px-3 py-1 text-xs text-gold">
                        {pkg.category}
                      </span>
                    ) : (
                      <span />
                    )}

                    {pkg.is_popular && (
                      <span className="rounded-full border border-gold/30 bg-gold/10 px-3 py-1 text-xs font-semibold text-gold">
                        {String(t('packages.popular'))}
                      </span>
                    )}
                  </div>

                  <h2 className="mt-5 text-2xl font-bold font-outfit text-white">
                    {pkg.name}
                  </h2>

                  <p className="mt-2 min-h-12 text-sm leading-6 text-white/60">
                    {packageDescriptionCopy[pkg.slug]?.[currentLang as 'ar' | 'en' | 'tr'] || pkg.description}
                  </p>

                  <div className="my-5 flex items-end gap-2 border-b border-white/10 pb-5">
                    <span className="font-outfit text-3xl font-bold text-gold">
                      ${Number(pkg.price || 0).toFixed(2)}
                    </span>
                  </div>

                  <div className="flex-1 space-y-3">
                    {(pkg.features || []).map((feature, featureIndex) => (
                      <div
                        key={`${pkg.id}-${featureIndex}`}
                        className="flex items-start gap-2 text-sm text-white/70"
                      >
                        <Check className="mt-0.5 h-4 w-4 shrink-0 text-gold" />
                        <span>{feature}</span>
                      </div>
                    ))}
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      setSelectedServiceId(null)
                      setSelectedPackageId(isSelected ? null : pkg.id)
                    }}
                    aria-pressed={isSelected}
                    className={`mt-7 flex w-full items-center justify-center gap-2 rounded-xl border py-3 text-sm font-semibold transition-all ${
                      isSelected
                        ? 'border-gold bg-gold text-dark shadow-lg shadow-gold/20'
                        : 'border-gold/30 bg-gold/10 text-gold hover:bg-gold/20'
                    }`}
                  >
                    {isSelected ? (
                      <Check className="h-4 w-4" />
                    ) : null}

                    {isSelected
                      ? String(t('packages.selected'))
                      : 'View Package'}
                  </button>
                </motion.article>
              )
            })}
          </div>
        )}
      </div>

      {/* Comparison Modal */}
      <AnimatePresence>
        {packages.length > 0 && showComparison && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md"
          >
            <motion.div
              initial={{ scale: 0.94, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.94, opacity: 0 }}
              className="relative w-full max-w-4xl max-h-[85vh] overflow-y-auto glass-card rounded-3xl border border-gold/30 p-6 sm:p-8 shadow-2xl"
            >
              <div className="flex items-center justify-between pb-4 border-b border-white/10">
                <div>
                  <h3 className="text-xl font-bold font-outfit text-white">
                    {copy.compare} BİŞIŞ V1
                  </h3>
                  <p className="text-xs text-white/50 mt-1">
                    {copy.compareHint}
                  </p>
                </div>
                <button
                  onClick={() => setShowComparison(false)}
                  className="p-2 text-white/60 hover:text-white rounded-xl hover:bg-white/10 transition-colors"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="mt-6 overflow-x-auto">
                <table className="w-full text-start text-sm">
                  <thead>
                    <tr className="border-b border-white/10 text-white/60">
                      <th className="py-3 px-4 text-start font-semibold">{copy.serviceOrOutput}</th>
                      {packages.map((pkg) => (
                        <th key={pkg.id} className="py-3 px-4 text-center font-semibold text-gold">
                          {pkg.name}<br />${Number(pkg.price).toFixed(0)}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5 text-white/80">
                    {[...new Set(packages.flatMap((pkg) => pkg.features || []))].map((feature) => (
                      <tr key={feature}>
                        <td className="py-3.5 px-4 font-medium">{feature}</td>
                        {packages.map((pkg) => (
                          <td key={pkg.id} className="py-3.5 px-4 text-center">
                            {(pkg.features || []).includes(feature) ? <Check className="mx-auto h-4 w-4 text-gold" /> : <span className="text-white/25">—</span>}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="mt-6 flex justify-end">
                <button
                  onClick={() => setShowComparison(false)}
                  className="px-6 py-2.5 rounded-xl bg-gold/15 border border-gold/30 text-gold text-sm font-semibold hover:bg-gold/25 transition-all"
                >
                  {copy.close}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Selected Package Floating Bar */}
      <AnimatePresence>
        {(selectedPackage || selectedService) && (
          <motion.div
            initial={{ opacity: 0, y: 28, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 28, scale: 0.96 }}
            className="fixed bottom-5 left-1/2 z-40 w-[calc(100%-2rem)] max-w-2xl -translate-x-1/2 rounded-2xl border border-gold/30 bg-black/70 p-4 shadow-2xl shadow-black/40 backdrop-blur-xl sm:p-5"
          >
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-gold">
                  {String(t('packages.selected'))}
                </p>

                <p className="mt-1 text-base font-semibold text-white">
                  {(selectedPackage?.name || selectedService?.name)}{' '}
                  <span className="font-outfit text-gold">
                    · ${Number(selectedPackage?.price ?? selectedService?.price ?? 0).toFixed(2)}
                  </span>
                </p>

                <p className="mt-1 text-xs text-white/45">
                  {String(t('packages.selection_hint'))}
                </p>
              </div>

              <MagneticButton>
                <Link
                  to="/payment"
                  state={{
                    ...(selectedPackage
                      ? { packageId: selectedPackage.id, package: selectedPackage.name, amount: selectedPackage.price }
                      : { serviceId: selectedService?.id, service: selectedService?.name, amount: selectedService?.price }),
                  }}
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-gold px-5 py-3 text-sm font-semibold text-dark shadow-lg shadow-gold/20 transition-colors hover:bg-gold-light"
                >
                  {String(t('packages.continue'))}
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </MagneticButton>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

export default PackagesPage
