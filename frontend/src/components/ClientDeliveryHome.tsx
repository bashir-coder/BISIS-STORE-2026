import { AlertCircle, ArrowUpRight, CheckCircle2, CircleDot, Clock3, FolderKanban, RefreshCw } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useEffect, useState } from 'react'
import { api } from '../utils/api-client'

type ClientProject = {
  id: number
  name: string
  execution_state?: string | null
  waiting_on?: string | null
  progress?: { percent: number; completed: number; total: number } | null
  next_action?: { type: string; title: string; priority: string } | null
  current_milestone?: { title: string } | null
  state_updated_at?: string | null
}

type ClientHomePayload = {
  projects: ClientProject[]
  actions: Array<{ project_id: number; project_name: string; title: string; priority: string }>
}

const statusKey = (state?: string | null) => state ? `client.state.${state}` : 'client.state.not_started'

const ClientDeliveryHome: React.FC = () => {
  const { t, i18n } = useTranslation()
  const [payload, setPayload] = useState<ClientHomePayload | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  const load = async () => {
    setLoading(true)
    setError(false)
    try {
      const { data } = await api.get('/api/service-delivery/client/home')
      setPayload(data?.data || { projects: [], actions: [] })
    } catch {
      setError(true)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { void load() }, [])

  const locale = i18n.language === 'ar' ? 'ar-EG' : i18n.language === 'tr' ? 'tr-TR' : 'en-US'
  const formatDate = (value?: string | null) => value ? new Date(value).toLocaleDateString(locale, { dateStyle: 'medium' }) : null

  if (loading) {
    return <section aria-label={String(t('client.home.loading'))} className="mb-6 grid gap-4 lg:grid-cols-[1.1fr_0.9fr]"><div className="animate-pulse rounded-3xl border border-gold/10 bg-white/[0.03] p-6"><div className="h-3 w-28 rounded bg-white/10" /><div className="mt-4 h-8 w-72 rounded bg-white/10" /><div className="mt-3 h-4 w-full max-w-xl rounded bg-white/5" /></div><div className="animate-pulse rounded-3xl border border-white/10 bg-white/[0.03] p-6"><div className="h-4 w-36 rounded bg-white/10" /><div className="mt-5 h-16 rounded-2xl bg-white/5" /></div></section>
  }

  if (error) {
    return <section role="alert" className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-red-400/20 bg-red-500/10 p-4 text-sm text-red-100"><span className="inline-flex items-center gap-2"><AlertCircle className="h-4 w-4" />{t('client.home.error')}</span><button type="button" onClick={() => void load()} className="inline-flex items-center gap-2 rounded-lg border border-red-200/30 px-3 py-2 hover:bg-red-300/10"><RefreshCw className="h-4 w-4" />{t('client.home.retry')}</button></section>
  }

  const projects = payload?.projects || []
  const actions = payload?.actions || []
  const firstAction = actions[0]

  return <section className="mb-6 grid gap-4 lg:grid-cols-[1.1fr_0.9fr]" aria-labelledby="client-home-title">
    <div className="rounded-3xl border border-gold/15 bg-gradient-to-br from-gold/[0.11] via-white/[0.035] to-transparent p-6">
      <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-gold/80"><FolderKanban className="h-4 w-4" />{t('client.home.eyebrow')}</div>
      <h2 id="client-home-title" className="mt-3 text-2xl font-semibold text-white">{t('client.home.title')}</h2>
      <p className="mt-2 max-w-xl text-sm leading-6 text-white/55">{t('client.home.subtitle')}</p>
      {firstAction ? <Link to={`/projects/${firstAction.project_id}`} className="mt-5 inline-flex items-center gap-2 rounded-xl bg-gold px-4 py-2.5 text-sm font-semibold text-black transition hover:bg-gold/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/70"><ArrowUpRight className="h-4 w-4" />{firstAction.title}</Link> : <p className="mt-5 inline-flex items-center gap-2 rounded-xl border border-emerald-300/20 bg-emerald-400/10 px-4 py-2.5 text-sm text-emerald-100"><CheckCircle2 className="h-4 w-4" />{t('client.home.all_clear')}</p>}
    </div>

    <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-6">
      <div className="flex items-center justify-between"><div><p className="text-xs uppercase tracking-[0.18em] text-white/40">{t('client.home.active_projects')}</p><p className="mt-2 text-3xl font-bold text-white">{projects.length}</p></div><CircleDot className="h-5 w-5 text-gold" /></div>
      <p className="mt-3 text-sm text-white/45">{actions.length ? t('client.home.actions_count', { count: actions.length }) : t('client.home.no_actions')}</p>
    </div>

    {projects.length > 0 && <div className="lg:col-span-2 grid gap-4 md:grid-cols-2">
      {projects.slice(0, 4).map((project) => <Link key={project.id} to={`/projects/${project.id}`} className="group rounded-3xl border border-white/10 bg-white/[0.03] p-5 transition hover:-translate-y-0.5 hover:border-gold/25 hover:bg-white/[0.05] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/70">
        <div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="truncate text-lg font-semibold text-white">{project.name}</p><p className="mt-1 text-sm text-gold/80">{t(statusKey(project.execution_state))}</p></div><ArrowUpRight className="h-4 w-4 shrink-0 text-white/35 transition group-hover:text-gold" /></div>
        {project.progress ? <><div className="mt-5 flex items-center justify-between text-xs text-white/45"><span>{t('client.home.progress')}</span><span>{t('client.home.steps_done', { completed: project.progress.completed, total: project.progress.total })}</span></div><div className="mt-2 h-2 overflow-hidden rounded-full bg-white/10"><div className="h-full rounded-full bg-gradient-to-r from-gold-dark to-gold" style={{ width: `${project.progress.percent}%` }} /></div></> : <p className="mt-5 text-sm text-white/40">{t('client.home.progress_not_available')}</p>}
        <div className="mt-4 flex flex-wrap items-center gap-2 text-xs text-white/40">{project.current_milestone && <span className="inline-flex items-center gap-1 rounded-full border border-white/10 px-2.5 py-1"><Clock3 className="h-3 w-3" />{project.current_milestone.title}</span>}{project.state_updated_at && <span>{t('client.home.updated')} {formatDate(project.state_updated_at)}</span>}</div>
        {project.next_action && <div className="mt-4 rounded-xl border border-gold/15 bg-gold/[0.06] px-3 py-2 text-sm text-gold/90">{project.next_action.title}</div>}
      </Link>)}
    </div>}
  </section>
}

export default ClientDeliveryHome

