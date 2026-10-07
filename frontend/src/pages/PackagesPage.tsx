// frontend/src/pages/PackagesPage.tsx
import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { ArrowRight, Check, Sparkles, SlidersHorizontal, Table2, X } from 'lucide-react'
import { Link } from 'react-router-dom'
import MagneticButton from '../components/MagneticButton'
import { api } from '../utils/api-client'
import { useTranslate } from '../hooks/useTranslate'

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

const PackagesPage: React.FC = () => {
  const { t } = useTranslate()

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
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-gold-light opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-gold"></span>
            </span>
            <Sparkles className="h-3.5 w-3.5" />
            {String(t('hero.badge'))}
          </div>

          <h1 className="mb-4 text-4xl font-bold font-outfit text-ink-0 sm:text-5xl lg:text-6xl">
            {String(t('packages.title'))}
          </h1>

          <p className="mx-auto max-w-2xl text-base sm:text-lg text-ink-3">
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
              <span>{showCalculator ? t('packages.calc.hide') : t('packages.calc.calculator')}</span>
            </button>

            <button
              type="button"
              onClick={() => setShowComparison(true)}
              className="inline-flex items-center gap-2 rounded-full border border-border-1 bg-surface-1 px-4 py-2 text-xs sm:text-sm font-medium text-ink-1 hover:border-gold/30 hover:bg-surface-2 transition-all"
            >
              <Table2 className="h-4 w-4 text-blue-light" />
              <span>{t('packages.calc.compare')}</span>
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
              <div className="card card-featured p-6 sm:p-8">
                <div className="flex items-center justify-between pb-4 border-b border-border-1">
                  <div className="flex items-center gap-2.5">
                    <Sparkles className="h-5 w-5 text-gold" />
                     <h3 className="text-lg font-bold font-outfit text-ink-0">
                       {t('packages.calc.title')}
                     </h3>
                  </div>
                  <button
                    onClick={() => setShowCalculator(false)}
                     className="p-1.5 text-ink-2 hover:text-ink-0 rounded-lg hover:bg-surface-2 transition-colors"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>

                <div className="mt-6 grid gap-6 md:grid-cols-2">
                  <div>
                     <label className="block text-xs uppercase tracking-wider text-ink-3 mb-2">
                       {t('packages.calc.choose_scope')}
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
                               : 'border-border-1 bg-surface-1 text-ink-2 hover:border-gold/30 hover:bg-surface-1'
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
                        {t('packages.calc.estimate')}
                      </span>
                       <div className="mt-2 text-3xl font-bold font-outfit text-ink-0">
                         ~ ${calculatedEstimate.estimatedPrice}
                       </div>
                       <p className="mt-1 text-xs text-ink-3">
                         {calculatedEstimate.packageName} · {calculatedEstimate.serviceCount} {t('packages.calc.outputs')}
                       </p>
                    </div>

                    <div className="mt-4 pt-4 border-t border-border-1">
                      <button
                        type="button"
                        onClick={() => {
                          const matched = packages.find((p) => p.slug === calculatedEstimate.recommendedSlug)
                          if (matched) setSelectedPackageId(matched.id)
                          setShowCalculator(false)
                        }}
                        className="w-full py-2.5 px-4 rounded-xl bg-gold text-dark text-xs font-bold uppercase tracking-wider hover:bg-gold-light transition-all shadow-lg shadow-gold/20"
                      >
                        {t('packages.calc.select')}
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
               <h2 id="official-services-title" className="mt-2 text-2xl font-bold font-outfit text-ink-0 sm:text-3xl">
                 {t('packages.official_services')}
               </h2>
             </div>
             <span className="text-sm text-ink-3">{uniqueServices.length} {t('packages.services_count')}</span>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {uniqueServices.map((service) => {
              const isSubscription = service.metadata?.service_type === 'signature_subscription'
              return (
                <article key={service.id} className={`card card-interactive p-5 ${selectedServiceId === service.id ? 'card-is-active' : ''}`}>
                   <div className="flex items-start justify-between gap-3">
                     <h3 className="font-semibold text-ink-0">{service.name}</h3>
                     {isSubscription && <span className="shrink-0 rounded-full border border-gold/30 bg-gold/10 px-2 py-1 text-[10px] font-semibold text-gold">Signature Subscription</span>}
                   </div>
                   <p className="mt-2 min-h-12 text-sm leading-6 text-ink-3">{service.description || t(`services.${service.metadata?.source_id || 'svc-000'}.description`)}</p>
                   <div className="mt-4 flex items-center justify-between border-t border-border-1 pt-4 text-sm">
                     <span className="font-semibold text-gold">${Number(service.price).toFixed(0)}{isSubscription ? '/month' : ''}</span>
                     <span className="text-ink-3">{service.delivery}</span>
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
                   <h2 id="life-plan-feature-title" className="mt-4 text-3xl font-bold font-outfit text-ink-0">{lifePlan.name}</h2>
                   <p className="mt-2 max-w-2xl text-sm leading-6 text-ink-3">{lifePlan.description || t(`services.${lifePlan.metadata?.source_id || 'svc-018'}.description`)}</p>
                  <p className="mt-4 text-2xl font-bold font-outfit text-gold">${Number(lifePlan.price).toFixed(0)}/month</p>
                </div>
                <Link to="/services/life-plan" className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-gold px-5 py-3 text-sm font-semibold text-dark transition hover:bg-gold-light">
                  {t('packages.life_plan.cta')}
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
            </article>
          </section>
        )}

        {/* Packages Grid */}
        {loading ? (
          <div
            className="mx-auto max-w-2xl rounded-2xl border border-border-1 bg-surface-1 py-16 text-center text-ink-3"
            role="status"
          >
            {String(t('dashboard.loading'))}
          </div>
        ) : error ? (
          <div
            className="mx-auto max-w-2xl rounded-2xl border border-red-300/20 bg-red-300/5 p-8 text-center"
            role="alert"
          >
            <p className="text-ink-2">
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
          <div className="py-16 text-center text-ink-3">
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
                  className={`group card relative flex flex-col overflow-hidden p-6 transition-all duration-300 ${
                    pkg.is_popular ? 'card-pricing-focal neon-shimmer-border' : 'card-pricing'
                  } ${
                    isSelected ? 'card-is-active' : ''
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

                  <h2 className="mt-5 text-2xl font-bold font-outfit text-ink-0">
                    {pkg.name}
                  </h2>

                  <p className="mt-2 min-h-12 text-sm leading-6 text-ink-3">
                    {pkg.description || t(`packages.${pkg.slug || 'foundation'}.description`)}
                  </p>

                  <div className="my-5 flex items-end gap-2 border-b border-border-1 pb-5">
                    <span className="font-outfit text-3xl font-bold text-gold">
                      ${Number(pkg.price || 0).toFixed(2)}
                    </span>
                  </div>

                  <div className="flex-1 space-y-3">
                     {(pkg.features || []).map((feature, featureIndex) => (
                       <div
                         key={`${pkg.id}-${featureIndex}`}
                         className="flex items-start gap-2 text-sm text-ink-2"
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
                      : String(t('packages.view'))}
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
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-surface-inset backdrop-blur-md"
          >
            <motion.div
              initial={{ scale: 0.94, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.94, opacity: 0 }}
              className="relative w-full max-w-4xl max-h-[85vh] overflow-y-auto card card-default p-6 sm:p-8 shadow-2xl"
            >
              <div className="flex items-center justify-between pb-4 border-b border-border-1">
                <div>
                   <h3 className="text-xl font-bold font-outfit text-ink-0">
                     {t('packages.calc.compare')} BİŞIŞ V1
                   </h3>
                   <p className="text-xs text-ink-3 mt-1">
                     {t('packages.calc.compare_hint')}
                   </p>
                </div>
                   <button
                     onClick={() => setShowComparison(false)}
                     className="p-2 text-ink-2 hover:text-ink-0 rounded-xl hover:bg-surface-2 transition-colors"
                   >
                     <X className="h-5 w-5" />
                   </button>
              </div>

              <div className="mt-6 overflow-x-auto">
                <table className="w-full text-start text-sm">
                  <thead>
                     <tr className="border-b border-border-1 text-ink-2">
                      <th className="py-3 px-4 text-start font-semibold text-ink-0">{t('packages.calc.service_or_output')}</th>
                      {packages.map((pkg) => (
                        <th key={pkg.id} className="py-3 px-4 text-center font-semibold text-gold">
                          {pkg.name}<br />${Number(pkg.price).toFixed(0)}
                        </th>
                      ))}
                    </tr>
                  </thead>
                   <tbody className="divide-y divide-white/5 text-ink-2">
                    {[...new Set(packages.flatMap((pkg) => pkg.features || []))].map((feature) => (
                      <tr key={feature}>
                        <td className="py-3.5 px-4 font-medium">{feature}</td>
                        {packages.map((pkg) => (
                          <td key={pkg.id} className="py-3.5 px-4 text-center">
                             {(pkg.features || []).includes(feature) ? <Check className="mx-auto h-4 w-4 text-gold" /> : <span className="text-ink-3">—</span>}
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
                    {t('packages.calc.close')}
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
            className="fixed bottom-5 left-1/2 z-40 w-[calc(100%-2rem)] max-w-2xl -translate-x-1/2 rounded-2xl border border-gold/30 bg-surface-inset p-4 shadow-2xl shadow-black/40 backdrop-blur-xl sm:p-5"
          >
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-gold">
                  {String(t('packages.selected'))}
                </p>

                 <p className="mt-1 text-base font-semibold text-ink-0">
                   {(selectedPackage?.name || selectedService?.name)}{' '}
                   <span className="font-outfit text-gold">
                     · ${Number(selectedPackage?.price ?? selectedService?.price ?? 0).toFixed(2)}
                   </span>
                 </p>

                 <p className="mt-1 text-xs text-ink-3">
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
