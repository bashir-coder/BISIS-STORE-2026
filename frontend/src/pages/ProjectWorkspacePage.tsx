import { ArrowLeft, CheckCircle2, Clock3, FileText, FolderOpen, ListChecks, MessageSquare, RefreshCw, ShieldAlert, Workflow } from 'lucide-react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useEffect, useMemo, useState } from 'react'
import { api } from '../utils/api-client'
import { useAuth } from '../contexts/AuthContext'
import OrderLifecycle from '../components/OrderLifecycle'

type Project = { id: number; name: string; description?: string; status: string; execution_state?: string | null; waiting_on?: string | null; state_updated_at?: string | null; created_at: string; updated_at: string }
type Order = { id?: string | number; submission_id?: string; package?: string; package_name?: string; service?: string; status?: string; amount?: number | string | null; price?: number | string | null; created_at?: string; updated_at?: string }
type Milestone = { id: number; title: string; description?: string; position: number; status: 'not_started' | 'in_progress' | 'completed' | 'blocked'; due_date?: string | null }
type Task = { id: number; title: string; description?: string; status: 'todo' | 'in_progress' | 'blocked' | 'done' | 'cancelled'; priority: 'low' | 'medium' | 'high' | 'urgent'; milestone_id?: number | null; due_at?: string | null; client_visible?: boolean }
type Activity = { id: string; event_type: string; entity_type: string; created_at: string; payload?: Record<string, unknown> }
type Requirement = { id: number; title: string; description: string; requirement_type: 'text' | 'file' | 'choice'; is_required: boolean; status: 'requested' | 'submitted' | 'needs_revision' | 'approved' | 'not_applicable'; response_value?: string | null; file_id?: string | null }
type Delivery = { id: number; status: string; notes: string; revision_reason?: string | null; revision_count: number; delivered_at?: string | null; approved_at?: string | null }
type DeliveryFile = { id: string; order_id: number; original_name: string; mime_type: string; byte_size: number; file_kind: string; created_at: string }
type NextAction = { type: string; priority: string; title: string; entity_id?: number }
type ExecutionData = { milestones: Milestone[]; tasks: Task[]; activity: Activity[] }
type Ticket = { id: number; title: string; description: string; status: string; project_id?: number | null; created_at: string; updated_at: string }

