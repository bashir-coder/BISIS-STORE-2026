import { useEffect, useMemo, useRef, useState } from 'react'
import { AlertCircle, Clock3, Mail, RefreshCw, Search, Ticket, UserRound } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { api } from '../utils/api-client'
import OrderLifecycle from '../components/OrderLifecycle'

type Client = {
  id: string
  full_name?: string | null
  email?: string | null
  avatar?: string | null
  role: string
  is_active?: boolean
  is_verified?: boolean
  workspace_id?: string | null
  created_at?: string
  updated_at?: string
}

type Order = {
  id?: string
  user_id?: string | null
  project_id?: number | null
  submission_id?: string
  package?: string
  package_name?: string
  status?: string
  created_at?: string
  updated_at?: string
  amount?: number | string | null
  price?: number | string | null
}

type Project = {
  id: number
  name: string
  description?: string
  status: string
  created_by: string
  created_at: string
  updated_at: string
  execution_state?: string | null
  waiting_on?: string | null
}

type TicketRecord = {
  id: number
  user_id: string
  title: string
  description: string
  status: string
  created_at: string
  updated_at?: string
  project_id?: number | null
}

type ClientProjectOverview = {
  id: number
  name: string
  execution_state?: string | null
  waiting_on?: string | null
  order?: Order | null
  requirements: { total: number; required: number; submitted: number; pending: number; needs_revision: number }
  execution: { milestones: number; completed_milestones: number; tasks: number; completed_tasks: number; client_visible_tasks: number }
  delivery?: { status: string; revision_count: number; updated_at?: string | null } | null
  files: { total: number; customer_inputs: number; deliveries: number; latest?: { id: string; original_name: string; file_kind: string } | null }
  activity: { total: number; client_visible: number; internal: number; latest?: { id: string; event_type: string; visibility: string } | null }
  tickets: { total: number; open: number; latest?: { id: number; title: string; status: string } | null }
}

type ClientOverview = {
  projects: ClientProjectOverview[]
  totals: { orders: number; projects: number; open_tickets: number }
}

