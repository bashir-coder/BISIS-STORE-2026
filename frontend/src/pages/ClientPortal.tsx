import React, { useEffect, useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { useTranslation } from 'react-i18next'
import { AlertCircle, ArrowRight, CheckCircle, Clock, DollarSign, RefreshCw, Sparkles } from 'lucide-react'
import { Link } from 'react-router-dom'
import { api } from '../utils/api-client'
import OrderLifecycle from '../components/OrderLifecycle'
import ClientDeliveryHome from '../components/ClientDeliveryHome'

interface Order {
  id?: string
  submission_id?: string
  package?: string
  package_name?: string
  amount?: number | string | null
  price?: number | string | null
  total?: number | string | null
  status?: string
  created_at?: string
  updated_at?: string
  project_id?: number | null
}

const ClientPortal: React.FC = () => {
  const { t } = useTranslation()
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)

  useEffect(() => {
    void fetchOrders()
  }, [])

  const fetchOrders = async () => {
    setLoadError(false)
    try {
      const { data } = await api.get('/api/orders/my-orders')
      setOrders(Array.isArray(data) ? data : [])
    } catch (err) {
      console.error(err)
      setOrders([])
      setLoadError(true)
    } finally {
      setLoading(false)
    }
  }

  const stats = useMemo(() => {
    const completed = orders.filter((order) => (order.status || '').toLowerCase() === 'completed').length
    const processing = orders.filter((order) => (order.status || '').toLowerCase() === 'processing').length
    const revenue = orders.reduce((sum, order) => sum + Number(order.amount ?? order.price ?? order.total ?? 0), 0)
    return { completed, processing, revenue }
  }, [orders])

  const getOrderPrice = (order: Order) => {
    const rawValue = order.price ?? order.amount ?? order.total ?? 0
    const numericValue = Number(rawValue)
    return Number.isFinite(numericValue) ? numericValue : 0
  }

  const formatDate = (value?: string) => {
    if (!value) return '—'
    const date = new Date(value)
    return Number.isNaN(date.getTime()) ? '—' : date.toLocaleDateString()
  }

  return (
    <div className="min-h-screen pt-24 pb-20 section-padding">
      <div className="max-w-7xl mx-auto">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          <div className="mb-8 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-sm uppercase tracking-[0.3em] text-gold/70">{t('client_portal.title')}</p>
              <h1 className="text-3xl font-bold text-white">{t('client_portal.your_service_workspace')}</h1>
              <p className="mt-2 text-white/50">{t('client_portal.track_requests')}</p>
            </div>
            <Link to="/packages" className="inline-flex items-center gap-2 rounded-lg border border-gold/20 bg-gold/10 px-4 py-2 text-sm font-medium text-gold transition hover:bg-gold/20">
              {t('client_portal.create_another_request')}
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>

          {loadError && <div role="alert" className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-red-400/20 bg-red-500/10 p-4 text-sm text-red-100"><span className="inline-flex items-center gap-2"><AlertCircle className="h-4 w-4" />{t('client.home.error')}</span><button type="button" onClick={() => void fetchOrders()} className="inline-flex items-center gap-2 rounded-lg border border-red-200/30 px-3 py-2 hover:bg-red-300/10"><RefreshCw className="h-4 w-4" />{t('client.home.retry')}</button></div>}

          <ClientDeliveryHome />

          <div className="mb-8 grid gap-4 md:grid-cols-3">
            {[
              { label: t('client_portal.completed'), value: stats.completed, icon: CheckCircle, accent: 'text-green-300' },
              { label: t('client_portal.in_progress'), value: stats.processing, icon: Clock, accent: 'text-yellow-300' },
              { label: t('client_portal.total_spent'), value: `$${stats.revenue.toFixed(2)}`, icon: DollarSign, accent: 'text-gold' },
            ].map((item, index) => (
              <div key={index} className="glass rounded-2xl border-gold/5 p-5">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-white/50">{item.label}</span>
                  <item.icon className={`h-5 w-5 ${item.accent}`} />
                </div>
                <div className="mt-4 text-2xl font-semibold text-white">{item.value}</div>
              </div>
            ))}
          </div>

          <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
            <div className="glass rounded-3xl border-gold/5 p-6">
              <div className="flex items-center gap-3">
                <div className="rounded-2xl border border-gold/20 bg-gold/10 p-2.5">
                  <Sparkles className="h-5 w-5 text-gold" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-white">{t('client_portal.what_happens_next')}</h2>
                  <p className="text-sm text-white/50">{t('client_portal.journey_description')}</p>
                </div>
              </div>

              <div className="mt-6 space-y-4">
                {[
                  { title: t('client_portal.step1_title'), description: t('client_portal.step1_desc') },
                  { title: t('client_portal.step2_title'), description: t('client_portal.step2_desc') },
                  { title: t('client_portal.step3_title'), description: t('client_portal.step3_desc') },
                ].map((step, index) => (
                  <div key={index} className="flex gap-3 rounded-2xl border border-white/10 bg-black/20 p-4">
                    <div className="mt-1 rounded-full border border-gold/20 bg-gold/10 p-2 text-gold">
                      <CheckCircle className="h-4 w-4" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-white">{step.title}</p>
                      <p className="mt-1 text-sm text-white/50">{step.description}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="glass rounded-3xl border-gold/5 p-6">
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-white">{t('client_portal.your_requests')}</h2>
                  <p className="text-sm text-white/50">{t('client_portal.latest_orders')}</p>
                </div>
                <Link to="/dashboard" className="text-sm text-gold hover:underline">{t('client_portal.open_dashboard')}</Link>
              </div>

              {loading ? (
                <div className="rounded-2xl border border-white/10 bg-white/5 p-8 text-center text-white/40">{t('dashboard.loading')}</div>
              ) : orders.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-white/10 bg-white/5 p-8 text-center"><p className="text-sm text-white/70">{t('client_portal.no_requests_yet')}</p><p className="mx-auto mt-2 max-w-sm text-sm text-white/40">{t('client_portal.no_requests_context', 'Your workspace is ready. Your first request will appear here after you choose a package.')}</p></div>
              ) : (
                <div className="space-y-3">
                  {orders.map((order) => (
                    <div key={order.id} className="rounded-2xl border border-white/10 bg-black/20 p-4">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold text-white">#{String(order.submission_id || order.id || 'order').slice(0, 8)}</p>
                          <p className="mt-1 text-sm text-white/50">{order.package || order.package_name || t('dashboard.package')}</p>
                          {order.project_id && <Link to={`/projects/${order.project_id}`} className="mt-2 inline-flex items-center text-xs text-gold hover:underline">{t('workbench.open_project')}</Link>}
                        </div>
                        <div className="text-end">
                          <p className="text-sm font-semibold text-gold">${getOrderPrice(order).toFixed(2)}</p>
                          <p className="mt-1 text-xs uppercase tracking-wide text-white/40">{order.status || 'new'}</p>
                        </div>
                      </div>
                      <div className="mt-3 text-sm text-white/50">{t('dashboard.updated')} {formatDate(order.updated_at || order.created_at)}</div>
                      <div className="mt-3 rounded-xl border border-white/10 bg-black/20 p-3"><OrderLifecycle status={order.status} /></div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  )
}

export default ClientPortal
