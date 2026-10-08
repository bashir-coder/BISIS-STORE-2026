import React, { useEffect, useState } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { api } from '../utils/api-client'
import { motion } from 'framer-motion'
import {
  XCircle,
  ArrowLeft,
  RotateCcw,
  Loader2,
} from 'lucide-react'

type OrderStatus = {
  id: number
  payment_status?: string
  nowpayments_status?: string
  status?: string
  submission_id?: string
}

const PaymentCancelled: React.FC = () => {
  const { t } = useTranslation()
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()

  const orderId = searchParams.get('order_id')

  const [order, setOrder] = useState<OrderStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!orderId) {
      setError(t('payment_cancelled.no_order_id'))
      setLoading(false)
      return
    }

    const fetchOrder = async () => {
      try {
        const { data } = await api.get(`/api/orders/${orderId}`)
        setOrder(data)
      } catch (err) {
        console.error('Failed to load order:', err)
        setError(t('payment_cancelled.load_error'))
      } finally {
        setLoading(false)
      }
    }

    void fetchOrder()
  }, [orderId])

  const handleGoToDashboard = () => {
    navigate('/dashboard')
  }

  const handleRetryPayment = () => {
    if (order?.id) {
      navigate(`/payment`, { state: { packageId: null, serviceId: null } })
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen pt-24 pb-20 section-padding flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-10 h-10 animate-spin text-gold mx-auto mb-4" />
          <p className="text-ink-3">{t('payment_cancelled.loading')}</p>
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
            <XCircle className="w-12 h-12 text-red-400 mx-auto mb-4" />
            <h1 className="text-xl font-bold text-ink-0 mb-2">
              {t('payment_cancelled.error_title')}
            </h1>
            <p className="text-ink-0/60 mb-6">{error || t('payment_cancelled.unknown_error')}</p>
            <button
              onClick={handleGoToDashboard}
              className="btn-primary flex items-center justify-center gap-2 mx-auto"
            >
              <ArrowLeft className="w-4 h-4" />
              {t('payment_cancelled.back_to_dashboard')}
            </button>
          </motion.div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen pt-24 pb-20 section-padding">
      <div className="max-w-md mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass rounded-2xl p-8 border border-gold/10 text-center"
        >
          <div className="mx-auto mb-4 p-3 rounded-full bg-yellow-500/20">
            <XCircle className="w-10 h-10 text-yellow-400" />
          </div>

          <h1 className="text-2xl font-bold text-ink-0 mb-2">
            {t('payment_cancelled.title')}
          </h1>

          <p className="text-ink-0/60 mb-6">
            {t('payment_cancelled.subtitle', { orderId: order.submission_id?.slice(0, 8) || order.id })}
          </p>

          <div className="mb-6 p-4 bg-surface-1 rounded-xl border border-border-1">
            <p className="text-ink-0/70 mb-2">
              {t('payment_cancelled.payment_not_completed')}
            </p>
            <p className="text-xs text-ink-0/40">
              {t('payment_cancelled.no_changes_made')}
            </p>
          </div>

          <div className="space-y-3">
            <button
              onClick={handleRetryPayment}
              className="w-full btn-primary flex items-center justify-center gap-2"
            >
              <RotateCcw className="w-4 h-4" />
              {t('payment_cancelled.try_again')}
            </button>

            <button
              onClick={handleGoToDashboard}
              className="w-full flex items-center justify-center gap-2 px-4 py-2 rounded-lg border border-border-1 bg-surface-1 text-ink-0/70 hover:bg-surface-2 transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              {t('payment_cancelled.back_to_dashboard')}
            </button>
          </div>

          <p className="mt-6 text-xs text-ink-0/30">
            {t('payment_cancelled.note')}
          </p>
        </motion.div>
      </div>
    </div>
  )
}

export default PaymentCancelled