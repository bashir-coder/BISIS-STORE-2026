import React from 'react'
import { Check, Circle, Clock3 } from 'lucide-react'
import { useTranslation } from 'react-i18next'

type OrderStatus = 'new' | 'processing' | 'completed'

interface OrderLifecycleProps {
  status?: string
  compact?: boolean
}

const steps: OrderStatus[] = ['new', 'processing', 'completed']

const OrderLifecycle: React.FC<OrderLifecycleProps> = ({ status, compact = false }) => {
  const { t } = useTranslation()
  const normalized = steps.includes((status || 'new') as OrderStatus) ? (status || 'new') as OrderStatus : 'new'
  const activeIndex = steps.indexOf(normalized)
  const labels: Record<OrderStatus, string> = {
    new: t('dashboard.order_received'),
    processing: t('dashboard.order_processing'),
    completed: t('dashboard.order_completed'),
  }

  return (
    <div aria-label={t('dashboard.order_progress')} className={`flex ${compact ? 'items-center gap-1.5' : 'items-start gap-2'}`}>
      {steps.map((step, index) => {
        const complete = index < activeIndex || normalized === 'completed'
        const current = index === activeIndex
        return (
          <React.Fragment key={step}>
            <div className={`flex min-w-0 ${compact ? 'items-center gap-1' : 'flex-1 flex-col gap-2'}`}>
              <div className={`flex items-center ${compact ? '' : 'gap-2'}`}>
                <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border ${complete ? 'border-green-400/40 bg-green-400/15 text-green-300' : current ? 'border-gold/50 bg-gold/15 text-gold neon-glow-gold-2' : 'border-border-2 bg-surface-2 text-ink-4'}`}>
                  {complete ? <Check aria-hidden="true" className="h-3.5 w-3.5" /> : current ? <Clock3 aria-hidden="true" className="h-3.5 w-3.5" /> : <Circle aria-hidden="true" className="h-2.5 w-2.5" />}
                </span>
                {!compact && <span className={`text-xs ${current ? 'font-semibold text-ink-0' : complete ? 'text-green-200/80' : 'text-ink-0/35'}`}>{labels[step]}</span>}
              </div>
              {!compact && <div className={`h-1 rounded-full ${complete ? 'bg-green-400/70' : current ? 'bg-gold/60' : 'bg-surface-2'}`} />}
            </div>
            {index < steps.length - 1 && compact && <span aria-hidden="true" className={`h-px w-4 ${index < activeIndex ? 'bg-green-400/60' : 'bg-surface-2'}`} />}
          </React.Fragment>
        )
      })}
    </div>
  )
}

export default OrderLifecycle

