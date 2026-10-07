import React, { useEffect, useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import {
  ArrowRight,
  Check,
  ChevronDown,
  FileCheck2,
  Gauge,
  Lock,
  MessageSquare,
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
import { useReducedMotion } from '../hooks/useReducedMotion'
import Hero from '../sections/Hero'

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

const LabPage: React.FC = () => {
  const { t } = useTranslation()
  const reducedMotion = useReducedMotion()

  const fadeUp = reducedMotion
    ? { initial: { opacity: 1, y: 0 }, whileInView: { opacity: 1, y: 0 }, viewport: { once: true, amount: 0.15 } }
    : { initial: { opacity: 0, y: 24 }, whileInView: { opacity: 1, y: 0 }, viewport: { once: true, amount: 0.15 } }

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
            'تعذر تحميل الكتالوج. انتقل إلى صفحة الباقات وأعد المحاولة.',
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
      <Hero />

      {/* =========================================================
          WHAT IS BİŞİŞ
      ========================================================== */}
      <section className="px-4 py-20 sm:px-6 lg:px-8">
        <motion.div
          {...fadeUp}
          className="mx-auto grid max-w-6xl gap-8 lg:grid-cols-[1.1fr_.9fr]"
        >
          <div>
            <div className="mb-4 eyebrow text-xs font-bold uppercase tracking-[0.22em] text-gold">
              {t('lab.about.eyebrow')}
            </div>

            <h2 className="text-3xl font-bold text-ink-0 sm:text-4xl">
              {t(
                'lab.about.title',
                'نظام يحول الاحتياج إلى نطاق واضح وتنفيذ قابل للمتابعة.',
              )}
            </h2>

            <p className="mt-5 max-w-2xl text-sm leading-8 text-ink-3">
              {t(
                'lab.about.description',
                'BİŞİŞ ليست مجرد قائمة خدمات. اختر نطاقًا مناسبًا، ثم تابع التنفيذ والتسليم.',
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
                  className="rounded-full border border-border-1 bg-surface-1 px-3 py-1.5 text-xs text-ink-2"
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
                title: t('lab.about.card1.title'),
                text: t(
                  'lab.about.card1.text',
                  'نطاق واضح قبل بدء التنفيذ.',
                ),
              },
              {
                icon: Workflow,
                title: t('lab.about.card2.title'),
                text: t(
                  'lab.about.card2.text',
                  'خطوات منظمة من الطلب حتى التسليم.',
                ),
              },
              {
                icon: ShieldCheck,
                title: t('lab.about.card3.title'),
                text: t(
                  'lab.about.card3.text',
                  'حالة الطلب والدفع والتسليم يمكن متابعتها.',
                ),
              },
              {
                icon: Zap,
                title: t('lab.about.card4.title'),
                text: t(
                  'lab.about.card4.text',
                  'الخدمة لا تنتهي عند النصيحة؛ هناك مخرج عملي.',
                ),
              },
            ].map((card) => (
              <div
                key={card.title}
                className="card card-interactive p-5 transition-colors hover:border-gold/20"
              >
                <card.icon className="h-5 w-5 text-gold" />
                <h3 className="mt-4 text-sm font-bold text-ink-0">
                  {card.title}
                </h3>
                <p className="mt-2 text-xs leading-6 text-ink-3">
                  {card.text}
                </p>
              </div>
            ))}
          </div>
        </motion.div>
      </section>

      <div className="section-divider my-12 mx-auto" />

      {/* =========================================================
          HOW IT WORKS
      ========================================================== */}
      <section
        id="how-it-works"
        className="border-y border-border-1 bg-surface-1 px-4 py-20 sm:px-6 lg:px-8"
      >
        <div className="mx-auto max-w-6xl">
          <motion.div {...fadeUp} className="text-center">
            <div className="eyebrow text-xs font-bold uppercase tracking-[0.22em] text-gold">
              {t('lab.process.eyebrow')}
            </div>

            <h2 className="text-3xl font-bold text-ink-0 sm:text-4xl">
              {t('lab.anatomy.title')}
            </h2>

            <p className="mt-4 text-sm leading-7 text-ink-3">
              {t(
                'lab.anatomy.description',
                'كل نطاق له مخرج قابل للاستخدام وطريقة تسليم واضحة.',
              )}
            </p>
          </motion.div>

          <div className="mt-12 grid gap-4 md:grid-cols-4">
            {[
              {
                number: '01',
                icon: Gauge,
                title: t('lab.process.1.title'),
                text: t(
                  'lab.process.1.text',
                  'ابدأ من المشكلة أو الهدف الذي تريد الوصول إليه.',
                ),
              },
              {
                number: '02',
                icon: Package,
                title: t('lab.process.2.title'),
                text: t(
                  'lab.process.2.text',
                  'اختر خدمة منفردة أو باقة تناسب حجم العمل.',
                ),
              },
              {
                number: '03',
                icon: WalletCards,
                title: t('lab.process.3.title'),
                text: t(
                  'lab.process.3.text',
                  'أنشئ الطلب وانتقل إلى مسار الدفع الآمن.',
                ),
              },
              {
                number: '04',
                icon: FileCheck2,
                title: t('lab.process.4.title'),
                text: t(
                  'lab.process.4.text',
                  'تابع مراحل التنفيذ والمخرجات من مساحة العمل.',
                ),
              },
            ].map((step) => (
              <motion.div
                key={step.number}
                {...fadeUp}
                className="relative rounded-2xl border border-border-1 bg-[#0d0d0d] p-6"
              >
                <div className="flex items-center justify-between">
                  <step.icon className="h-5 w-5 text-gold icon-hover" />
                  <span className="text-xs font-bold text-ink-3">
                    {step.number}
                  </span>
                </div>

                <h3 className="mt-6 text-base font-bold text-ink-0">
                  {step.title}
                </h3>

                <p className="mt-2 text-xs leading-6 text-ink-3">
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
              <div className="eyebrow text-xs font-bold uppercase tracking-[0.22em] text-gold">
                {t('lab.services.eyebrow')}
              </div>

              <h2 className="mt-3 text-3xl font-bold text-ink-0 sm:text-4xl">
                {t('lab.services.title')}
              </h2>

              <p className="mt-3 max-w-2xl text-sm leading-7 text-ink-3">
                {t(
                  'lab.services.description',
                  'أمثلة من الكتالوج الحالي. الكتالوج الكامل متاح في صفحة الخدمات والباقات.',
                )}
              </p>
            </div>

            <Link
              to="/packages"
              className="inline-flex shrink-0 items-center gap-2 text-sm font-semibold text-gold hover:text-ink-0"
            >
              {t('lab.services.cta')}
              <ArrowRight className="h-4 w-4 rtl:rotate-180" />
            </Link>
          </motion.div>

          {loading ? (
            <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: 6 }).map((_, index) => (
                <div
                  key={index}
                  className="h-48 animate-pulse rounded-2xl border border-border-1 bg-surface-1"
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
                    className="card card-interactive group p-5 transition-all hover:border-gold/25 hover:bg-surface-2"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-gold/15 bg-gold/[0.06] text-gold">
                        <Sparkles className="h-4 w-4" />
                      </div>

                      <div className="text-end">
                        <div className="text-lg font-bold text-ink-0">
                          ${Number(service.price).toLocaleString()}
                        </div>

                        {service.delivery && (
                          <div className="mt-1 text-[10px] text-ink-3">
                            {service.delivery}
                          </div>
                        )}
                      </div>
                    </div>

                    <h3 className="mt-5 text-sm font-bold text-ink-0">
                      {service.name}
                    </h3>

                    <p className="mt-2 min-h-[72px] text-xs leading-6 text-ink-3">
                      {description}
                    </p>

                    <Link
                      to="/packages"
                      className="mt-4 inline-flex items-center gap-2 text-xs font-semibold text-gold opacity-80 transition-opacity group-hover:opacity-100"
                    >
                      {t('lab.services.view')}
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
              className="mt-4 overflow-hidden rounded-2xl border border-gold/20 bg-gradient-to-r from-gold/[0.08] to-blue/[0.04] p-6"
            >
              <div className="flex flex-col justify-between gap-5 md:flex-row md:items-center">
                <div>
                  <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-gold">
                    Signature Subscription
                  </div>

                  <h3 className="mt-2 text-xl font-bold text-ink-0">
                    {lifePlan.name}
                  </h3>

                  <p className="mt-2 text-sm text-ink-3">
                    {serviceDescriptions['svc-018']}
                  </p>
                </div>

                <Link
                  to="/services/life-plan"
                  className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl border border-gold/30 bg-gold/10 px-5 py-3 text-sm font-bold text-gold hover:bg-gold/15"
                >
                  {t('lab.services.life_plan')}
                  <ArrowRight className="h-4 w-4 rtl:rotate-180" />
                </Link>
              </div>
            </motion.div>
          )}
        </div>
      </section>

      <div className="section-divider my-12 mx-auto" />

      {/* =========================================================
          PACKAGES
      ========================================================== */}
      <section className="border-y border-border-1 bg-surface-1 px-4 py-20 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-6xl">
          <motion.div {...fadeUp} className="text-center">
            <div className="eyebrow text-xs font-bold uppercase tracking-[0.22em] text-gold">
              {t('lab.packages.eyebrow')}
            </div>

            <h2 className="mt-3 text-3xl font-bold text-ink-0 sm:text-4xl">
              {t('lab.packages.title')}
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
                    : 'border-border-1 bg-surface-1'
                }`}
              >
                {pkg.is_popular && (
                  <div className="absolute right-5 top-5 rounded-full bg-gold px-2.5 py-1 text-[9px] font-black uppercase tracking-wider text-ink-0">
                    {t('lab.packages.popular')}
                  </div>
                )}

                <div className="text-xs font-semibold uppercase tracking-wider text-ink-3">
                  {pkg.category || 'BİŞİŞ'}
                </div>

                <h3 className="mt-3 text-2xl font-bold text-ink-0">
                  {pkg.name}
                </h3>

                <div className="mt-4 text-3xl font-black text-gold">
                  ${Number(pkg.price).toLocaleString()}
                </div>

                <p className="mt-4 min-h-[72px] text-sm leading-7 text-ink-3">
                  {packageDescriptions[pkg.slug] || pkg.description}
                </p>

                <div className="mt-6 space-y-2">
                  {pkg.features.slice(0, 5).map((feature) => (
                    <div
                      key={feature}
                      className="flex items-start gap-2 text-xs text-ink-2"
                    >
                      <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-green-300" />
                      <span>{feature}</span>
                    </div>
                  ))}
                </div>

                <Link
                  to="/packages"
                  className={`mt-7 flex items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-bold transition-colors ${
                    pkg.is_popular
                      ? 'bg-gold text-ink-0 hover:bg-gold/90'
                      : 'border border-border-1 bg-surface-2 text-ink-0 hover:border-gold/25 hover:text-gold'
                  }`}
                >
                  {t('lab.packages.cta')}
                  <ArrowRight className="h-4 w-4 rtl:rotate-180" />
                </Link>
              </motion.article>
            ))}
          </div>
        </div>
      </section>

      <div className="section-divider my-12 mx-auto" />

      {/* =========================================================
          SERVICE ANATOMY
      ========================================================== */}
      <section className="px-4 py-20 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-6xl">
          <motion.div {...fadeUp} className="max-w-2xl">
            <div className="eyebrow text-xs font-bold uppercase tracking-[0.22em] text-gold">
              {t('lab.anatomy.eyebrow')}
            </div>

            <h2 className="mt-3 text-3xl font-bold text-ink-0 sm:text-4xl">
              {t('lab.anatomy.title')}
            </h2>

            <p className="mt-4 text-sm leading-7 text-ink-3">
              {t(
                'lab.anatomy.description',
                'كل نطاق له مخرج قابل للاستخدام وطريقة تسليم واضحة.',
              )}
            </p>
          </motion.div>

          <div className="mt-10 grid gap-4 md:grid-cols-3">
            {[
              {
                icon: FileCheck2,
                title: t('lab.anatomy.scope'),
                text: t(
                  'lab.anatomy.scope_text',
                  'ماذا سيتم العمل عليه بالضبط؟',
                ),
              },
              {
                icon: Gauge,
                title: t('lab.anatomy.output'),
                text: t(
                  'lab.anatomy.output_text',
                  'ما المخرج الذي ستحصل عليه في النهاية؟',
                ),
              },
              {
                icon: Workflow,
                title: t('lab.anatomy.delivery'),
                text: t(
                  'lab.anatomy.delivery_text',
                  'كيف ينتقل الطلب من الشراء إلى التسليم والمتابعة؟',
                ),
              },
             ].map((item) => (
              <div
                key={item.title}
                className="rounded-2xl border border-border-1 bg-surface-1 p-6"
              >
                <item.icon className="h-5 w-5 text-gold icon-hover" />
                <h3 className="mt-5 text-base font-bold text-ink-0">
                  {item.title}
                </h3>
                <p className="mt-2 text-xs leading-6 text-ink-3">
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
      <section className="border-y border-border-1 bg-surface-1 px-4 py-20 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-6xl">
          <motion.div
            {...fadeUp}
            className="grid gap-8 lg:grid-cols-[1fr_.8fr]"
          >
            <div>
              <div className="eyebrow text-xs font-bold uppercase tracking-[0.22em] text-gold">
                {t('lab.payment.eyebrow')}
              </div>

              <h2 className="mt-3 text-3xl font-bold text-ink-0 sm:text-4xl">
                {t('lab.payment.title')}
              </h2>

              <p className="mt-4 max-w-2xl text-sm leading-8 text-ink-3">
                {t('lab.payment.description')}
              </p>

              <div className="mt-7 space-y-3">
                {[
                  t('lab.payment.point1'),
                  t('lab.payment.point2'),
                  t('lab.payment.point3'),
                ].map((point) => (
                  <div
                    key={point}
                    className="flex items-start gap-3 text-sm text-ink-2"
                  >
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-green-300" />
                    <span>{point}</span>
                  </div>
                ))}
              </div>

              <Link
                to="/payment"
                className="mt-8 inline-flex items-center gap-2 rounded-xl bg-gold px-5 py-3 text-sm font-bold text-ink-0"
              >
                {t('lab.payment.cta')}
                <ArrowRight className="h-4 w-4 rtl:rotate-180" />
              </Link>
            </div>

            <div className="rounded-3xl border border-gold/15 bg-[#0c0c0c] p-6">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gold/10 text-gold">
                  <WalletCards className="h-5 w-5" />
                </div>

                <div>
                  <div className="text-sm font-bold text-ink-0">
                    {t('payment.crypto_provider')}
                  </div>
                  <div className="text-xs text-ink-3">
                    {t('lab.payment.provider')}
                  </div>
                </div>
              </div>

              <div className="mt-7 rounded-2xl border border-border-1 bg-surface-1 p-5">
                <div className="text-[10px] uppercase tracking-wider text-ink-3">
                  {t('payment.crypto_route')}
                </div>

                <div className="mt-2 text-lg font-bold text-ink-0">
                  {t('payment.crypto_value')}
                </div>

            <div className="mt-1 text-xs text-blue-light">
                   {t('lab.payment.available')}
                </div>
              </div>

              <div className="mt-4 flex items-center gap-2 text-xs text-ink-3">
                <Lock className="h-3.5 w-3.5" />
                {t('lab.payment.security')}
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      <div className="section-divider my-12 mx-auto" />

      {/* =========================================================
          ORDER JOURNEY
      ========================================================== */}
      <section className="px-4 py-20 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-6xl">
          <motion.div {...fadeUp} className="text-center">
            <div className="eyebrow text-xs font-bold uppercase tracking-[0.22em] text-gold">
              {t('lab.journey.eyebrow')}
            </div>

            <h2 className="mt-3 text-3xl font-bold text-ink-0 sm:text-4xl">
              {t('lab.journey.title')}
            </h2>
          </motion.div>

          <div className="mx-auto mt-12 max-w-4xl">
            {[
               {
                 n: '01',
                 title: t('lab.journey.1.title'),
                 text: t(
                   'lab.journey.1.text',
                 ),
               },
               {
                 n: '02',
                 title: t('lab.journey.2.title'),
                 text: t(
                   'lab.journey.2.text',
                 ),
               },
               {
                 n: '03',
                 title: t('lab.journey.3.title'),
                 text: t(
                   'lab.journey.3.text',
                 ),
               },
               {
                 n: '04',
                 title: t('lab.journey.4.title'),
                 text: t(
                   'lab.journey.4.text',
                 ),
               },
               {
                 n: '05',
                 title: t('lab.journey.5.title'),
                 text: t(
                   'lab.journey.5.text',
                 ),
               },
            ].map((item, index) => (
              <motion.div
                key={item.n}
                {...fadeUp}
                transition={{ duration: 0.4, delay: index * 0.05 }}
                className="relative flex gap-5 border-b border-border-1 py-6 last:border-b-0"
              >
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-gold/20 bg-gold/[0.05] text-xs font-bold text-gold">
                  {item.n}
                </div>

                <div>
                  <h3 className="text-sm font-bold text-ink-0">
                    {item.title}
                  </h3>
                  <p className="mt-1 text-xs leading-6 text-ink-3">
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
      <section className="border-y border-border-1 bg-surface-1 px-4 py-20 sm:px-6 lg:px-8">
        <motion.div
          {...fadeUp}
          className="mx-auto grid max-w-6xl items-center gap-10 lg:grid-cols-[.85fr_1.15fr]"
        >
          <div>
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-gold/20 bg-gold/[0.06] text-gold">
              <Workflow className="h-5 w-5" />
            </div>

            <div className="mt-5 eyebrow text-xs font-bold uppercase tracking-[0.22em] text-gold">
              {t('lab.workspace.eyebrow')}
            </div>

            <h2 className="mt-3 text-3xl font-bold text-ink-0 sm:text-4xl">
              {t('lab.workspace.title')}
            </h2>

            <p className="mt-4 text-sm leading-8 text-ink-3">
              {t(
                'lab.workspace.description',
                'لا تضطر للبحث بين رسائل وأماكن مختلفة لمعرفة أين وصل طلبك.',
              )}
            </p>

            <Link
              to="/dashboard"
              className="mt-7 inline-flex items-center justify-center gap-2 rounded-xl bg-gold px-6 py-3.5 text-sm font-bold text-ink-0 shadow-lg shadow-gold/20 hover:scale-[1.02] transition-transform"
            >
              {t('lab.workspace.cta')}
              <ArrowRight className="h-4 w-4 rtl:rotate-180" />
            </Link>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            {[
              {
                icon: Package,
                title: t('lab.workspace.card1'),
                text: t(
                  'lab.workspace.card1_text',
                  'متابعة الطلبات الحالية.',
                ),
              },
              {
                icon: Workflow,
                title: t('lab.workspace.card2'),
                text: t(
                  'lab.workspace.card2_text',
                  'الوصول إلى مساحات المشاريع.',
                ),
              },
              {
                icon: MessageSquare,
                title: t('lab.workspace.card3'),
                text: t(
                  'lab.workspace.card3_text',
                  'التواصل والمتابعة عند الحاجة.',
                ),
              },
              {
                icon: FileCheck2,
                title: t('lab.workspace.card4'),
                text: t(
                  'lab.workspace.card4_text',
                  'متابعة المخرجات والتسليم.',
                ),
              },
            ].map((item) => (
              <div
                key={item.title}
                className="card card-interactive p-5"
              >
                <item.icon className="h-5 w-5 text-gold icon-hover" />
                <div className="mt-4 text-sm font-bold text-ink-0">
                  {item.title}
                </div>
                <div className="mt-1 text-xs leading-6 text-ink-3">
                  {item.text}
                </div>
              </div>
            ))}
          </div>
        </motion.div>
      </section>

      <div className="section-divider my-12 mx-auto" />

      {/* =========================================================
          SECURITY
      ========================================================== */}
      <section className="px-4 py-20 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-6xl">
          <motion.div {...fadeUp} className="text-center">
            <div className="eyebrow text-xs font-bold uppercase tracking-[0.22em] text-gold">
              {t('lab.security.eyebrow')}
            </div>

            <h2 className="mt-3 text-3xl font-bold text-ink-0 sm:text-4xl">
              {t('lab.security.title')}
            </h2>
          </motion.div>

          <div className="mt-10 grid gap-4 md:grid-cols-3">
            {[
              {
                icon: ShieldCheck,
                title: t('lab.security.1.title'),
                text: t(
                  'lab.security.1.text',
                  'الوصول إلى المناطق الحساسة يعتمد على المصادقة والصلاحيات.',
                ),
              },
              {
                icon: Lock,
                title: t('lab.security.2.title'),
                text: t(
                  'lab.security.2.text',
                  'الدفع يمر عبر بنية دفع خارجية موثوقة.',
                ),
              },
              {
                icon: FileCheck2,
                title: t('lab.security.3.title'),
                text: t(
                  'lab.security.3.text',
                  'الطلبات والتسليمات جزء من دورة عمل قابلة للمتابعة.',
                ),
              },
            ].map((item) => (
              <div
                key={item.title}
                className="card card-interactive p-6"
              >
                <item.icon className="h-5 w-5 text-blue-light icon-hover" />
                <h3 className="mt-5 text-base font-bold text-ink-0">
                  {item.title}
                </h3>
                <p className="mt-2 text-xs leading-6 text-ink-3">
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
      <section className="border-y border-border-1 bg-surface-1 px-4 py-20 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-4xl">
          <motion.div {...fadeUp} className="text-center">
            <div className="eyebrow text-xs font-bold uppercase tracking-[0.22em] text-gold">
              FAQ
            </div>

            <h2 className="mt-3 text-3xl font-bold text-ink-0 sm:text-4xl">
              {t('faq.title')}
            </h2>

            <p className="mx-auto mt-4 max-w-2xl text-sm leading-7 text-ink-3">
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
                      : 'border-border-1 bg-surface-1'
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => setOpenFaq(isOpen ? null : index)}
                    aria-expanded={isOpen}
                    className="flex w-full items-center justify-between gap-5 px-5 py-5 text-start"
                  >
                    <span className="text-sm font-semibold leading-6 text-ink-0">
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
                      <p className="text-sm leading-7 text-ink-3">
                        {faq.answer}
                      </p>
                    </div>
                  )}
                </motion.div>
              )
            })}
          </div>
        </div>
      </section>

      <div className="section-divider my-12 mx-auto" />

      {/* =========================================================
          SYSTEM STATUS
      ========================================================== */}
      <section className="px-4 py-20 sm:px-6 lg:px-8">
        <motion.div
          {...fadeUp}
          className="mx-auto max-w-6xl overflow-hidden rounded-3xl border border-border-1 bg-[#0b0b0b]"
        >
          <div className="border-b border-border-1 p-6 sm:p-8">
            <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-center">
              <div>
                <div className="eyebrow text-xs font-bold uppercase tracking-[0.22em] text-gold">
                  {t('lab.status.eyebrow')}
                </div>

                <h2 className="mt-2 text-2xl font-bold text-ink-0">
                  {t('lab.status.title')}
                </h2>
              </div>

              <div
                className={`inline-flex items-center gap-2 self-start rounded-full border px-3 py-1.5 text-xs font-semibold ${
                  systemLive
                    ? 'border-green-500/20 bg-green-500/10 text-green-300'
                    : 'border-red-400/20 bg-red-400/10 text-red-300'
                }`}
              >
                <span
                  className={`h-2 w-2 rounded-full ${
                    systemLive ? 'bg-green-500' : 'bg-red-400'
                  }`}
                />
                {systemLoading
                  ? t('lab.status.checking')
                  : systemLive
                    ? 'LIVE'
                    : 'UNAVAILABLE'}
              </div>
            </div>
          </div>

          <div className="grid gap-px bg-surface-1 md:grid-cols-3">
            <div className="bg-[#0b0b0b] p-6">
              <div className="text-xs text-ink-3">
                {t('lab.status.service')}
              </div>
              <div className="mt-2 text-lg font-bold text-ink-0">
                {liveStatus?.status || '—'}
              </div>
            </div>

            <div className="bg-[#0b0b0b] p-6">
              <div className="text-xs text-ink-3">
                {t('lab.status.database')}
              </div>
              <div className="mt-2 text-lg font-bold text-ink-0">
                {readyStatus?.database || '—'}
              </div>
            </div>

            <div className="bg-[#0b0b0b] p-6">
              <div className="text-xs text-ink-3">
                {t('lab.status.readiness')}
              </div>
              <div
                className={`mt-2 text-lg font-bold ${
                   systemReady ? 'text-green-300' : 'text-ink-0'
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
          className="mx-auto max-w-6xl rounded-3xl border border-gold/15 bg-gradient-to-br from-gold/[0.08] via-transparent to-blue/[0.04] p-8 text-center sm:p-12"
        >
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-gold/20 bg-gold/10 text-gold">
            <Rocket className="h-6 w-6" />
          </div>

          <div className="mt-6 text-center text-2xl font-black font-outfit uppercase tracking-widest text-gold gold-gradient-text gold-glow-text neon-drop-gold-3">
            BİŞİŞ
          </div>

          <h2 className="mx-auto mt-3 max-w-3xl text-3xl font-black text-ink-0 sm:text-5xl">
            {t('lab.final.title')}
          </h2>

          <p className="mx-auto mt-4 max-w-2xl text-sm leading-7 text-ink-3">
            {t(
              'lab.final.description',
              'استكشف الخدمات والباقات، اختر النطاق المناسب، ودع النظام يأخذك من الطلب إلى التنفيذ.',
            )}
          </p>

          <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
            <Link
              to="/packages"
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-gold px-6 py-3.5 text-sm font-bold text-ink-0"
            >
              {t('lab.final.cta')}
              <ArrowRight className="h-4 w-4 rtl:rotate-180" />
            </Link>

            <Link
              to="/about"
              className="btn-ghost-gold inline-flex items-center justify-center gap-2 rounded-xl border border-border-1 bg-surface-1 px-6 py-3.5 text-sm font-semibold text-ink-0 hover:border-gold/25 hover:text-gold"
            >
              {t('lab.final.about')}
              <ArrowRight className="h-4 w-4 rtl:rotate-180" />
            </Link>
          </div>
        </motion.div>
      </section>
    </main>
  )
}

export default LabPage