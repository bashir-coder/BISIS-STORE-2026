import React, { useEffect, useMemo, useState } from 'react'
import { ArrowRight, CheckCircle2, Clock3, FolderOpen, RefreshCw, Ticket, UserRound, Wrench } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { api } from '../utils/api-client'
import OrderLifecycle from '../components/OrderLifecycle'

type Order = { id?: string; submission_id?: string; package?: string; package_name?: string; status?: string; project_id?: number | null; created_at?: string; updated_at?: string; user_id?: string | null }
type Project = { id: number; name: string; status: string; updated_at?: string; created_at?: string }
type TicketRecord = { id: number; title: string; description: string; status: string; created_at: string; updated_at?: string }
type ExecutionTemplate = { id: number; name: string; service_id?: number | null }
type OperationalProject = { id: number; name: string; execution_state: string; waiting_on?: string | null; pending_requirements: number; task_count: number; completed_task_count: number; delivery_status?: string | null; next_action?: { title: string; priority: string } | null }

const WorkbenchPage: React.FC = () => {
  const { t, i18n } = useTranslation()
  const [orders, setOrders] = useState<Order[]>([])
  const [projects, setProjects] = useState<Project[]>([])
  const [tickets, setTickets] = useState<TicketRecord[]>([])
  const [templates, setTemplates] = useState<ExecutionTemplate[]>([])
  const [queue, setQueue] = useState<OperationalProject[]>([])
  const [selectedTemplateByOrder, setSelectedTemplateByOrder] = useState<Record<string, string>>({})
  const [initializingOrder, setInitializingOrder] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const loadData = async () => {
    setLoading(true)
    setError(null)
    try {
      const [ordersResponse, projectsResponse, ticketsResponse, templatesResponse, queueResponse] = await Promise.all([api.get('/api/orders'), api.get('/api/projects'), api.get('/api/tickets'), api.get('/api/execution/templates'), api.get('/api/service-delivery/operations/queue')])
      const ordersData = ordersResponse.data?.data || ordersResponse.data
      setOrders(Array.isArray(ordersData) ? ordersData : [])
      setProjects(Array.isArray(projectsResponse.data) ? projectsResponse.data : [])
      setTickets(Array.isArray(ticketsResponse.data) ? ticketsResponse.data : [])
      setTemplates(Array.isArray(templatesResponse.data?.data) ? templatesResponse.data.data : [])
      setQueue(Array.isArray(queueResponse.data?.data) ? queueResponse.data.data : [])
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : t('workbench.load_error', 'Unable to load the workbench.'))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { void loadData() }, [])

  const activeOrders = useMemo(() => orders.filter((order) => (order.status || 'new').toLowerCase() === 'processing'), [orders])
  const waitingOrders = useMemo(() => orders.filter((order) => (order.status || 'new').toLowerCase() === 'new' || (!order.project_id && (order.status || '').toLowerCase() !== 'completed')), [orders])
  const openTickets = useMemo(() => tickets.filter((ticket) => ticket.status === 'open' || ticket.status === 'in_progress'), [tickets])
  const completedOrders = useMemo(() => orders.filter((order) => (order.status || '').toLowerCase() === 'completed').slice(0, 6), [orders])
  const locale = i18n.language === 'ar' ? 'ar-EG' : i18n.language === 'tr' ? 'tr-TR' : 'en-US'
  const formatDate = (value?: string) => value ? new Date(value).toLocaleDateString(locale, { dateStyle: 'medium' }) : '—'

  const initializeOrder = async (order: Order) => {
    const orderKey = String(order.id || '')
    const templateId = selectedTemplateByOrder[orderKey]
    if (!order.id || !templateId) return
    setInitializingOrder(orderKey)
    try {
      await api.post(`/api/service-delivery/orders/${order.id}/initialize`, { template_id: Number(templateId) })
      await loadData()
    } catch (initializeError) {
      setError(initializeError instanceof Error ? initializeError.message : t('workbench.initialization_error', 'Unable to initialize this project.'))
    } finally {
      setInitializingOrder(null)
    }
  }

  const orderCard = (order: Order) => <div key={order.id} className="rounded-2xl border border-white/10 bg-black/20 p-4 transition hover:border-gold/25"><div className="flex items-start justify-between gap-3"><div><p className="text-sm font-semibold text-white">#{String(order.submission_id || order.id || '').slice(0, 8)}</p><p className="mt-1 text-xs text-white/40">{order.package || order.package_name || t('dashboard.package')} آ· {formatDate(order.updated_at || order.created_at)}</p></div><span className="rounded-full bg-white/5 px-2 py-1 text-[10px] uppercase text-white/45">{order.status || 'new'}</span></div><div className="mt-4"><OrderLifecycle status={order.status} compact /></div>{!order.project_id && ['processing', 'completed'].includes((order.status || '').toLowerCase()) && <div className="mt-4 rounded-xl border border-gold/15 bg-gold/[0.05] p-3"><p className="text-xs font-semibold uppercase tracking-[0.14em] text-gold/80">{t('workbench.initialize_project', 'Initialize project')}</p><div className="mt-2 flex flex-col gap-2 sm:flex-row"><select value={selectedTemplateByOrder[String(order.id)] || ''} onChange={(event) => setSelectedTemplateByOrder((current) => ({ ...current, [String(order.id)]: event.target.value }))} aria-label={t('workbench.template_select', 'Execution template')} className="min-w-0 flex-1 rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-xs text-white outline-none focus:border-gold/40"><option value="">{t('workbench.choose_template', 'Choose a template')}</option>{templates.map((template) => <option key={template.id} value={template.id}>{template.name}</option>)}</select><button type="button" disabled={!selectedTemplateByOrder[String(order.id)] || initializingOrder === String(order.id)} onClick={() => void initializeOrder(order)} className="rounded-lg bg-gold px-3 py-2 text-xs font-semibold text-black disabled:cursor-not-allowed disabled:opacity-50">{initializingOrder === String(order.id) ? t('workbench.initializing', 'Initializingâ€¦') : t('workbench.initialize', 'Initialize')}</button></div></div>}{order.project_id && <Link to={`/projects/${order.project_id}`} className="mt-4 inline-flex items-center gap-2 text-xs font-semibold text-gold hover:text-white">{t('workbench.open_project', 'Open project')}<ArrowRight className="h-3.5 w-3.5" /></Link>}</div>

  return (
    <div className="min-h-screen bg-transparent px-4 pb-20 pt-24 sm:px-6">
      <div className="mx-auto max-w-7xl">
        <div className="mb-8 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between"><div><p className="text-sm uppercase tracking-[0.3em] text-gold/70">{t('workbench.eyebrow', 'Execution workspace')}</p><h1 className="mt-2 text-3xl font-bold text-white sm:text-4xl">{t('workbench.title', 'Workbench')}</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-white/50">{t('workbench.subtitle', 'A focused view of what is moving, what is waiting, and what has been completed.')}</p></div><button type="button" onClick={() => void loadData()} className="inline-flex items-center justify-center gap-2 rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-sm text-white/70 hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/70"><RefreshCw className="h-4 w-4" />{t('dashboard.refresh')}</button></div>

        {error && <div role="alert" className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-red-400/20 bg-red-500/10 p-4 text-sm text-red-200"><span>{error}</span><button type="button" onClick={() => void loadData()} className="rounded-lg border border-red-300/30 px-3 py-1.5">{t('dashboard.retry')}</button></div>}

        {loading ? <div className="grid gap-4 lg:grid-cols-3 animate-pulse"><div className="h-96 rounded-3xl bg-white/5" /><div className="h-96 rounded-3xl bg-white/5" /><div className="h-96 rounded-3xl bg-white/5" /></div> : <>
          <div className="mb-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><div className="rounded-2xl border border-yellow-400/20 bg-yellow-500/10 p-4"><p className="text-xs text-yellow-200/70">{t('workbench.active_orders', 'Active orders')}</p><p className="mt-2 text-3xl font-bold text-white">{activeOrders.length}</p></div><div className="rounded-2xl border border-orange-400/20 bg-orange-500/10 p-4"><p className="text-xs text-orange-200/70">{t('workbench.waiting_orders', 'Waiting orders')}</p><p className="mt-2 text-3xl font-bold text-white">{waitingOrders.length}</p></div><div className="rounded-2xl border border-red-400/20 bg-red-500/10 p-4"><p className="text-xs text-red-200/70">{t('workbench.open_tickets', 'Open tickets')}</p><p className="mt-2 text-3xl font-bold text-white">{openTickets.length}</p></div><div className="rounded-2xl border border-green-400/20 bg-green-500/10 p-4"><p className="text-xs text-green-200/70">{t('workbench.active_projects', 'Active projects')}</p><p className="mt-2 text-3xl font-bold text-white">{projects.filter((project) => project.status === 'active').length}</p></div></div>

          <section className="mb-6 rounded-3xl border border-gold/15 bg-gradient-to-br from-gold/[0.08] to-transparent p-5"><div className="mb-4 flex items-center justify-between"><div><h2 className="flex items-center gap-2 text-lg font-semibold text-white"><Wrench className="h-5 w-5 text-gold" />{t('workbench.delivery_queue', 'Service delivery queue')}</h2><p className="mt-1 text-sm text-white/45">{t('workbench.delivery_queue_hint', 'Prioritized from persisted project state, requirements, tasks, and delivery.')}</p></div><span className="text-xs text-white/40">{queue.length}</span></div>{queue.length === 0 ? <p className="rounded-2xl border border-dashed border-white/10 p-5 text-center text-sm text-white/40">{t('workbench.no_delivery_queue', 'No service delivery items need attention.')}</p> : <div className="grid gap-3 md:grid-cols-2">{queue.filter((project) => project.next_action).slice(0, 6).map((project) => <Link key={project.id} to={`/projects/${project.id}`} className="group rounded-2xl border border-white/10 bg-black/20 p-4 hover:border-gold/25"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="truncate text-sm font-semibold text-white">{project.name}</p><p className="mt-1 text-xs text-gold/75">{project.next_action?.title}</p></div><ArrowRight className="h-4 w-4 shrink-0 text-gold transition-transform group-hover:translate-x-1" /></div><div className="mt-3 flex flex-wrap gap-2 text-[11px] text-white/45"><span>{project.execution_state}</span>{project.waiting_on && <span>آ· {t('workbench.waiting_on', 'Waiting on')} {project.waiting_on}</span>}{project.pending_requirements > 0 && <span>آ· {project.pending_requirements} {t('workbench.requirements_pending', 'requirements pending')}</span>}</div></Link>)}</div>}</section>

          <section className="mb-6 rounded-3xl border border-white/10 bg-white/[0.03] p-5"><div className="mb-4 flex items-center justify-between"><div><h2 className="flex items-center gap-2 text-lg font-semibold text-white"><FolderOpen className="h-5 w-5 text-gold" />{t('workbench.project_workspaces', 'Project workspaces')}</h2><p className="mt-1 text-sm text-white/45">{t('workbench.project_workspaces_hint', 'Open a project to see its linked order lifecycle and next action.')}</p></div><span className="text-xs text-white/35">{projects.length}</span></div>{projects.length === 0 ? <p className="rounded-2xl border border-dashed border-white/10 p-5 text-center text-sm text-white/40">{t('workbench.no_projects', 'No projects yet.')}</p> : <div className="grid gap-3 md:grid-cols-2">{projects.slice(0, 6).map((project) => <Link key={project.id} to={`/projects/${project.id}`} className="group rounded-2xl border border-white/10 bg-black/20 p-4 transition hover:border-gold/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/70"><div className="flex items-center justify-between gap-3"><p className="truncate text-sm font-semibold text-white">{project.name}</p><ArrowRight className="h-4 w-4 text-gold transition-transform group-hover:translate-x-1" /></div><div className="mt-2 flex items-center justify-between text-xs text-white/40"><span>{project.status}</span><span>{formatDate(project.updated_at || project.created_at)}</span></div></Link>)}</div>}</section>

          <div className="grid gap-4 xl:grid-cols-3"><section className="rounded-3xl border border-yellow-400/20 bg-gradient-to-br from-yellow-500/[0.08] to-transparent p-5"><div className="mb-4 flex items-center justify-between"><h2 className="flex items-center gap-2 text-lg font-semibold text-white"><Wrench className="h-5 w-5 text-yellow-200" />{t('workbench.in_progress', 'In progress')}</h2><span className="text-xs text-white/40">{activeOrders.length}</span></div>{activeOrders.length === 0 ? <p className="rounded-2xl border border-dashed border-white/10 p-5 text-center text-sm text-white/40">{t('workbench.no_active', 'Nothing is in progress right now.')}</p> : <div className="space-y-3">{activeOrders.slice(0, 6).map(orderCard)}</div>}</section><section className="rounded-3xl border border-orange-400/20 bg-gradient-to-br from-orange-500/[0.08] to-transparent p-5"><div className="mb-4 flex items-center justify-between"><h2 className="flex items-center gap-2 text-lg font-semibold text-white"><Clock3 className="h-5 w-5 text-orange-200" />{t('workbench.waiting', 'Waiting')}</h2><span className="text-xs text-white/40">{waitingOrders.length + openTickets.length}</span></div>{waitingOrders.length === 0 && openTickets.length === 0 ? <p className="rounded-2xl border border-dashed border-white/10 p-5 text-center text-sm text-white/40">{t('workbench.no_waiting', 'Nothing is waiting for attention.')}</p> : <div className="space-y-3">{waitingOrders.slice(0, 3).map(orderCard)}{openTickets.slice(0, 3).map((ticket) => <div key={`ticket-${ticket.id}`} className="rounded-2xl border border-white/10 bg-black/20 p-4"><div className="flex items-center justify-between gap-3"><p className="text-sm font-semibold text-white">{ticket.title}</p><Ticket className="h-4 w-4 text-orange-200" /></div><p className="mt-1 line-clamp-2 text-xs text-white/45">{ticket.description}</p><p className="mt-2 text-[11px] text-white/30">#{ticket.id} آ· {formatDate(ticket.updated_at || ticket.created_at)}</p></div>)}</div>}</section><section className="rounded-3xl border border-green-400/20 bg-gradient-to-br from-green-500/[0.08] to-transparent p-5"><div className="mb-4 flex items-center justify-between"><h2 className="flex items-center gap-2 text-lg font-semibold text-white"><CheckCircle2 className="h-5 w-5 text-green-200" />{t('workbench.completed', 'Completed')}</h2><span className="text-xs text-white/40">{completedOrders.length}</span></div>{completedOrders.length === 0 ? <p className="rounded-2xl border border-dashed border-white/10 p-5 text-center text-sm text-white/40">{t('workbench.no_completed', 'Completed work will appear here.')}</p> : <div className="space-y-3">{completedOrders.map(orderCard)}</div>}</section></div>

          <div className="mt-6 grid gap-4 md:grid-cols-2"><Link to="/clients" className="group rounded-2xl border border-gold/15 bg-gold/[0.06] p-4 transition hover:border-gold/35"><div className="flex items-center justify-between"><div className="flex items-center gap-2 text-sm font-semibold text-white"><UserRound aria-hidden="true" className="h-4 w-4 text-gold" />{t('workbench.open_clients', 'Open Client 360')}</div><ArrowRight className="h-4 w-4 text-gold transition-transform group-hover:translate-x-1" /></div><p className="mt-2 text-sm text-white/45">{t('workbench.open_clients_hint', 'Move from operational work to the client relationship context.')}</p></Link><Link to="/admin" className="group rounded-2xl border border-white/10 bg-white/[0.03] p-4 transition hover:border-gold/25"><div className="flex items-center justify-between"><div className="flex items-center gap-2 text-sm font-semibold text-white"><FolderOpen aria-hidden="true" className="h-4 w-4 text-gold" />{t('workbench.open_command_center', 'Open Command Center')}</div><ArrowRight className="h-4 w-4 text-gold transition-transform group-hover:translate-x-1" /></div><p className="mt-2 text-sm text-white/45">{t('workbench.open_command_hint', 'Return to the founder view for decisions and operational priority.')}</p></Link></div>
        </>}
      </div>
    </div>
  )
}

export default WorkbenchPage

