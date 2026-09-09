import React, { useEffect, useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import {
  ArrowRight,
  Check,
  ChevronDown,
  ExternalLink,
  FileCheck2,
  Gauge,
  Globe2,
  Layers3,
  Lock,
  MessageCircle,
  Package,
  Rocket,
  ShieldCheck,
  Sparkles,
  WalletCards,
  Workflow,
  Zap,
} from 'lucide-react'
import { Link } from 'react-router-dom'
import { api } from '../utils/api-client'
import { useTranslation } from 'react-i18next'

interface Service {
  id: number
  name: string
  description: string | null
  price: number
  delivery: string | null
  metadata?: {
    source_id?: string
    service_type?: string
    billing_period?: string
  } | null
  is_active: boolean
}

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

interface SystemStatus {
  status: string
  database?: string
  critical_configuration?: {
    nowpayments_api?: string
    nowpayments_ipn?: string
  }
  version?: string
  environment?: string
  uptime?: number
  timestamp?: string
}

const serviceDescriptions: Record<string, string> = {
  'svc-001': 'صياغة واضحة لرسالتك الأساسية وما الذي تريد أن يفهمه السوق عنك.',
  'svc-002': 'تحليل سريع لمعضلة استراتيجية مع خيارات واضحة وتوصية عملية.',
  'svc-003': 'جلسة مركزة لترتيب المشكلة، تحديد الاتجاه، والخروج بخطوات عملية.',
  'svc-004': 'جلسة قصيرة ومباشرة لمناقشة سؤال أو مشكلة محددة.',
  'svc-005': 'تقرير يربط بين ثلاث زوايا أساسية للوصول إلى رؤية أكثر وضوحًا.',
  'svc-006': 'محاكاة للاعتراضات المحتملة وتجهيز ردود أكثر قوة ووضوحًا.',
  'svc-007': 'تقرير يحدد الفكرة المركزية التي يجب أن يبنى عليها العمل.',
  'svc-008': 'صياغة قصة واضحة تساعد على تقديم الفكرة أو المشروع بطريقة مقنعة.',
  'svc-009': 'مراجعة استراتيجية لكيفية استخدام الوقت وتحديد مصادر الهدر والأولوية.',
  'svc-010': 'تحليل الفجوة بين الرؤية الحالية والمستوى الذي تريد الوصول إليه.',
  'svc-011': 'تحليل للفجوات في المحتوى مقارنة بالمنافسة والفرص غير المستغلة.',
  'svc-012': 'اختبار ضغط للفكرة أو الاستراتيجية لاكتشاف نقاط الضعف قبل التنفيذ.',
  'svc-013': 'مخطط تشغيلي يساعد المؤسس على تنظيم طريقة العمل والقرارات.',
  'svc-014': 'استراتيجية لتحديد موقع فريد وواضح في السوق.',
  'svc-015': 'خريطة عملية من سبعة أيام لتحديد فرص الأتمتة وأولويات التنفيذ.',
  'svc-016': 'مخطط شامل للرؤية التنفيذية والأهداف والاتجاه الاستراتيجي.',
  'svc-017': 'مخطط لبناء عرض تقديمي قوي وواضح للمشروع أو الفكرة.',
  'svc-018': 'اشتراك شهري مستمر للمساعدة في التخطيط والمراجعة والتنفيذ.',
}

const packageDescriptions: Record<string, string> = {
  foundation:
    'نقطة بداية مركزة لتحويل الفكرة أو المشكلة إلى أساس واضح يمكن البناء عليه.',
  growth:
    'المسار المتوازن لمن يريد الانتقال من الوضوح إلى استراتيجية وتنفيذ أكثر عمقًا.',
  scale:
    'حزمة أوسع للمشاريع التي تحتاج إلى طبقات أكبر من التحليل والاستراتيجية والتنفيذ.',
}

const fadeUp = {
  initial: { opacity: 0, y: 24 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, amount: 0.15 },
}

const LabPage: React.FC = () => {
  const { t } = useTranslation()

  const [services, setServices] = useState<Service[]>([])
  const [packages, setPackages] = useState<Package[]>([])
  const [liveStatus, setLiveStatus] = useState<SystemStatus | null>(null)
  const [readyStatus, setReadyStatus] = useState<SystemStatus | null>(null)

  const [loading, setLoading] = useState(true)
  const [systemLoading, setSystemLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [openFaq, setOpenFaq] = useState<number | null>(null)

  useEffect(() => {
    let cancelled = false

    const loadLabData = async () => {
      setLoading(true)
      setError(null)

      try {
        const [
          { data: serviceData },
          { data: packageData },
        ] = await Promise.all([
          api.get('/api/services'),
          api.get('/api/packages'),
        ])

        if (cancelled) return

        setServices(Array.isArray(serviceData) ? serviceData : [])
        setPackages(Array.isArray(packageData) ? packageData : [])
      } catch (err) {
        if (cancelled) return

        console.error('LAB catalog load failed:', err)
        setError(
          t(
            'lab.catalog_error',
            'تعذر تحميل الكتالوج الآن. يمكنك الانتقال إلى صفحة الباقات والمحاولة مرة أخرى.',
          ),
        )
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    void loadLabData()

    return () => {
      cancelled = true
    }
  }, [t])

  useEffect(() => {
    let cancelled = false

    const loadSystemStatus = async () => {
      setSystemLoading(true)

      try {
        const [{ data: live }, { data: ready }] = await Promise.all([
          api.get('/api/live'),
          api.get('/api/ready'),
        ])

        if (cancelled) return

        setLiveStatus(live ?? null)
        setReadyStatus(ready ?? null)
      } catch (err) {
        if (cancelled) return

        console.error('LAB system status load failed:', err)
        setLiveStatus(null)
        setReadyStatus(null)
      } finally {
        if (!cancelled) {
          setSystemLoading(false)
        }
      }
    }

    void loadSystemStatus()

    return () => {
      cancelled = true
    }
  }, [])

  const visibleServices = useMemo(
    () =>
      services
        .filter((service) => service.is_active)
        .filter(
          (service) =>
            service.metadata?.service_type !== 'signature_subscription',
        )
        .slice(0, 6),
    [services],
  )

  const lifePlan = useMemo(
    () =>
      services.find(
        (service) =>
          service.is_active &&
          service.metadata?.service_type === 'signature_subscription',
      ),
    [services],
  )

  const activePackages = useMemo(
    () => packages.filter((pkg) => pkg.is_active),
    [packages],
  )

  const faqs = useMemo(
    () => [
      {
        question: t('faq.question1'),
        answer: t('faq.answer1'),
      },
      {
        question: t('faq.question2'),
        answer: t('faq.answer2'),
      },
      {
        question: t('faq.question3'),
        answer: t('faq.answer3'),
      },
    ],
    [t],
  )

  const systemReady =
    readyStatus?.status === 'READY' &&
    readyStatus?.database === 'reachable'

  const systemLive = liveStatus?.status === 'LIVE'

  return (
    <main className="min-h-screen overflow-hidden pb-24">
      {/* =========================================================
          HERO
      ========================================================== */}
      <section className="relative px-4 pb-20 pt-24 sm:px-6 lg:px-8 lg:pb-28 lg:pt-32">
        <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
          <div className="absolute left-1/2 top-0 h-[420px] w-[720px] -translate-x-1/2 rounded-full bg-gold/[0.07] blur-[120px]" />
          <div className="absolute right-0 top-1/3 h-[300px] w-[300px] rounded-full bg-emerald-500/[0.05] blur-[100px]" />
        </div>

        <div className="mx-auto max-w-6xl text-center">
          <motion.div
            initial={{ opacity: 0, y: 22 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55 }}
          >
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-gold/20 bg-gold/[0.06] px-4 py-2 text-xs font-semibold text-gold">
              <Sparkles className="h-4 w-4" />
              BİŠIŠ LAB
            </div>

            <h1 className="mx-auto max-w-4xl text-4xl font-black tracking-tight text-white sm:text-5xl lg:text-7xl">
              {t('lab.hero.title', 'افهم BİŠIŠ قبل أن تبدأ')}
            </h1>

            <p className="mx-auto mt-6 max-w-2xl text-base leading-8 text-white/55 sm:text-lg">
              {t(
                'lab.hero.description',
                'مساحة واحدة تشرح كيف تعمل BİŠIŠ، ماذا نقدم، كيف يتم الطلب والدفع والتسليم، وكيف تتابع مشروعك من البداية حتى النهاية.',
              )}
            </p>

            <div className="mt-9 flex flex-col justify-center gap-3 sm:flex-row">
              <Link
                to="/packages"
                className="inline-flex items-center justify-center gap-2 rounded-2xl bg-gold px-6 py-3.5 text-sm font-bold text-black transition-transform hover:scale-[1.02]"
              >
                {t('lab.hero.cta', 'استكشف الخدمات والباقات')}
                <ArrowRight className="h-4 w-4 rtl:rotate-180" />
              </Link>

              <a
                href="#how-it-works"
                className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/[0.03] px-6 py-3.5 text-sm font-semibold text-white transition-colors hover:border-gold/30 hover:bg-white/[0.05]"
              >
                {t('lab.hero.cta2', 'كيف تعمل BİŠIŠ؟')}
              </a>
            </div>
          </motion.div>

          <motion.div
            {...fadeUp}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="mx-auto mt-12 grid max-w-4xl grid-cols-2 gap-3 sm:grid-cols-4"
          >
            {[
              {
                icon: Layers3,
                value: services.length || '18',
                label: t('lab.stats.services', 'خدمات'),
              },
              {
                icon: Package,
                value: activePackages.length || '3',
                label: t('lab.stats.packages', 'باقات'),
              },
              {
                icon: Globe2,
                value: '3',
                label: t('lab.stats.languages', 'لغات'),
              },
              {
                icon: ShieldCheck,
                value: systemReady ? 'READY' : '—',
                label: t('lab.stats.system', 'حالة النظام'),
              },
            ].map((stat) => (
              <div
                key={stat.label}
                className="rounded-2xl border border-white/10 bg-white/[0.025] p-4"
              >
                <stat.icon className="mx-auto mb-2 h-4 w-4 text-gold" />
                <div className="text-xl font-bold text-white">{stat.value}</div>
                <div className="mt-1 text-[11px] text-white/40">
                  {stat.label}
                </div>
              </div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* =========================================================
          WHAT IS BİŞİŞ
      ========================================================== */}
      <section className="px-4 py-20 sm:px-6 lg:px-8">
        <motion.div
          {...fadeUp}
          className="mx-auto grid max-w-6xl gap-8 lg:grid-cols-[1.1fr_.9fr]"
        >
          <div>
            <div className="mb-4 text-xs font-bold uppercase tracking-[0.22em] text-gold">
              {t('lab.about.eyebrow', 'ما هو BİŠIŠ؟')}
            </div>

            <h2 className="text-3xl font-bold text-white sm:text-4xl">
              {t(
                'lab.about.title',
                'نظام يحول الاحتياج إلى نطاق واضح ثم إلى تنفيذ قابل للمتابعة.',
              )}
            </h2>

            <p className="mt-5 max-w-2xl text-sm leading-8 text-white/55">
              {t(
                'lab.about.description',
                'BİŠIŠ ليست مجرد قائمة خدمات. الفكرة هي أن تبدأ من مشكلة أو هدف واضح، تختار نطاقًا مناسبًا، ترسل طلبك، ثم تتابع مراحل العمل والتسليم من مساحة رقمية واحدة.',
              )}
            </p>

            <div className="mt-7 flex flex-wrap gap-2">
              {[
                'Clear Scope',
                'Structured Delivery',
                'Client Workspace',
                'Secure Payments',
              ].map((item) => (
                <span
                  key={item}
                  className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-1.5 text-xs text-white/60"
                >
                  {item}
                </span>
              ))}
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            {[
              {
                icon: Gauge,
                title: t('lab.about.card1.title', 'وضوح'),
                text: t(
                  'lab.about.card1.text',
                  'نطاق واضح قبل بدء التنفيذ.',
                ),
              },
              {
                icon: Workflow,
                title: t('lab.about.card2.title', 'مسار'),
                text: t(
                  'lab.about.card2.text',
                  'خطوات منظمة من الطلب حتى التسليم.',
                ),
              },
              {
                icon: ShieldCheck,
                title: t('lab.about.card3.title', 'ثقة'),
                text: t(
                  'lab.about.card3.text',
                  'حالة الطلب والدفع والتسليم يمكن متابعتها.',
                ),
              },
              {
                icon: Zap,
                title: t('lab.about.card4.title', 'تنفيذ'),
                text: t(
                  'lab.about.card4.text',
                  'الخدمة لا تنتهي عند النصيحة؛ هناك مخرج عملي.',
                ),
              },
            ].map((card) => (
              <div
                key={card.title}
                className="rounded-2xl border border-white/10 bg-white/[0.025] p-5 transition-colors hover:border-gold/20"
              >
                <card.icon className="h-5 w-5 text-gold" />
                <h3 className="mt-4 text-sm font-bold text-white">
                  {card.title}
                </h3>
                <p className="mt-2 text-xs leading-6 text-white/45">
                  {card.text}
                </p>
              </div>
            ))}
          </div>
        </motion.div>
      </section>

      {/* =========================================================
          HOW IT WORKS
      ========================================================== */}
      <section
        id="how-it-works"
        className="border-y border-white/[0.06] bg-white/[0.015] px-4 py-20 sm:px-6 lg:px-8"
      >
        <div className="mx-auto max-w-6xl">
          <motion.div {...fadeUp} className="text-center">
            <div className="text-xs font-bold uppercase tracking-[0.22em] text-gold">
              {t('lab.process.eyebrow', 'كيف نعمل')}
            </div>

            <h2 className="mt-3 text-3xl font-bold text-white sm:text-4xl">
              {t('lab.process.title', 'من الفكرة إلى التسليم')}
            </h2>
          </motion.div>

          <div className="mt-12 grid gap-4 md:grid-cols-4">
            {[
              {
                number: '01',
                icon: Gauge,
                title: t('lab.process.1.title', 'حدد احتياجك'),
                text: t(
                  'lab.process.1.text',
                  'ابدأ من المشكلة أو الهدف الذي تريد الوصول إليه.',
                ),
              },
              {
                number: '02',
                icon: Package,
                title: t('lab.process.2.title', 'اختر النطاق'),
                text: t(
                  'lab.process.2.text',
                  'اختر خدمة منفردة أو باقة تناسب حجم العمل.',
                ),
              },
              {
                number: '03',
                icon: WalletCards,
                title: t('lab.process.3.title', 'اطلب وادفع'),
                text: t(
                  'lab.process.3.text',
                  'أنشئ الطلب وانتقل إلى مسار الدفع الآمن.',
                ),
              },
              {
                number: '04',
                icon: FileCheck2,
                title: t('lab.process.4.title', 'تابع التسليم'),
                text: t(
                  'lab.process.4.text',
                  'تابع مراحل التنفيذ والمخرجات من مساحة العمل.',
                ),
              },
            ].map((step) => (
              <motion.div
                key={step.number}
                {...fadeUp}
                className="relative rounded-2xl border border-white/10 bg-[#0d0d0d] p-6"
              >
                <div className="flex items-center justify-between">
                  <step.icon className="h-5 w-5 text-gold" />
                  <span className="text-xs font-bold text-white/20">
                    {step.number}
                  </span>
                </div>

                <h3 className="mt-6 text-base font-bold text-white">
                  {step.title}
                </h3>

                <p className="mt-2 text-xs leading-6 text-white/45">
                  {step.text}
                </p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* =========================================================
          SERVICES
      ========================================================== */}
      <section className="px-4 py-20 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-6xl">
          <motion.div
            {...fadeUp}
            className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end"
          >
            <div>
              <div className="text-xs font-bold uppercase tracking-[0.22em] text-gold">
                {t('lab.services.eyebrow', 'الخدمات')}
              </div>

              <h2 className="mt-3 text-3xl font-bold text-white sm:text-4xl">
                {t('lab.services.title', 'خدمات مركزة لمشاكل حقيقية')}
              </h2>

              <p className="mt-3 max-w-2xl text-sm leading-7 text-white/45">
                {t(
                  'lab.services.description',
                  'هذه أمثلة من الكتالوج الحالي. الكتالوج الكامل متاح في صفحة الخدمات والباقات.',
                )}
              </p>
            </div>

            <Link
              to="/packages"
              className="inline-flex shrink-0 items-center gap-2 text-sm font-semibold text-gold hover:text-white"
            >
              {t('lab.services.cta', 'عرض جميع الخدمات')}
              <ArrowRight className="h-4 w-4 rtl:rotate-180" />
            </Link>
          </motion.div>

          {loading ? (
            <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: 6 }).map((_, index) => (
                <div
                  key={index}
                  className="h-48 animate-pulse rounded-2xl border border-white/10 bg-white/[0.025]"
                />
              ))}
            </div>
          ) : error ? (
            <div className="mt-10 rounded-2xl border border-red-400/20 bg-red-400/[0.05] p-6 text-sm text-red-200">
              {error}
            </div>
          ) : (
            <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {visibleServices.map((service, index) => {
                const sourceId = service.metadata?.source_id
                const description =
                  (sourceId && serviceDescriptions[sourceId]) ||
                  service.description ||
                  t(
                    'lab.services.default_description',
                    'خدمة عملية مصممة لنطاق واضح ومخرج قابل للاستخدام.',
                  )

                return (
                  <motion.article
                    key={service.id}
                    {...fadeUp}
                    transition={{ duration: 0.45, delay: index * 0.04 }}
                    className="group rounded-2xl border border-white/10 bg-white/[0.025] p-5 transition-all hover:-translate-y-1 hover:border-gold/25 hover:bg-white/[0.04]"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-gold/15 bg-gold/[0.06] text-gold">
                        <Sparkles className="h-4 w-4" />
                      </div>

                      <div className="text-end">
                        <div className="text-lg font-bold text-white">
                          ${Number(service.price).toLocaleString()}
                        </div>

                        {service.delivery && (
                          <div className="mt-1 text-[10px] text-white/30">
                            {service.delivery}
                          </div>
                        )}
                      </div>
                    </div>

                    <h3 className="mt-5 text-sm font-bold text-white">
                      {service.name}
                    </h3>

                    <p className="mt-2 min-h-[72px] text-xs leading-6 text-white/45">
                      {description}
                    </p>

                    <Link
                      to="/packages"
                      className="mt-4 inline-flex items-center gap-2 text-xs font-semibold text-gold opacity-80 transition-opacity group-hover:opacity-100"
                    >
                      {t('lab.services.view', 'عرض الخدمة')}
                      <ArrowRight className="h-3.5 w-3.5 rtl:rotate-180" />
                    </Link>
                  </motion.article>
                )
              })}
            </div>
          )}

          {lifePlan && (
            <motion.div
              {...fadeUp}
              className="mt-4 overflow-hidden rounded-2xl border border-gold/20 bg-gradient-to-r from-gold/[0.08] to-emerald-500/[0.04] p-6"
            >
              <div className="flex flex-col justify-between gap-5 md:flex-row md:items-center">
                <div>
                  <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-gold">
                    Signature Subscription
                  </div>

                  <h3 className="mt-2 text-xl font-bold text-white">
                    {lifePlan.name}
                  </h3>

                  <p className="mt-2 text-sm text-white/45">
                    {serviceDescriptions['svc-018']}
                  </p>
                </div>

                <Link
                  to="/services/life-plan"
                  className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl border border-gold/30 bg-gold/10 px-5 py-3 text-sm font-bold text-gold hover:bg-gold/15"
                >
                  {t('lab.services.life_plan', 'استكشف Life Plan')}
                  <ArrowRight className="h-4 w-4 rtl:rotate-180" />
                </Link>
              </div>
            </motion.div>
          )}
        </div>
      </section>

      {/* =========================================================
          PACKAGES
      ========================================================== */}
      <section className="border-y border-white/[0.06] bg-white/[0.015] px-4 py-20 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-6xl">
          <motion.div {...fadeUp} className="text-center">
            <div className="text-xs font-bold uppercase tracking-[0.22em] text-gold">
              {t('lab.packages.eyebrow', 'الباقات')}
            </div>

            <h2 className="mt-3 text-3xl font-bold text-white sm:text-4xl">
              {t('lab.packages.title', 'إذا كان نطاقك أكبر، اجمعه في مسار واحد')}
            </h2>
          </motion.div>

          <div className="mt-10 grid gap-4 lg:grid-cols-3">
            {activePackages.map((pkg, index) => (
              <motion.article
                key={pkg.id}
                {...fadeUp}
                transition={{ duration: 0.45, delay: index * 0.06 }}
                className={`relative rounded-2xl border p-6 ${
                  pkg.is_popular
                    ? 'border-gold/35 bg-gold/[0.045]'
                    : 'border-white/10 bg-white/[0.025]'
                }`}
              >
                {pkg.is_popular && (
                  <div className="absolute right-5 top-5 rounded-full bg-gold px-2.5 py-1 text-[9px] font-black uppercase tracking-wider text-black">
                    {t('lab.packages.popular', 'الأكثر اختيارًا')}
                  </div>
                )}

                <div className="text-xs font-semibold uppercase tracking-wider text-white/35">
                  {pkg.category || 'BİŠIŠ'}
                </div>

                <h3 className="mt-3 text-2xl font-bold text-white">
                  {pkg.name}
                </h3>

                <div className="mt-4 text-3xl font-black text-gold">
                  ${Number(pkg.price).toLocaleString()}
                </div>

                <p className="mt-4 min-h-[72px] text-sm leading-7 text-white/45">
                  {packageDescriptions[pkg.slug] || pkg.description}
                </p>

                <div className="mt-6 space-y-2">
                  {pkg.features.slice(0, 5).map((feature) => (
                    <div
                      key={feature}
                      className="flex items-start gap-2 text-xs text-white/60"
                    >
                      <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-400" />
                      <span>{feature}</span>
                    </div>
                  ))}
                </div>

                <Link
                  to="/packages"
                  className={`mt-7 flex items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-bold transition-colors ${
                    pkg.is_popular
                      ? 'bg-gold text-black hover:bg-gold/90'
                      : 'border border-white/10 bg-white/[0.04] text-white hover:border-gold/25 hover:text-gold'
                  }`}
                >
                  {t('lab.packages.cta', 'استكشف الباقة')}
                  <ArrowRight className="h-4 w-4 rtl:rotate-180" />
                </Link>
              </motion.article>
            ))}
          </div>
        </div>
      </section>

      {/* =========================================================
          SERVICE ANATOMY
      ========================================================== */}
      <section className="px-4 py-20 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-6xl">
          <motion.div {...fadeUp} className="max-w-2xl">
            <div className="text-xs font-bold uppercase tracking-[0.22em] text-gold">
              {t('lab.anatomy.eyebrow', 'Service Anatomy')}
            </div>

            <h2 className="mt-3 text-3xl font-bold text-white sm:text-4xl">
              {t('lab.anatomy.title', 'كل خدمة لها نطاق ومخرج ومسار واضح')}
            </h2>

            <p className="mt-4 text-sm leading-7 text-white/45">
              {t(
                'lab.anatomy.description',
                'الفكرة ليست بيع اسم خدمة فقط. كل نطاق يجب أن يكون مفهومًا قبل الشراء، وله مخرج يمكن استخدامه ومتابعته.',
              )}
            </p>
          </motion.div>

          <div className="mt-10 grid gap-4 md:grid-cols-3">
            {[
              {
                icon: FileCheck2,
                title: t('lab.anatomy.scope', 'Scope'),
                text: t(
                  'lab.anatomy.scope_text',
                  'ماذا سيتم العمل عليه بالضبط؟',
                ),
              },
              {
                icon: Gauge,
                title: t('lab.anatomy.output', 'Output'),
                text: t(
                  'lab.anatomy.output_text',
                  'ما المخرج الذي ستحصل عليه في النهاية؟',
                ),
              },
              {
                icon: Workflow,
                title: t('lab.anatomy.delivery', 'Delivery'),
                text: t(
                  'lab.anatomy.delivery_text',
                  'كيف ينتقل الطلب من الشراء إلى التسليم والمتابعة؟',
                ),
              },
            ].map((item) => (
              <div
                key={item.title}
                className="rounded-2xl border border-white/10 bg-white/[0.025] p-6"
              >
                <item.icon className="h-5 w-5 text-gold" />
                <h3 className="mt-5 text-base font-bold text-white">
                  {item.title}
                </h3>
                <p className="mt-2 text-xs leading-6 text-white/45">
                  {item.text}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* =========================================================
          PAYMENTS
      ========================================================== */}
      <section className="border-y border-white/[0.06] bg-white/[0.015] px-4 py-20 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-6xl">
          <motion.div
            {...fadeUp}
            className="grid gap-8 lg:grid-cols-[1fr_.8fr]"
          >
            <div>
              <div className="text-xs font-bold uppercase tracking-[0.22em] text-gold">
                {t('lab.payment.eyebrow', 'الدفع')}
              </div>

              <h2 className="mt-3 text-3xl font-bold text-white sm:text-4xl">
                {t('lab.payment.title', 'دفع واضح، وحالة مرتبطة بالطلب')}
              </h2>

              <p className="mt-4 max-w-2xl text-sm leading-8 text-white/45">
                {t(
                  'lab.payment.description',
                  'بعد إنشاء الطلب، ينتقل المستخدم إلى مسار الدفع عبر NOWPayments. حالة الدفع لا تعتمد على زر في الواجهة فقط، بل تتم متابعتها من النظام.',
                )}
              </p>

              <div className="mt-7 space-y-3">
                {[
                  t('lab.payment.point1', 'الأسعار الأساسية معروضة بالدولار الأمريكي.'),
                  t(
                    'lab.payment.point2',
                    'مسار العملات المشفر الحالي يستخدم USDC على BSC.',
                  ),
                  t(
                    'lab.payment.point3',
                    'حالة الدفع تعود إلى النظام عبر مسار NOWPayments.',
                  ),
                ].map((point) => (
                  <div
                    key={point}
                    className="flex items-start gap-3 text-sm text-white/60"
                  >
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />
                    <span>{point}</span>
                  </div>
                ))}
              </div>

              <Link
                to="/payment"
                className="mt-8 inline-flex items-center gap-2 rounded-xl bg-gold px-5 py-3 text-sm font-bold text-black"
              >
                {t('lab.payment.cta', 'انتقل إلى الدفع')}
                <ArrowRight className="h-4 w-4 rtl:rotate-180" />
              </Link>
            </div>

            <div className="rounded-3xl border border-gold/15 bg-[#0c0c0c] p-6">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gold/10 text-gold">
                  <WalletCards className="h-5 w-5" />
                </div>

                <div>
                  <div className="text-sm font-bold text-white">
                    NOWPayments
                  </div>
                  <div className="text-xs text-white/35">
                    {t('lab.payment.provider', 'Payment infrastructure')}
                  </div>
                </div>
              </div>

              <div className="mt-7 rounded-2xl border border-white/10 bg-white/[0.025] p-5">
                <div className="text-[10px] uppercase tracking-wider text-white/30">
                  Current crypto route
                </div>

                <div className="mt-2 text-lg font-bold text-white">
                  USDC · BSC
                </div>

                <div className="mt-1 text-xs text-emerald-400">
                  {t('lab.payment.available', 'المسار الأساسي الحالي')}
                </div>
              </div>

              <div className="mt-4 flex items-center gap-2 text-xs text-white/35">
                <Lock className="h-3.5 w-3.5" />
                {t(
                  'lab.payment.security',
                  'لا تعتمد حالة الدفع على إدخال العميل وحده.',
                )}
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* =========================================================
          ORDER JOURNEY
      ========================================================== */}
      <section className="px-4 py-20 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-6xl">
          <motion.div {...fadeUp} className="text-center">
            <div className="text-xs font-bold uppercase tracking-[0.22em] text-gold">
              {t('lab.journey.eyebrow', 'رحلة الطلب')}
            </div>

            <h2 className="mt-3 text-3xl font-bold text-white sm:text-4xl">
              {t('lab.journey.title', 'ماذا يحدث بعد الضغط على ابدأ؟')}
            </h2>
          </motion.div>

          <div className="mx-auto mt-12 max-w-4xl">
            {[
              {
                n: '01',
                title: t('lab.journey.1.title', 'اختيار'),
                text: t(
                  'lab.journey.1.text',
                  'تختار خدمة أو باقة من الكتالوج الحالي.',
                ),
              },
              {
                n: '02',
                title: t('lab.journey.2.title', 'Order'),
                text: t(
                  'lab.journey.2.text',
                  'يتم إنشاء الطلب في النظام وربطه بالنطاق الذي اخترته.',
                ),
              },
              {
                n: '03',
                title: t('lab.journey.3.title', 'Payment'),
                text: t(
                  'lab.journey.3.text',
                  'ينتقل الطلب إلى مسار الدفع المناسب.',
                ),
              },
              {
                n: '04',
                title: t('lab.journey.4.title', 'Execution'),
                text: t(
                  'lab.journey.4.text',
                  'بعد تحقق الحالة، يدخل الطلب في مسار التنفيذ والتسليم.',
                ),
              },
              {
                n: '05',
                title: t('lab.journey.5.title', 'Workspace'),
                text: t(
                  'lab.journey.5.text',
                  'تتابع العمل والمخرجات من مساحة العميل.',
                ),
              },
            ].map((item, index) => (
              <motion.div
                key={item.n}
                {...fadeUp}
                transition={{ duration: 0.4, delay: index * 0.05 }}
                className="relative flex gap-5 border-b border-white/[0.07] py-6 last:border-b-0"
              >
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-gold/20 bg-gold/[0.05] text-xs font-bold text-gold">
                  {item.n}
                </div>

                <div>
                  <h3 className="text-sm font-bold text-white">
                    {item.title}
                  </h3>
                  <p className="mt-1 text-xs leading-6 text-white/45">
                    {item.text}
                  </p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* =========================================================
          CLIENT WORKSPACE
      ========================================================== */}
      <section className="border-y border-white/[0.06] bg-white/[0.015] px-4 py-20 sm:px-6 lg:px-8">
        <motion.div
          {...fadeUp}
          className="mx-auto grid max-w-6xl items-center gap-10 lg:grid-cols-[.85fr_1.15fr]"
        >
          <div>
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-gold/20 bg-gold/[0.06] text-gold">
              <Workflow className="h-5 w-5" />
            </div>

            <div className="mt-5 text-xs font-bold uppercase tracking-[0.22em] text-gold">
              {t('lab.workspace.eyebrow', 'Client Workspace')}
            </div>

            <h2 className="mt-3 text-3xl font-bold text-white sm:text-4xl">
              {t('lab.workspace.title', 'مساحة واحدة لمتابعة العمل')}
            </h2>

            <p className="mt-4 text-sm leading-8 text-white/45">
              {t(
                'lab.workspace.description',
                'الهدف أن لا تضطر إلى البحث بين رسائل وأماكن مختلفة لمعرفة أين وصل طلبك.',
              )}
            </p>

            <Link
              to="/dashboard"
              className="mt-7 inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-5 py-3 text-sm font-bold text-white hover:border-gold/25 hover:text-gold"
            >
              {t('lab.workspace.cta', 'افتح لوحة التحكم')}
              <ArrowRight className="h-4 w-4 rtl:rotate-180" />
            </Link>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            {[
              {
                icon: Package,
                title: t('lab.workspace.card1', 'Orders'),
                text: t(
                  'lab.workspace.card1_text',
                  'متابعة الطلبات الحالية.',
                ),
              },
              {
                icon: Workflow,
                title: t('lab.workspace.card2', 'Projects'),
                text: t(
                  'lab.workspace.card2_text',
                  'الوصول إلى مساحات المشاريع.',
                ),
              },
              {
                icon: MessageCircle,
                title: t('lab.workspace.card3', 'Chat'),
                text: t(
                  'lab.workspace.card3_text',
                  'التواصل والمتابعة عند الحاجة.',
                ),
              },
              {
                icon: FileCheck2,
                title: t('lab.workspace.card4', 'Delivery'),
                text: t(
                  'lab.workspace.card4_text',
                  'متابعة المخرجات والتسليم.',
                ),
              },
            ].map((item) => (
              <div
                key={item.title}
                className="rounded-2xl border border-white/10 bg-[#0d0d0d] p-5"
              >
                <item.icon className="h-5 w-5 text-gold" />
                <div className="mt-4 text-sm font-bold text-white">
                  {item.title}
                </div>
                <div className="mt-1 text-xs leading-6 text-white/40">
                  {item.text}
                </div>
              </div>
            ))}
          </div>
        </motion.div>
      </section>

      {/* =========================================================
          SECURITY
      ========================================================== */}
      <section className="px-4 py-20 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-6xl">
          <motion.div {...fadeUp} className="text-center">
            <div className="text-xs font-bold uppercase tracking-[0.22em] text-gold">
              {t('lab.security.eyebrow', 'Security & Trust')}
            </div>

            <h2 className="mt-3 text-3xl font-bold text-white sm:text-4xl">
              {t('lab.security.title', 'الثقة جزء من النظام، وليست شعارًا')}
            </h2>
          </motion.div>

          <div className="mt-10 grid gap-4 md:grid-cols-3">
            {[
              {
                icon: ShieldCheck,
                title: t('lab.security.1.title', 'حماية الوصول'),
                text: t(
                  'lab.security.1.text',
                  'الوصول إلى المناطق الحساسة يعتمد على المصادقة والصلاحيات.',
                ),
              },
              {
                icon: Lock,
                title: t('lab.security.2.title', 'الدفع'),
                text: t(
                  'lab.security.2.text',
                  'الدفع يمر عبر بنية دفع خارجية وحالة يتم التحقق منها.',
                ),
              },
              {
                icon: FileCheck2,
                title: t('lab.security.3.title', 'التتبع'),
                text: t(
                  'lab.security.3.text',
                  'الطلبات والتسليمات جزء من دورة عمل قابلة للمتابعة.',
                ),
              },
            ].map((item) => (
              <div
                key={item.title}
                className="rounded-2xl border border-white/10 bg-white/[0.025] p-6"
              >
                <item.icon className="h-5 w-5 text-emerald-400" />
                <h3 className="mt-5 text-base font-bold text-white">
                  {item.title}
                </h3>
                <p className="mt-2 text-xs leading-6 text-white/45">
                  {item.text}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* =========================================================
          FAQ
      ========================================================== */}
      <section className="border-y border-white/[0.06] bg-white/[0.015] px-4 py-20 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-4xl">
          <motion.div {...fadeUp} className="text-center">
            <div className="text-xs font-bold uppercase tracking-[0.22em] text-gold">
              FAQ
            </div>

            <h2 className="mt-3 text-3xl font-bold text-white sm:text-4xl">
              {t('faq.title')}
            </h2>

            <p className="mx-auto mt-4 max-w-2xl text-sm leading-7 text-white/45">
              {t('faq.subtitle')}
            </p>
          </motion.div>

          <div className="mt-10 space-y-3">
            {faqs.map((faq, index) => {
              const isOpen = openFaq === index

              return (
                <motion.div
                  key={index}
                  {...fadeUp}
                  className={`overflow-hidden rounded-2xl border transition-colors ${
                    isOpen
                      ? 'border-gold/35 bg-gold/[0.045]'
                      : 'border-white/10 bg-white/[0.025]'
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => setOpenFaq(isOpen ? null : index)}
                    aria-expanded={isOpen}
                    className="flex w-full items-center justify-between gap-5 px-5 py-5 text-start"
                  >
                    <span className="text-sm font-semibold leading-6 text-white">
                      {faq.question}
                    </span>

                    <ChevronDown
                      className={`h-5 w-5 shrink-0 text-gold transition-transform ${
                        isOpen ? 'rotate-180' : ''
                      }`}
                    />
                  </button>

                  {isOpen && (
                    <div className="border-t border-gold/10 px-5 pb-6 pt-4">
                      <p className="text-sm leading-7 text-white/55">
                        {faq.answer}
                      </p>
                    </div>
                  )}
                </motion.div>
              )
            })}
          </div>

          <div className="mt-6 text-center">
            <Link
              to="/faq"
              className="inline-flex items-center gap-2 text-xs font-semibold text-gold"
            >
              {t('lab.faq.more', 'عرض صفحة الأسئلة كاملة')}
              <ExternalLink className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>
      </section>

      {/* =========================================================
          SYSTEM STATUS
      ========================================================== */}
      <section className="px-4 py-20 sm:px-6 lg:px-8">
        <motion.div
          {...fadeUp}
          className="mx-auto max-w-6xl overflow-hidden rounded-3xl border border-white/10 bg-[#0BİŞİŞ]"
        >
          <div className="border-b border-white/[0.07] p-6 sm:p-8">
            <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-center">
              <div>
                <div className="text-xs font-bold uppercase tracking-[0.22em] text-gold">
                  {t('lab.status.eyebrow', 'System Status')}
                </div>

                <h2 className="mt-2 text-2xl font-bold text-white">
                  {t('lab.status.title', 'حالة النظام الآن')}
                </h2>
              </div>

              <div
                className={`inline-flex items-center gap-2 self-start rounded-full border px-3 py-1.5 text-xs font-semibold ${
                  systemLive
                    ? 'border-emerald-400/20 bg-emerald-400/10 text-emerald-300'
                    : 'border-red-400/20 bg-red-400/10 text-red-300'
                }`}
              >
                <span
                  className={`h-2 w-2 rounded-full ${
                    systemLive ? 'bg-emerald-400' : 'bg-red-400'
                  }`}
                />
                {systemLoading
                  ? t('lab.status.checking', 'جارٍ الفحص...')
                  : systemLive
                    ? 'LIVE'
                    : 'UNAVAILABLE'}
              </div>
            </div>
          </div>

          <div className="grid gap-px bg-white/[0.06] md:grid-cols-3">
            <div className="bg-[#0BİŞİŞ] p-6">
              <div className="text-xs text-white/35">
                {t('lab.status.service', 'Application')}
              </div>
              <div className="mt-2 text-lg font-bold text-white">
                {liveStatus?.status || '—'}
              </div>
            </div>

            <div className="bg-[#0BİŞİŞ] p-6">
              <div className="text-xs text-white/35">
                {t('lab.status.database', 'Database')}
              </div>
              <div className="mt-2 text-lg font-bold text-white">
                {readyStatus?.database || '—'}
              </div>
            </div>

            <div className="bg-[#0BİŞİŞ] p-6">
              <div className="text-xs text-white/35">
                {t('lab.status.readiness', 'Readiness')}
              </div>
              <div
                className={`mt-2 text-lg font-bold ${
                  systemReady ? 'text-emerald-400' : 'text-white'
                }`}
              >
                {readyStatus?.status || '—'}
              </div>
            </div>
          </div>
        </motion.div>
      </section>

      {/* =========================================================
          ABOUT + START
      ========================================================== */}
      <section className="px-4 pb-10 sm:px-6 lg:px-8">
        <motion.div
          {...fadeUp}
          className="mx-auto max-w-6xl rounded-3xl border border-gold/15 bg-gradient-to-br from-gold/[0.08] via-transparent to-emerald-500/[0.04] p-8 text-center sm:p-12"
        >
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-gold/20 bg-gold/10 text-gold">
            <Rocket className="h-6 w-6" />
          </div>

          <div className="mt-5 text-xs font-bold uppercase tracking-[0.22em] text-gold">
            BİŠIŠ
          </div>

          <h2 className="mx-auto mt-3 max-w-3xl text-3xl font-black text-white sm:text-5xl">
            {t('lab.final.title', 'جاهز تبدأ؟')}
          </h2>

          <p className="mx-auto mt-4 max-w-2xl text-sm leading-7 text-white/45">
            {t(
              'lab.final.description',
              'استكشف الخدمات والباقات، اختر النطاق المناسب، ودع النظام يأخذك من الطلب إلى التنفيذ.',
            )}
          </p>

          <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
            <Link
              to="/packages"
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-gold px-6 py-3.5 text-sm font-bold text-black"
            >
              {t('lab.final.cta', 'ابدأ الآن')}
              <ArrowRight className="h-4 w-4 rtl:rotate-180" />
            </Link>

            <Link
              to="/about"
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-6 py-3.5 text-sm font-semibold text-white hover:border-gold/25 hover:text-gold"
            >
              {t('lab.final.about', 'تعرف على BİŠIŠ')}
              <ArrowRight className="h-4 w-4 rtl:rotate-180" />
            </Link>

            <Link
              to="/chat"
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-6 py-3.5 text-sm font-semibold text-white hover:border-gold/25 hover:text-gold"
            >
              <MessageCircle className="h-4 w-4" />
              {t('lab.final.chat', 'تحدث معنا')}
            </Link>
          </div>
        </motion.div>
      </section>
    </main>
  )
}

export default LabPage