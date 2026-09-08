import React from 'react'
import { Activity, ArrowRight, CheckCircle2, ChevronRight, Clock3, Flame, Inbox, Zap } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'

type PulseLevel = 'critical' | 'high' | 'medium' | 'low'

export interface PulseItem {
  id: string
  title: string
  description: string
  meta?: string
  level?: PulseLevel
  href?: string
  onClick?: () => void
}

interface ActivityItem {
  id: string
  title: string
  meta: string
}

interface OperationalPulseProps {
  greeting: string
  subtitle: string
  priority: PulseItem[]
  inProgress: PulseItem[]
  completed: PulseItem[]
  activity: ActivityItem[]
  emptyPriority: string
  emptyProgress: string
  emptyCompleted: string
  emptyActivity: string
}

const levelStyles: Record<PulseLevel, string> = {
  critical: 'border-red-400/30 bg-red-500/10 text-red-200',
  high: 'border-orange-400/30 bg-orange-500/10 text-orange-200',
  medium: 'border-yellow-400/30 bg-yellow-500/10 text-yellow-200',
  low: 'border-white/10 bg-white/[0.04] text-white/70',
}

const levelKeys: Record<PulseLevel, string> = {
  critical: 'admin.priority_critical',
  high: 'admin.priority_high',
  medium: 'admin.priority_medium',
  low: 'admin.priority_low',
}

const PulseAction: React.FC<{ item: PulseItem }> = ({ item }) => {
  const { t } = useTranslation()
  const content = (
    <>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className="truncate text-sm font-semibold text-white">{item.title}</p>
          {item.level && <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${levelStyles[item.level]}`}>{t(levelKeys[item.level], item.level)}</span>}
        </div>
        <p className="mt-1 text-xs leading-5 text-white/55">{item.description}</p>
        {item.meta && <p className="mt-2 text-[11px] text-white/35">{item.meta}</p>}
      </div>
      <ChevronRight aria-hidden="true" className="mt-1 h-4 w-4 shrink-0 text-white/35 transition-transform group-hover:translate-x-0.5 group-hover:text-gold" />
    </>
  )

  if (item.href) {
    return <Link to={item.href} className="group flex items-start gap-3 rounded-2xl border border-white/10 bg-black/20 p-3 text-left transition hover:border-gold/30 hover:bg-white/[0.06] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/70">{content}</Link>
  }

  return <button type="button" onClick={item.onClick} className="group flex w-full items-start gap-3 rounded-2xl border border-white/10 bg-black/20 p-3 text-left transition hover:border-gold/30 hover:bg-white/[0.06] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/70">{content}</button>
}

const Section: React.FC<{ title: string; icon: React.ReactNode; items: PulseItem[]; empty: string }> = ({ title, icon, items, empty }) => (
  <section className="rounded-2xl border border-white/10 bg-black/20 p-4">
    <div className="mb-3 flex items-center justify-between gap-3">
      <div className="flex items-center gap-2 text-sm font-semibold text-white"><span className="text-gold">{icon}</span>{title}</div>
      <span className="rounded-full bg-white/5 px-2 py-0.5 text-[11px] text-white/40">{items.length}</span>
    </div>
    {items.length === 0 ? <p className="rounded-xl border border-dashed border-white/10 px-3 py-4 text-center text-xs text-white/40">{empty}</p> : <div className="space-y-2">{items.slice(0, 4).map((item) => <PulseAction key={item.id} item={item} />)}</div>}
  </section>
)

const OperationalPulse: React.FC<OperationalPulseProps> = ({ greeting, subtitle, priority, inProgress, completed, activity, emptyPriority, emptyProgress, emptyCompleted, emptyActivity }) => {
  const { t } = useTranslation()
  return (
  <section aria-labelledby="operational-pulse-title" className="mb-8 overflow-hidden rounded-3xl border border-gold/15 bg-gradient-to-br from-gold/[0.08] via-white/[0.03] to-transparent p-5 shadow-2xl shadow-black/20 sm:p-6">
    <div className="mb-5 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
      <div>
        <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.25em] text-gold/80"><Zap aria-hidden="true" className="h-4 w-4" />{t('admin.pulse_live_operations', 'Live operations')}</div>
        <h2 id="operational-pulse-title" className="text-2xl font-bold text-white sm:text-3xl">{greeting}</h2>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-white/55">{subtitle}</p>
      </div>
      <div className="flex items-center gap-2 rounded-full border border-white/10 bg-black/20 px-3 py-2 text-xs text-white/55"><Activity aria-hidden="true" className="h-4 w-4 text-gold" />{t('admin.pulse_snapshot', 'Real-time snapshot')}</div>
    </div>

    <div className="grid gap-4 xl:grid-cols-3">
      <Section title={t('admin.priority', 'Priority')} icon={<Flame aria-hidden="true" className="h-4 w-4" />} items={priority} empty={emptyPriority} />
      <Section title={t('admin.in_progress')} icon={<Clock3 aria-hidden="true" className="h-4 w-4" />} items={inProgress} empty={emptyProgress} />
      <Section title={t('admin.recently_completed', 'Recently completed')} icon={<CheckCircle2 aria-hidden="true" className="h-4 w-4" />} items={completed} empty={emptyCompleted} />
    </div>

    <div className="mt-4 rounded-2xl border border-white/10 bg-black/20 p-4">
      <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-white"><Inbox aria-hidden="true" className="h-4 w-4 text-gold" />{t('admin.recent_activity', 'Recent activity')}</div>
      {activity.length === 0 ? <p className="rounded-xl border border-dashed border-white/10 px-3 py-4 text-center text-xs text-white/40">{emptyActivity}</p> : <div className="grid gap-2 md:grid-cols-2">{activity.slice(0, 6).map((item) => <div key={item.id} className="flex items-start gap-3 rounded-xl border border-white/10 bg-white/[0.03] p-3"><span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-gold shadow-[0_0_12px_rgba(212,175,55,0.8)]" /><div className="min-w-0"><p className="text-sm text-white/80">{item.title}</p><p className="mt-1 text-xs text-white/35">{item.meta}</p></div></div>)}</div>}
    </div>

    <div className="mt-4 flex items-center justify-end text-xs text-white/40"><span>{t('admin.priority_disclaimer', 'Operational priority is based on current records.')}</span><ArrowRight aria-hidden="true" className="ml-2 h-3.5 w-3.5" /></div>
  </section>
  )
}

export default OperationalPulse