const ProjectWorkspacePage: React.FC = () => {
  const { id } = useParams<{ id: string }>()
  const { t, i18n } = useTranslation()
  const { user: authUser } = useAuth()
  const navigate = useNavigate()
  const [project, setProject] = useState<Project | null>(null)
  const [orders, setOrders] = useState<Order[]>([])
  const [execution, setExecution] = useState<ExecutionData | null>(null)
  const [nextActions, setNextActions] = useState<NextAction[]>([])
  const [requirements, setRequirements] = useState<Requirement[]>([])
  const [delivery, setDelivery] = useState<Delivery | null>(null)
  const [deliveryFiles, setDeliveryFiles] = useState<DeliveryFile[]>([])
  const [responseValues, setResponseValues] = useState<Record<number, string>>({})
  const [selectedFiles, setSelectedFiles] = useState<Record<number, File | null>>({})
  const [revisionReason, setRevisionReason] = useState('')
  const [showRevisionForm, setShowRevisionForm] = useState(false)
  const [busyKey, setBusyKey] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [supportTitle, setSupportTitle] = useState('')
  const [supportDescription, setSupportDescription] = useState('')
  const [supportTickets, setSupportTickets] = useState<Ticket[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [clientMode, setClientMode] = useState(true)
  const isClient = clientMode

  const loadProject = async () => {
    if (!id || !authUser) return
    setLoading(true)
    setError(null)
    try {
      const response = await api.get(`/api/service-delivery/projects/${id}/client-view`)
      const view = response.data?.data
      if (!view) throw new Error(t('projects.not_found'))
      const clientProjection = Boolean(view.order)
      setClientMode(clientProjection)
      setProject(view)
      setOrders(view.order ? [view.order] : [])
      setExecution({ milestones: view.milestones || [], tasks: view.tasks || [], activity: view.activity || [] })
      setNextActions(view.next_action ? [view.next_action] : [])
        setRequirements(view.requirements || [])
        setDelivery(view.delivery || null)
        setDeliveryFiles(view.delivery_files || [])
      if (clientProjection) {
        const ticketResponse = await api.get(`/api/tickets/my?project_id=${encodeURIComponent(id)}`)
        setSupportTickets(Array.isArray(ticketResponse.data) ? ticketResponse.data : [])
      } else {
        setSupportTickets([])
      }
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : t('projects.workspace_load_error'))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { void loadProject() }, [id, authUser?.id])

  const derivedProgress = useMemo(() => {
    if (execution?.tasks.length) {
      const visibleTasks = isClient ? execution.tasks.filter((task) => task.client_visible) : execution.tasks
      if (!visibleTasks.length) return { percent: null, stage: t('client.home.progress_not_available'), source: '' }
      const completed = visibleTasks.filter((task) => ['done', 'cancelled'].includes(task.status)).length
      const percent = Math.round((completed / visibleTasks.length) * 100)
      const activeMilestone = execution.milestones.find((milestone) => ['in_progress', 'blocked'].includes(milestone.status))
      return { percent, stage: activeMilestone?.title || (percent >= 100 ? t('projects.delivery_stage') : t('projects.execution_stage')), source: t('projects.execution_progress_source') }
    }
    if (orders.length === 0) return { percent: null, stage: t('projects.waiting_for_linked_order'), source: t('projects.order_progress_source') }
    const weight: Record<string, number> = { new: 25, processing: 60, completed: 100 }
    const percent = Math.round(orders.reduce((sum, order) => sum + (weight[(order.status || 'new').toLowerCase()] || 25), 0) / orders.length)
    const hasProcessing = orders.some((order) => (order.status || '').toLowerCase() === 'processing')
    const allCompleted = orders.every((order) => (order.status || '').toLowerCase() === 'completed')
    return { percent, stage: allCompleted ? t('projects.delivery_stage') : hasProcessing ? t('projects.execution_stage') : t('projects.intake_stage'), source: t('projects.order_progress_source') }
  }, [execution, orders, t, isClient])

  const locale = i18n.language === 'ar' ? 'ar-EG' : i18n.language === 'tr' ? 'tr-TR' : 'en-US'
  const formatDate = (value?: string | null) => value ? new Date(value).toLocaleDateString(locale, { dateStyle: 'medium' }) : '—'
  const formatEvent = (eventType: string) => t(`execution.event.${eventType}`, eventType.toLowerCase().replace(/_/g, ' '))
  const taskStatusLabel = (status: Task['status']) => t(`execution.task_status.${status}`, t('execution.task_status.unknown', 'Current step'))
  const taskPriorityLabel = (priority: Task['priority']) => t(`execution.priority.${priority}`, t('execution.priority.medium', 'Normal priority'))
  const milestoneStatusLabel = (status: Milestone['status']) => t(`execution.milestone_status.${status}`, t('execution.milestone_status.not_started', 'Not started'))
  const projectStateLabel = project?.execution_state ? t(`client.state.${project.execution_state}`, project.execution_state.replace(/_/g, ' ')) : t('client.state.not_started')

  const submitRequirement = async (requirement: Requirement) => {
    const value = responseValues[requirement.id]?.trim()
    if (requirement.requirement_type === 'file' ? !selectedFiles[requirement.id] : !value) return
    setBusyKey(`requirement-${requirement.id}`)
    setActionError(null)
    try {
      let fileId: string | undefined
      if (requirement.requirement_type === 'file') {
        const file = selectedFiles[requirement.id]
        const orderId = orders[0]?.id
        if (!file || !orderId) throw new Error('FILE_REQUIRED')
        const formData = new FormData()
        formData.append('file', file)
        const uploadResponse = await api.post(`/api/orders/${orderId}/upload`, formData, { headers: { 'Content-Type': 'multipart/form-data' } })
        fileId = uploadResponse.data?.file?.id
        if (!fileId) throw new Error('FILE_METADATA_MISSING')
      }
      await api.patch(`/api/service-delivery/projects/${id}/requirements/${requirement.id}`, { response_value: requirement.requirement_type === 'file' ? selectedFiles[requirement.id]?.name : value, ...(fileId ? { file_id: fileId } : {}) })
      setResponseValues((current) => ({ ...current, [requirement.id]: '' }))
      setSelectedFiles((current) => ({ ...current, [requirement.id]: null }))
      await loadProject()
    } catch {
      setActionError(t('client.requirements.submit_error'))
    } finally {
      setBusyKey(null)
    }
  }

  const approveDelivery = async () => {
    setBusyKey('approve')
    setActionError(null)
    try { await api.post(`/api/service-delivery/projects/${id}/delivery/approve`); await loadProject() } catch { setActionError(t('client.delivery.approve_error')) } finally { setBusyKey(null) }
  }

  const downloadFile = async (file: DeliveryFile) => {
    if (!file.order_id) return
    setBusyKey(`file-${file.id}`)
    setActionError(null)
    try {
      const response = await api.get(`/api/orders/${file.order_id}/files/${file.id}/download`)
      if (response.data?.url) window.open(response.data.url, '_blank', 'noopener,noreferrer')
    } catch {
      setActionError(t('client.delivery.file_error'))
    } finally {
      setBusyKey(null)
    }
  }

  const requestRevision = async () => {
    if (!revisionReason.trim()) return
    setBusyKey('revision')
    setActionError(null)
    try { await api.post(`/api/service-delivery/projects/${id}/delivery/revision`, { reason: revisionReason.trim() }); setRevisionReason(''); setShowRevisionForm(false); await loadProject() } catch { setActionError(t('client.delivery.revision_error')) } finally { setBusyKey(null) }
  }

  const createSupportTicket = async () => {
    if (!supportTitle.trim() || !supportDescription.trim() || !id) return
    setBusyKey('support')
    setActionError(null)
    try {
      const response = await api.post('/api/tickets', { title: supportTitle.trim(), description: supportDescription.trim(), project_id: Number(id) })
      if (response.data) setSupportTickets((current) => [response.data, ...current])
      setSupportTitle('')
      setSupportDescription('')
    } catch {
      setActionError(t('client.support.create_error', 'Unable to contact BİŞIŞ about this project.'))
    } finally {
      setBusyKey(null)
    }
  }

  return <div className="min-h-screen bg-transparent px-4 pb-20 pt-24 sm:px-6"><div className="mx-auto max-w-6xl">
    <div className="mb-6 flex flex-wrap items-center justify-between gap-3"><button type="button" onClick={() => navigate(-1)} className="inline-flex items-center gap-2 text-sm text-white/55 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/70"><ArrowLeft className="h-4 w-4" />{t('common.back')}</button><button type="button" onClick={() => void loadProject()} className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white/65 hover:bg-white/10"><RefreshCw className="h-4 w-4" />{t('dashboard.refresh')}</button></div>
    {loading ? <div className="animate-pulse space-y-4"><div className="h-40 rounded-3xl bg-white/5" /><div className="h-72 rounded-3xl bg-white/5" /></div> : error || !project ? <div role="alert" className="rounded-3xl border border-red-400/20 bg-red-500/10 p-8 text-center text-red-100"><ShieldAlert className="mx-auto mb-3 h-10 w-10" /><p>{error || t('projects.not_found')}</p><Link to={isClient ? '/dashboard' : '/admin'} className="mt-4 inline-flex rounded-lg border border-red-200/30 px-4 py-2 text-sm">{t('common.back_to_dashboard')}</Link></div> : <>
      <section className="rounded-3xl border border-gold/15 bg-gradient-to-br from-gold/[0.08] via-white/[0.03] to-transparent p-6"><div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between"><div><p className="text-sm uppercase tracking-[0.25em] text-gold/70">{isClient ? t('client.project.eyebrow') : t('projects.workspace')}</p><h1 className="mt-2 text-3xl font-bold text-white sm:text-4xl">{project.name}</h1><p className="mt-3 max-w-2xl text-sm leading-6 text-white/55">{project.description || t('projects.no_description')}</p><div className="mt-4 flex flex-wrap items-center gap-2 text-xs text-white/40"><span className="rounded-full border border-gold/20 bg-gold/10 px-3 py-1 text-gold/90">{isClient ? projectStateLabel : project.status}</span>{project.waiting_on && <span>{t('client.project.waiting_on')}: {t(`client.waiting_on.${project.waiting_on}`, project.waiting_on)}</span>}<span>{t('projects.updated_on')} {formatDate(project.state_updated_at || project.updated_at)}</span></div></div><div className="min-w-[220px] rounded-2xl border border-white/10 bg-black/20 p-4"><div className="flex items-center justify-between"><span className="text-sm text-white/50">{t('projects.derived_progress')}</span><span className="text-2xl font-bold text-gold">{derivedProgress.percent === null ? '—' : `${derivedProgress.percent}%`}</span></div>{derivedProgress.percent !== null && <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/10"><div className="h-full rounded-full bg-gradient-to-r from-gold-dark to-gold transition-all" style={{ width: `${derivedProgress.percent}%` }} /></div>}<p className="mt-2 text-xs text-white/40">{derivedProgress.stage}</p>{derivedProgress.source && <p className="mt-1 text-[11px] text-white/25">{derivedProgress.source}</p>}</div></div></section>

      {isClient && nextActions.length > 0 && <section className="mt-6 rounded-3xl border border-gold/20 bg-gold/[0.07] p-5"><p className="text-xs font-semibold uppercase tracking-[0.2em] text-gold/80">{t('client.action_center.eyebrow')}</p><h2 className="mt-2 text-xl font-semibold text-white">{nextActions[0].title}</h2><p className="mt-2 text-sm text-white/55">{t('client.action_center.subtitle')}</p></section>}

      {isClient && requirements.length > 0 && <section className="mt-6 rounded-3xl border border-white/10 bg-white/[0.03] p-5"><div className="mb-5 flex items-start justify-between gap-3"><div><h2 className="flex items-center gap-2 text-lg font-semibold text-white"><FileText className="h-5 w-5 text-gold" />{t('client.requirements.title')}</h2><p className="mt-1 text-sm text-white/45">{t('client.requirements.subtitle')}</p></div><span className="rounded-full border border-gold/20 bg-gold/10 px-3 py-1 text-xs text-gold">{requirements.filter((item) => ['submitted', 'approved', 'not_applicable'].includes(item.status)).length}/{requirements.length}</span></div><div className="space-y-3">{requirements.map((requirement) => { const complete = ['submitted', 'approved', 'not_applicable'].includes(requirement.status); const locked = ['approved', 'not_applicable'].includes(requirement.status); return <div key={requirement.id} className="rounded-2xl border border-white/10 bg-black/20 p-4"><div className="flex items-start gap-3"><div className="mt-0.5">{complete ? <CheckCircle2 className="h-5 w-5 text-emerald-300" /> : <Clock3 className="h-5 w-5 text-gold" />}</div><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><h3 className="font-semibold text-white">{requirement.title}</h3>{requirement.is_required && <span className="rounded-full border border-red-300/20 bg-red-400/10 px-2 py-0.5 text-[11px] text-red-100">{t('client.requirements.required')}</span>}<span className="text-xs text-white/40">{t(`client.requirements.status.${requirement.status}`, requirement.status)}</span></div><p className="mt-2 text-sm leading-6 text-white/55">{requirement.description || t('client.requirements.no_description')}</p>{!locked && <div className="mt-3 flex flex-col gap-2 sm:flex-row">{requirement.requirement_type === 'file' ? <input type="file" onChange={(event) => setSelectedFiles((current) => ({ ...current, [requirement.id]: event.target.files?.[0] || null }))} aria-label={requirement.title} className="min-w-0 flex-1 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white file:mr-3 file:rounded-md file:border-0 file:bg-gold file:px-3 file:py-1 file:text-xs file:font-semibold file:text-black" /> : <input value={responseValues[requirement.id] || ''} onChange={(event) => setResponseValues((current) => ({ ...current, [requirement.id]: event.target.value }))} placeholder={t('client.requirements.response_placeholder')} aria-label={requirement.title} className="min-w-0 flex-1 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none placeholder:text-white/30 focus:border-gold/40" />}<button type="button" disabled={busyKey === `requirement-${requirement.id}` || (requirement.requirement_type === 'file' ? !selectedFiles[requirement.id] : !responseValues[requirement.id]?.trim())} onClick={() => void submitRequirement(requirement)} className="rounded-xl bg-gold px-4 py-2 text-sm font-semibold text-black disabled:cursor-not-allowed disabled:opacity-50">{busyKey === `requirement-${requirement.id}` ? t('client.requirements.submitting') : t('client.requirements.submit')}</button></div>}</div></div></div> })}</div></section>}
      {isClient && requirements.length === 0 && <section className="mt-6 rounded-3xl border border-white/10 bg-white/[0.03] p-5"><h2 className="flex items-center gap-2 text-lg font-semibold text-white"><FileText className="h-5 w-5 text-gold" />{t('client.requirements.title')}</h2><p className="mt-3 rounded-2xl border border-dashed border-white/10 p-6 text-sm text-white/50">{t('client.requirements.empty')}</p></section>}

      {isClient && delivery && <section className="mt-6 rounded-3xl border border-cyan-300/15 bg-cyan-400/[0.05] p-5"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-xs uppercase tracking-[0.2em] text-cyan-200/70">{t('client.delivery.eyebrow')}</p><h2 className="mt-2 text-2xl font-semibold text-white">{t(`client.delivery.status.${delivery.status}`, delivery.status)}</h2><p className="mt-2 max-w-2xl text-sm leading-6 text-white/55">{delivery.notes || t('client.delivery.no_notes')}</p></div>{delivery.delivered_at && <span className="text-xs text-white/40">{formatDate(delivery.delivered_at)}</span>}</div>{deliveryFiles.length > 0 && <div className="mt-5 space-y-2"><p className="text-xs uppercase tracking-[0.16em] text-white/40">{t('client.delivery.files')}</p>{deliveryFiles.map((file) => <button key={file.id} type="button" onClick={() => void downloadFile(file)} disabled={busyKey === `file-${file.id}`} className="flex w-full items-center justify-between gap-3 rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-start text-sm text-white/75 hover:border-gold/25 disabled:opacity-50"><span className="min-w-0 truncate">{file.original_name}</span><span className="shrink-0 text-xs text-gold">{busyKey === `file-${file.id}` ? t('client.delivery.working') : t('client.delivery.download')}</span></button>)}</div>}{['client_review', 'delivered'].includes(delivery.status) && <div className="mt-5 flex flex-col gap-3 sm:flex-row"><button type="button" disabled={busyKey === 'approve'} onClick={() => void approveDelivery()} className="rounded-xl bg-emerald-300 px-4 py-2.5 text-sm font-semibold text-black disabled:opacity-50">{busyKey === 'approve' ? t('client.delivery.working') : t('client.delivery.approve')}</button><button type="button" onClick={() => setShowRevisionForm((value) => !value)} className="rounded-xl border border-white/15 px-4 py-2.5 text-sm text-white/80 hover:bg-white/10">{t('client.delivery.request_revision')}</button></div>}{showRevisionForm && <div className="mt-4 flex flex-col gap-3 rounded-2xl border border-white/10 bg-black/20 p-4"><textarea value={revisionReason} onChange={(event) => setRevisionReason(event.target.value)} placeholder={t('client.delivery.revision_placeholder')} rows={3} className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none placeholder:text-white/30 focus:border-gold/40" /><button type="button" disabled={!revisionReason.trim() || busyKey === 'revision'} onClick={() => void requestRevision()} className="self-start rounded-xl bg-gold px-4 py-2 text-sm font-semibold text-black disabled:opacity-50">{busyKey === 'revision' ? t('client.delivery.working') : t('client.delivery.send_revision')}</button></div>}</section>}

      {actionError && <div role="alert" className="mt-4 rounded-2xl border border-red-300/20 bg-red-400/10 px-4 py-3 text-sm text-red-100">{actionError}</div>}

      {isClient && <section className="mt-6 rounded-3xl border border-gold/15 bg-gold/[0.04] p-5"><div className="mb-4 flex items-start gap-3"><MessageSquare className="mt-0.5 h-5 w-5 text-gold" /><div><h2 className="text-lg font-semibold text-white">{t('client.support.title', 'Contact BİŞIŞ about this project')}</h2><p className="mt-1 text-sm text-white/45">{t('client.support.subtitle', 'Keep your question connected to the current project so the team has the right context.')}</p></div></div><div className="grid gap-2 md:grid-cols-2"><input value={supportTitle} onChange={(event) => setSupportTitle(event.target.value)} placeholder={String(t('client.support.title_placeholder', 'What do you need help with?'))} className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none placeholder:text-white/30 focus:border-gold/40" /><textarea value={supportDescription} onChange={(event) => setSupportDescription(event.target.value)} placeholder={String(t('client.support.description_placeholder', 'Describe the issue or question.'))} rows={2} className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none placeholder:text-white/30 focus:border-gold/40 md:col-span-2" /><button type="button" disabled={busyKey === 'support' || !supportTitle.trim() || !supportDescription.trim()} onClick={() => void createSupportTicket()} className="w-fit rounded-xl bg-gold px-4 py-2.5 text-sm font-semibold text-black disabled:opacity-50">{busyKey === 'support' ? t('client.support.sending', 'Sending...') : t('client.support.send', 'Send to BİŞIŞ')}</button></div>{supportTickets.length > 0 && <div className="mt-5 space-y-2"><p className="text-xs uppercase tracking-[0.16em] text-white/40">{t('client.support.previous', 'Project support history')}</p>{supportTickets.map((ticket) => <div key={ticket.id} className="rounded-xl border border-white/10 bg-black/20 px-3 py-2"><div className="flex flex-wrap items-center justify-between gap-2"><p className="text-sm text-white/80">{ticket.title}</p><span className="text-xs text-gold/75">{t(`tickets.status.${ticket.status}`, ticket.status)}</span></div><p className="mt-1 text-xs text-white/40">{ticket.description}</p></div>)}</div>}</section>}

      <div className="mt-6 grid gap-6 xl:grid-cols-[1.3fr_0.7fr]"><section className="rounded-3xl border border-white/10 bg-white/[0.03] p-5"><div className="mb-4 flex items-center justify-between"><div><h2 className="flex items-center gap-2 text-lg font-semibold text-white"><Workflow className="h-5 w-5 text-gold" />{isClient ? t('client.project.current_work') : t('execution.structure')}</h2><p className="mt-1 text-sm text-white/45">{isClient ? t('client.project.current_work_hint') : t('execution.structure_hint')}</p></div></div>{!execution ? <div className="rounded-2xl border border-dashed border-white/10 p-7 text-center"><ListChecks className="mx-auto mb-3 h-9 w-9 text-white/25" /><p className="text-sm text-white/60">{t('execution.not_initialized')}</p></div> : <div className="space-y-4">{execution.milestones.length === 0 ? <div className="rounded-2xl border border-dashed border-white/10 p-7 text-center"><p className="text-sm text-white/50">{t('execution.no_milestones')}</p></div> : execution.milestones.map((milestone) => <div key={milestone.id} className="rounded-2xl border border-white/10 bg-black/20 p-4"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-sm font-semibold text-white">{milestone.position + 1}. {milestone.title}</p><p className="mt-1 text-xs text-white/40">{milestoneStatusLabel(milestone.status)}{milestone.due_date ? ` آ· ${formatDate(milestone.due_date)}` : ''}</p></div><span className="rounded-full border border-white/10 px-2 py-1 text-[11px] text-white/50">{execution.tasks.filter((task) => task.milestone_id === milestone.id).length} {t('execution.tasks')}</span></div><div className="mt-3 space-y-2">{execution.tasks.filter((task) => task.milestone_id === milestone.id).map((task) => <div key={task.id} className="flex items-center justify-between gap-3 rounded-xl border border-white/5 bg-white/[0.03] px-3 py-2"><div className="min-w-0"><p className="truncate text-sm text-white/80">{task.title}</p><p className="mt-1 text-[11px] text-white/35">{taskStatusLabel(task.status)} آ· {taskPriorityLabel(task.priority)}</p></div>{task.status === 'done' ? <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-300" /> : <Clock3 className="h-4 w-4 shrink-0 text-gold/70" />}</div>)}</div></div>)}</div>}</section>

        <div className="space-y-6"><section className="rounded-3xl border border-gold/15 bg-gold/[0.06] p-5"><div className="flex items-center gap-2 text-sm font-semibold text-white"><CheckCircle2 className="h-4 w-4 text-gold" />{t('projects.next_action')}</div>{nextActions.length === 0 ? <p className="mt-2 text-sm leading-6 text-white/55">{t('client.project.no_next_action')}</p> : <div className="mt-3 space-y-2">{nextActions.slice(0, 4).map((action) => <div key={`${action.type}-${action.entity_id || 'project'}`} className="rounded-xl border border-white/10 bg-black/15 px-3 py-2"><p className="text-sm text-white/80">{action.title}</p><p className="mt-1 text-[11px] uppercase tracking-wide text-gold/65">{t(`execution.priority.${action.priority}`, t('execution.priority.medium', 'Normal priority'))}</p></div>)}</div>}</section>

          <section className="rounded-3xl border border-white/10 bg-white/[0.03] p-5"><h2 className="mb-4 text-lg font-semibold text-white">{isClient ? t('client.project.timeline') : t('execution.activity')}</h2>{execution?.activity.length ? <div className="space-y-3">{execution.activity.slice(0, 8).map((item) => <div key={item.id} className="border-s border-gold/40 ps-3"><p className="text-sm text-white/75">{formatEvent(item.event_type)}</p><p className="mt-1 text-xs text-white/35">{formatDate(item.created_at)}</p></div>)}</div> : <p className="text-sm text-white/45">{t('execution.no_activity')}</p>}</section></div>
      </div>

      <section className="mt-6 rounded-3xl border border-white/10 bg-white/[0.03] p-5"><div className="mb-4 flex items-center justify-between"><div><h2 className="flex items-center gap-2 text-lg font-semibold text-white"><FolderOpen className="h-5 w-5 text-gold" />{t('projects.order_context')}</h2><p className="mt-1 text-sm text-white/45">{t('client.project.order_context_hint')}</p></div><span className="text-xs text-white/35">{orders.length}</span></div>{orders.length === 0 ? <div className="rounded-2xl border border-dashed border-white/10 p-8 text-center"><Clock3 className="mx-auto mb-3 h-9 w-9 text-white/25" /><p className="text-sm text-white/60">{t('projects.no_linked_orders')}</p></div> : <div className="space-y-3">{orders.map((order) => <div key={order.id} className="rounded-2xl border border-white/10 bg-black/20 p-4"><div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-sm font-semibold text-white">#{String(order.submission_id || order.id || '').slice(0, 8)}</p><p className="mt-1 text-xs text-white/40">{order.service || order.package || order.package_name || t('dashboard.package')} آ· {formatDate(order.updated_at || order.created_at)}</p></div><span className="text-sm font-semibold text-gold">${Number(order.amount ?? order.price ?? 0).toFixed(2)}</span></div><div className="mt-4"><OrderLifecycle status={order.status} /></div></div>)}</div>}</section>
    </>}
  </div></div>
}

export default ProjectWorkspacePage