const Client360Page: React.FC = () => {
  const { t, i18n } = useTranslation()
  const [clients, setClients] = useState<Client[]>([])
  const [orders, setOrders] = useState<Order[]>([])
  const [projects, setProjects] = useState<Project[]>([])
  const [tickets, setTickets] = useState<TicketRecord[]>([])
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null)
  const [overview, setOverview] = useState<ClientOverview | null>(null)
  const [overviewLoading, setOverviewLoading] = useState(false)
  const [overviewError, setOverviewError] = useState<string | null>(null)
  const overviewRequestRef = useRef(0)
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const loadData = async () => {
    setLoading(true)
    setError(null)
    try {
      const [clientsResponse, ordersResponse, projectsResponse, ticketsResponse] = await Promise.all([
        api.get('/api/users'),
        api.get('/api/orders'),
        api.get('/api/projects'),
        api.get('/api/tickets'),
      ])
      setClients(Array.isArray(clientsResponse.data) ? clientsResponse.data : [])
      const ordersData = ordersResponse.data?.data || ordersResponse.data
      setOrders(Array.isArray(ordersData) ? ordersData : [])
      setProjects(Array.isArray(projectsResponse.data) ? projectsResponse.data : [])
      setTickets(Array.isArray(ticketsResponse.data) ? ticketsResponse.data : [])
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : t('clients.load_error', 'Unable to load client operations.'))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { void loadData() }, [])

  const loadOverview = async (clientId: string) => {
    const requestId = overviewRequestRef.current + 1
    overviewRequestRef.current = requestId
    setOverviewLoading(true)
    setOverviewError(null)
    try {
      const response = await api.get(`/api/service-delivery/clients/${clientId}/overview`)
      if (requestId !== overviewRequestRef.current) return
      setOverview(response.data?.data || null)
    } catch (loadError) {
      if (requestId !== overviewRequestRef.current) return
      setOverview(null)
      setOverviewError(loadError instanceof Error ? loadError.message : t('clients.overview_error', 'Unable to load the selected client overview.'))
    } finally {
      if (requestId === overviewRequestRef.current) setOverviewLoading(false)
    }
  }

  const filteredClients = useMemo(() => {
    const query = search.trim().toLowerCase()
    if (!query) return clients
    return clients.filter((client) => `${client.full_name || ''} ${client.email || ''}`.toLowerCase().includes(query))
  }, [clients, search])

  const selectedClient = clients.find((client) => client.id === selectedClientId) || filteredClients[0] || null
  useEffect(() => {
    if (!selectedClient?.id) {
      setOverview(null)
      setOverviewError(null)
      return
    }
    void loadOverview(selectedClient.id)
  }, [selectedClient?.id])

  const clientOrders = selectedClient ? orders.filter((order) => order.user_id === selectedClient.id) : []
  const clientTickets = selectedClient ? tickets.filter((ticket) => ticket.user_id === selectedClient.id) : []
  const clientProjectIds = new Set(clientOrders.map((order) => order.project_id).filter(Boolean))
  const clientProjects = projects.filter((project) => clientProjectIds.has(project.id) || project.created_by === selectedClient?.id)
  const activeOrders = clientOrders.filter((order) => ['new', 'processing'].includes((order.status || 'new').toLowerCase()))
  const openTickets = clientTickets.filter((ticket) => ['open', 'in_progress'].includes(ticket.status))
  const overviewProjects = overview?.projects || []
  const locale = i18n.language === 'ar' ? 'ar-EG' : i18n.language === 'tr' ? 'tr-TR' : 'en-US'
  const formatDate = (value?: string) => value ? new Date(value).toLocaleDateString(locale, { dateStyle: 'medium' }) : '—'
  const projectStateLabel = (state?: string | null) => state ? t(`client.state.${state}`, state.replace(/_/g, ' ')) : t('client.state.not_started')
  const waitingOnLabel = (waitingOn?: string | null) => waitingOn ? t(`client.waiting_on.${waitingOn}`, waitingOn.replace(/_/g, ' ')) : ''

  return (
    <div className="min-h-screen bg-transparent px-4 pb-20 pt-24 sm:px-6">
      <div className="mx-auto max-w-7xl">
        <div className="mb-8 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-sm uppercase tracking-[0.3em] text-gold/70">{t('clients.eyebrow', 'Relationship intelligence')}</p>
            <h1 className="mt-2 text-3xl font-bold text-white sm:text-4xl">{t('clients.title', 'Client 360')}</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-white/50">{t('clients.subtitle', 'Understand each client relationship through the real orders, projects, and support records already in BİŞIŞ.')}</p>
          </div>
          <button type="button" onClick={() => void loadData()} className="inline-flex items-center justify-center gap-2 rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-sm text-white/70 transition hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/70"><RefreshCw className="h-4 w-4" />{t('dashboard.refresh')}</button>
        </div>

        {error && <div role="alert" className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-red-400/20 bg-red-500/10 p-4 text-sm text-red-200"><span>{error}</span><button type="button" onClick={() => void loadData()} className="rounded-lg border border-red-300/30 px-3 py-1.5">{t('dashboard.retry')}</button></div>}

        {loading ? (
          <div className="grid gap-4 lg:grid-cols-[0.8fr_1.2fr] animate-pulse"><div className="h-[520px] rounded-3xl bg-white/5" /><div className="h-[520px] rounded-3xl bg-white/5" /></div>
        ) : (
          <div className="grid gap-6 lg:grid-cols-[0.8fr_1.2fr]">
            <section className="glass rounded-3xl border-gold/10 p-5">
              <div className="mb-4 flex items-center justify-between"><h2 className="text-lg font-semibold text-white">{t('clients.directory', 'Clients')}</h2><span className="rounded-full bg-gold/10 px-2.5 py-1 text-xs text-gold">{filteredClients.length}</span></div>
              <label className="mb-4 flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2"><Search aria-hidden="true" className="h-4 w-4 text-white/40" /><span className="sr-only">{t('clients.search', 'Search clients')}</span><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder={t('clients.search_placeholder', 'Search name or email')} className="w-full bg-transparent text-sm text-white outline-none placeholder:text-white/30" /></label>
              {filteredClients.length === 0 ? <div className="rounded-2xl border border-dashed border-white/10 p-8 text-center"><UserRound className="mx-auto mb-3 h-10 w-10 text-white/25" /><p className="text-sm text-white/60">{search ? t('clients.no_match', 'No clients match this search.') : t('clients.empty', 'Clients will appear here after they interact with BİŞIŞ.')}</p></div> : <div className="space-y-2">{filteredClients.map((client) => { const count = orders.filter((order) => order.user_id === client.id).length; return <button key={client.id} type="button" onClick={() => setSelectedClientId(client.id)} className={`group w-full rounded-2xl border p-3 text-start transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/70 ${selectedClient?.id === client.id ? 'border-gold/40 bg-gold/10' : 'border-white/10 bg-black/20 hover:border-gold/20'}`}><div className="flex items-center gap-3"><div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-gold/30 to-white/10 text-sm font-semibold text-gold">{(client.full_name || client.email || '?').slice(0, 1).toUpperCase()}</div><div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold text-white">{client.full_name || t('dashboard.anonymous')}</p><p className="truncate text-xs text-white/40">{client.email || '—'}</p></div><span className="text-xs text-white/35">{count} {t('clients.orders_short', 'orders')}</span></div></button> })}</div>}
            </section>

            <section className="glass rounded-3xl border-gold/10 p-5 sm:p-6">
              {!selectedClient ? <div className="flex min-h-[460px] flex-col items-center justify-center text-center"><UserRound className="mb-4 h-14 w-14 text-white/20" /><h2 className="text-xl font-semibold text-white">{t('clients.select_title', 'Select a client')}</h2><p className="mt-2 max-w-sm text-sm text-white/45">{t('clients.select_description', 'Choose a client to see their relationship context, active work, and pending attention.')}</p></div> : <>
                <div className="flex flex-col gap-4 border-b border-white/10 pb-5 sm:flex-row sm:items-center sm:justify-between"><div className="flex items-center gap-3"><div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-gold/35 to-white/10 text-xl font-bold text-gold">{(selectedClient.full_name || selectedClient.email || '?').slice(0, 1).toUpperCase()}</div><div><p className="text-xs uppercase tracking-[0.2em] text-gold/70">{t('clients.profile', 'Client profile')}</p><h2 className="mt-1 text-2xl font-bold text-white">{selectedClient.full_name || t('dashboard.anonymous')}</h2><p className="mt-1 flex items-center gap-2 text-sm text-white/45"><Mail className="h-3.5 w-3.5" />{selectedClient.email || '—'}</p></div></div><span className={`rounded-full border px-3 py-1 text-xs ${selectedClient.is_active === false ? 'border-red-400/30 bg-red-500/10 text-red-200' : 'border-green-400/30 bg-green-500/10 text-green-200'}`}>{selectedClient.is_active === false ? t('clients.inactive', 'Inactive') : t('clients.active', 'Active')}</span></div>

                <div className="mt-5 grid gap-3 sm:grid-cols-4"><div className="rounded-2xl border border-white/10 bg-white/5 p-3"><p className="text-xs text-white/40">{t('clients.total_orders', 'Orders')}</p><p className="mt-2 text-2xl font-bold text-white">{overview?.totals.orders ?? clientOrders.length}</p></div><div className="rounded-2xl border border-white/10 bg-white/5 p-3"><p className="text-xs text-white/40">{t('clients.active_work', 'Active work')}</p><p className="mt-2 text-2xl font-bold text-yellow-200">{activeOrders.length + clientProjects.filter((project) => project.status === 'active').length}</p></div><div className="rounded-2xl border border-white/10 bg-white/5 p-3"><p className="text-xs text-white/40">{t('clients.projects', 'Projects')}</p><p className="mt-2 text-2xl font-bold text-white">{overview?.totals.projects ?? clientProjects.length}</p></div><div className="rounded-2xl border border-white/10 bg-white/5 p-3"><p className="text-xs text-white/40">{t('clients.open_tickets', 'Open tickets')}</p><p className="mt-2 text-2xl font-bold text-red-200">{overview?.totals.open_tickets ?? openTickets.length}</p></div></div>

                {overviewLoading && <div className="mt-6 rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-white/45" role="status">{t('clients.overview_loading', 'Loading operational project detailâ€¦')}</div>}
                {overviewError && <div className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-red-400/20 bg-red-500/10 p-4 text-sm text-red-200" role="alert"><span>{overviewError}</span><button type="button" onClick={() => selectedClient && void loadOverview(selectedClient.id)} className="rounded-lg border border-red-300/30 px-3 py-1.5">{t('dashboard.retry')}</button></div>}
                {!overviewLoading && !overviewError && overviewProjects.length > 0 && <section className="mt-6 rounded-2xl border border-gold/10 bg-white/[0.03] p-4"><div className="mb-4 flex items-center justify-between gap-3"><div><h3 className="text-sm font-semibold text-white">{t('clients.project_operations', 'Project operations')}</h3><p className="mt-1 text-xs text-white/40">{t('clients.project_operations_hint', 'A batched view of requirements, execution, delivery, and support context.')}</p></div><span className="text-xs text-white/35">{overviewProjects.length}</span></div><div className="grid gap-3 xl:grid-cols-2">{overviewProjects.map((project) => <article key={project.id} className="rounded-2xl border border-white/10 bg-black/20 p-4"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><Link to={`/projects/${project.id}`} className="truncate text-sm font-semibold text-white hover:text-gold">{project.name}</Link><p className="mt-1 text-xs text-gold/80">{projectStateLabel(project.execution_state)}{project.waiting_on ? ` آ· ${t('client.project.waiting_on')} ${waitingOnLabel(project.waiting_on)}` : ''}</p></div>{project.delivery && <span className="shrink-0 rounded-full border border-blue-300/20 bg-blue-400/10 px-2 py-1 text-[10px] text-blue-100">{t(`client.delivery.status.${project.delivery.status}`, project.delivery.status.replace(/_/g, ' '))}</span>}</div><div className="mt-4 grid grid-cols-2 gap-2 text-xs"><div className="rounded-xl bg-white/5 p-2"><p className="text-white/35">{t('clients.requirements_short', 'Requirements')}</p><p className="mt-1 font-semibold text-white">{project.requirements.submitted}/{project.requirements.total}</p><p className="mt-0.5 text-white/35">{project.requirements.pending} {t('clients.pending_short', 'pending')}</p></div><div className="rounded-xl bg-white/5 p-2"><p className="text-white/35">{t('clients.execution_short', 'Execution')}</p><p className="mt-1 font-semibold text-white">{project.execution.completed_tasks}/{project.execution.tasks}</p><p className="mt-0.5 text-white/35">{t('clients.tasks_short', 'tasks')}</p></div><div className="rounded-xl bg-white/5 p-2"><p className="text-white/35">{t('clients.delivery_short', 'Delivery')}</p><p className="mt-1 font-semibold text-white">{project.delivery?.revision_count || 0}</p><p className="mt-0.5 text-white/35">{t('clients.revisions_short', 'revisions')}</p></div><div className="rounded-xl bg-white/5 p-2"><p className="text-white/35">{t('clients.support_short', 'Support')}</p><p className="mt-1 font-semibold text-white">{project.tickets.open}</p><p className="mt-0.5 text-white/35">{t('clients.open_short', 'open')}</p></div><div className="rounded-xl bg-white/5 p-2"><p className="text-white/35">{t('clients.files_short', 'Files')}</p><p className="mt-1 font-semibold text-white">{project.files.total}</p><p className="mt-0.5 text-white/35">{project.files.deliveries} {t('clients.deliveries_short', 'deliveries')}</p></div><div className="rounded-xl bg-white/5 p-2"><p className="text-white/35">{t('clients.activity_short', 'Activity')}</p><p className="mt-1 font-semibold text-white">{project.activity.total}</p><p className="mt-0.5 text-white/35">{project.activity.client_visible} {t('clients.visible_short', 'visible')}</p></div></div>{project.tickets.latest && <p className="mt-3 truncate text-xs text-white/45">{t('clients.latest_ticket', 'Latest ticket')}: {project.tickets.latest.title}</p>}</article>)}</div></section>}

                <div className="mt-6 grid gap-6 xl:grid-cols-2"><div><div className="mb-3 flex items-center justify-between"><h3 className="flex items-center gap-2 text-sm font-semibold text-white"><Clock3 className="h-4 w-4 text-gold" />{t('clients.orders', 'Orders')}</h3><span className="text-xs text-white/35">{t('clients.latest_context', 'Latest context')}</span></div>{clientOrders.length === 0 ? <p className="rounded-2xl border border-dashed border-white/10 p-5 text-sm text-white/40">{t('clients.no_orders', 'No orders for this client yet.')}</p> : <div className="space-y-3">{clientOrders.slice(0, 4).map((order) => <div key={order.id} className="rounded-2xl border border-white/10 bg-black/20 p-3"><div className="flex items-center justify-between gap-3"><div><p className="text-sm font-semibold text-white">#{String(order.submission_id || order.id || '').slice(0, 8)}</p><p className="mt-1 text-xs text-white/40">{order.package || order.package_name || t('dashboard.package')} آ· {formatDate(order.updated_at || order.created_at)}</p>{order.project_id && <Link to={`/projects/${order.project_id}`} className="mt-2 inline-flex text-xs text-gold hover:underline">{t('workbench.open_project')}</Link>}</div><span className="text-sm font-semibold text-gold">${Number(order.amount ?? order.price ?? 0).toFixed(2)}</span></div><div className="mt-3"><OrderLifecycle status={order.status} compact />{order.project_id && <p className="mt-2 text-xs text-white/45">{projectStateLabel(clientProjects.find((project) => project.id === order.project_id)?.execution_state)}{clientProjects.find((project) => project.id === order.project_id)?.waiting_on ? ` آ· ${t('client.project.waiting_on')} ${waitingOnLabel(clientProjects.find((project) => project.id === order.project_id)?.waiting_on)}` : ''}</p>}</div></div>)}</div>}</div><div><div className="mb-3 flex items-center justify-between"><h3 className="flex items-center gap-2 text-sm font-semibold text-white"><Ticket className="h-4 w-4 text-gold" />{t('clients.tickets', 'Support')}</h3><span className="text-xs text-white/35">{openTickets.length} {t('clients.open', 'open')}</span></div>{clientTickets.length === 0 ? <p className="rounded-2xl border border-dashed border-white/10 p-5 text-sm text-white/40">{t('clients.no_tickets', 'No support issues right now.')}</p> : <div className="space-y-2">{clientTickets.slice(0, 4).map((ticket) => <div key={ticket.id} className="rounded-2xl border border-white/10 bg-black/20 p-3"><div className="flex items-center justify-between gap-3"><p className="text-sm font-semibold text-white">{ticket.title}</p><span className={`rounded-full border px-2 py-0.5 text-[10px] ${openTickets.some((item) => item.id === ticket.id) ? 'border-red-400/30 bg-red-500/10 text-red-200' : 'border-green-400/30 bg-green-500/10 text-green-200'}`}>{ticket.status}</span></div><p className="mt-1 line-clamp-2 text-xs text-white/45">{ticket.description}</p><p className="mt-2 text-[11px] text-white/30">{formatDate(ticket.updated_at || ticket.created_at)}</p></div>)}</div>}</div></div>

                <div className="mt-6 rounded-2xl border border-gold/15 bg-gold/[0.06] p-4"><div className="flex items-center gap-2 text-sm font-semibold text-white"><AlertCircle className="h-4 w-4 text-gold" />{t('clients.next_action', 'Next action')}</div><p className="mt-2 text-sm leading-6 text-white/60">{openTickets.length > 0 ? t('clients.next_ticket_action', 'Review the open support ticket and respond when ready.') : activeOrders.length > 0 ? t('clients.next_order_action', 'Keep the active order moving and update its status when the next step is complete.') : t('clients.next_quiet_action', 'No pending action is visible from the current records.')}</p></div>
              </>}
            </section>
          </div>
        )}
      </div>
    </div>
  )
}

export default Client360Page

