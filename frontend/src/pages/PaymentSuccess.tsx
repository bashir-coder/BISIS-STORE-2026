import React, { useEffect, useState } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { api } from '../utils/api-client'
import { motion } from 'framer-motion'
import {
  CheckCircle,
  Clock,
  AlertTriangle,
  ArrowLeft,
  Loader2,
} from 'lucide-react'

type OrderStatus = {
  id: number
  payment_status?: string
  nowpayments_status?: string
  status?: string
  submission_id?: string
}

const PaymentSuccess: React.FC = () => {
  const { t } = useTranslation()
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()

  const orderId = searchParams.get('order_id')

  const [order, setOrder] = useState<OrderStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const getPaymentStatus = (o: OrderStatus): string => {
    return o.nowpayments_status || o.payment_status || 'unknown'
  }

  const getStatusDisplay = (status: string) => {
    switch (status) {
      case 'verified':
      case 'finished':
        return { label: t('payment_status.verified'), color: 'text-green-300', icon: <CheckCircle className="w-5 h-5" /> }
      case 'confirming':
      case 'confirmed':
      case 'sending':
      case 'submitted':
        return { label: t('payment_status.confirming'), color: 'text-yellow-300', icon: <Clock className="w-5 h-5 animate-spin" /> }
      case 'waiting':
      case 'pending':
        return { label: t('payment_status.waiting'), color: 'text-blue-300', icon: <Clock className="w-5 h-5" /> }
      case 'failed':
      case 'expired':
        return { label: t('payment_status.failed'), color: 'text-red-300', icon: <AlertTriangle className="w-5 h-5" /> }
      case 'refunded':
        return { label: t('payment_status.refunded'), color: 'text-gray-300', icon: <AlertTriangle className="w-5 h-5" /> }
      default:
        return { label: t('payment_status.unknown'), color: 'text-ink-3', icon: <Clock className="w-5 h-5" /> }
    }
  }

  useEffect(() => {
    if (!orderId) {
      setError(t('payment_success.no_order_id'))
      setLoading(false)
      return
    }

    const fetchOrder = async () => {
      try {
        const { data } = await api.get(`/api/orders/${orderId}`)
        setOrder(data)
      } catch (err) {
        console.error('Failed to load order:', err)
        setError(t('payment_success.load_error'))
      } finally {
        setLoading(false)
      }
    }

    void fetchOrder()
  }, [orderId])

  const handleGoToDashboard = () => {
    navigate('/dashboard')
  }

  const handleGoToOrder = () => {
    if (order?.id) {
      navigate(`/dashboard`)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen pt-24 pb-20 section-padding flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-10 h-10 animate-spin text-gold mx-auto mb-4" />
          <p className="text-ink-3">{t('payment_success.loading')}</p>
        </div>
      </div>
    )
  }

  if (error || !order) {
    return (
      <div className="min-h-screen pt-24 pb-20 section-padding">
        <div className="max-w-md mx-auto text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="glass rounded-2xl p-8 border border-red-500/20"
          >
            <AlertTriangle className="w-12 h-12 text-red-400 mx-auto mb-4" />
            <h1 className="text-xl font-bold text-ink-0 mb-2">
              {t('payment_success.error_title')}
            </h1>
            <p className="text-ink-0/60 mb-6">{error || t('payment_success.unknown_error')}</p>
            <button
              onClick={handleGoToDashboard}
              className="btn-primary flex items-center justify-center gap-2 mx-auto"
            >
              <ArrowLeft className="w-4 h-4" />
              {t('payment_success.back_to_dashboard')}
            </button>
          </motion.div>
        </div>
      </div>
    )
  }

  const paymentStatus = getPaymentStatus(order)
  const statusDisplay = getStatusDisplay(paymentStatus)

  return (
    <div className="min-h-screen pt-24 pb-20 section-padding">
      <div className="max-w-md mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass rounded-2xl p-8 border border-gold/10 text-center"
        >
          <div className={`mx-auto mb-4 p-3 rounded-full bg-${paymentStatus === 'verified' || paymentStatus === 'finished' ? 'green' : paymentStatus === 'failed' || paymentStatus === 'expired' ? 'red' : 'yellow'}-500/20`}>
            {statusDisplay.icon}
          </div>

          <h1 className="text-2xl font-bold text-ink-0 mb-2">
            {t('payment_success.title')}
          </h1>

          <p className="text-ink-0/60 mb-6">
            {t('payment_success.subtitle', { orderId: order.submission_id?.slice(0, 8) || order.id })}
          </p>

          <div className="mb-6 p-4 bg-surface-1 rounded-xl border border-border-1">
            <div className="flex items-center justify-center gap-2 mb-2">
              <span className={`font-medium ${statusDisplay.color}`}>
                {statusDisplay.label}
              </span>
            </div>
            <p className="text-xs text-ink-0/40">
              {t('payment_success.status_note')}
            </p>
          </div>

          <div className="space-y-3">
            <button
              onClick={handleGoToDashboard}
              className="w-full btn-primary flex items-center justify-center gap-2"
            >
              <ArrowLeft className="w-4 h-4" />
              {t('payment_success.back_to_dashboard')}
            </button>

            <button
              onClick={handleGoToOrder}
              className="w-full flex items-center justify-center gap-2 px-4 py-2 rounded-lg border border-border-1 bg-surface-1 text-ink-0/70 hover:bg-surface-2 transition-colors"
            >
              {t('payment_success.view_order')}
            </button>
          </div>

          <p className="mt-6 text-xs text-ink-0/30">
            {t('payment_success.ipn_note')}
          </p>
        </motion.div>
      </div>
    </div>
  )
}

export default PaymentSuccess