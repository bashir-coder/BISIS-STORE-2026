import { useEffect, useMemo, useState } from 'react'
import { Archive, Check, Copy, Edit3, Plus, RefreshCw, RotateCcw, Save, Trash2, X } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { api } from '../utils/api-client'

type Service = { id: number; name: string }
type TemplateTask = { id: number; title: string; description?: string; priority: string; position: number; client_visible: boolean }
type TemplateMilestone = { id: number; title: string; description?: string; position: number; project_template_tasks?: TemplateTask[] }
type Template = { id: number; name: string; description?: string; service_id?: number | null; is_active: boolean; project_template_milestones?: TemplateMilestone[] }
type TemplateForm = { name: string; description: string; service_id: string }
type MilestoneForm = { title: string; description: string }
type TaskForm = { title: string; description: string; priority: string; client_visible: boolean }

const emptyTemplate: TemplateForm = { name: '', description: '', service_id: '' }
const emptyMilestone: MilestoneForm = { title: '', description: '' }
const emptyTask: TaskForm = { title: '', description: '', priority: 'medium', client_visible: false }
const priorities = ['low', 'medium', 'high', 'urgent']

export default function AdminTemplateManager() {
  const { t } = useTranslation()
  const [templates, setTemplates] = useState<Template[]>([])
  const [services, setServices] = useState<Service[]>([])
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [templateForm, setTemplateForm] = useState<TemplateForm>(emptyTemplate)
  const [milestoneForm, setMilestoneForm] = useState<MilestoneForm>(emptyMilestone)
  const [taskForms, setTaskForms] = useState<Record<number, TaskForm>>({})
  const [editingTemplate, setEditingTemplate] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)

  const selected = useMemo(() => templates.find((item) => item.id === selectedId) || null, [templates, selectedId])

  const load = async () => {
    setLoading(true)
    setError(null)
    try {
      const [templateResponse, serviceResponse] = await Promise.all([
        api.get('/api/execution/templates?include_archived=true'),
        api.get('/api/services/admin'),
      ])
      const nextTemplates = Array.isArray(templateResponse.data?.data) ? templateResponse.data.data : []
      setTemplates(nextTemplates)
      setServices(Array.isArray(serviceResponse.data) ? serviceResponse.data : [])
      setSelectedId((current) => current && nextTemplates.some((item: Template) => item.id === current) ? current : nextTemplates[0]?.id || null)
    } catch (err) {
      console.error('Template manager loading failed:', err)
      setError(String(t('admin.catalog_error', 'Unable to load templates')))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { void load() }, [])

  useEffect(() => {
    if (!selected) return
    setTemplateForm({ name: selected.name, description: selected.description || '', service_id: selected.service_id ? String(selected.service_id) : '' })
    setEditingTemplate(false)
  }, [selected?.id])

  const resetForms = () => {
    setTemplateForm(emptyTemplate)
    setMilestoneForm(emptyMilestone)
    setTaskForms({})
    setEditingTemplate(false)
  }

  const saveTemplate = async () => {
    if (!templateForm.name.trim()) {
      setError(String(t('admin.template_name_required', 'Template name is required')))
      return
    }
    setSaving(true)
    setError(null)
    setMessage(null)
    try {
      const payload = { name: templateForm.name, description: templateForm.description, service_id: templateForm.service_id || null }
      if (selected && editingTemplate) {
        await api.patch(`/api/execution/templates/${selected.id}`, payload)
      } else {
        const response = await api.post('/api/execution/templates', { ...payload, milestones: [] })
        if (response.data?.data?.id) setSelectedId(Number(response.data.data.id))
      }
      setMessage(String(t('admin.template_saved', 'Template saved')))
      setEditingTemplate(false)
      await load()
    } catch (err) {
      console.error('Template save failed:', err)
      setError(String(t('admin.catalog_error', 'Unable to save template')))
    } finally {
      setSaving(false)
    }
  }

  const setActive = async (template: Template, isActive: boolean) => {
    setError(null)
    try {
      await api.patch(`/api/execution/templates/${template.id}`, { is_active: isActive })
      setMessage(String(t('admin.template_saved', 'Template saved')))
      await load()
    } catch (err) {
      console.error('Template activation failed:', err)
      setError(String(t('admin.catalog_error', 'Unable to update template')))
    }
  }

  const duplicate = async (template: Template) => {
    setError(null)
    try {
      await api.post(`/api/execution/templates/${template.id}/duplicate`, { name: `${template.name} (Copy)` })
      setMessage(String(t('admin.template_duplicated', 'Template duplicated')))
      await load()
    } catch (err) {
      console.error('Template duplication failed:', err)
      setError(String(t('admin.catalog_error', 'Unable to duplicate template')))
    }
  }

  const addMilestone = async () => {
    if (!selected || !milestoneForm.title.trim()) return
    setSaving(true)
    setError(null)
    try {
      await api.post(`/api/execution/templates/${selected.id}/milestones`, milestoneForm)
      setMilestoneForm(emptyMilestone)
      setMessage(String(t('admin.template_saved', 'Template saved')))
      await load()
    } catch (err) {
      console.error('Milestone creation failed:', err)
      setError(String(t('admin.catalog_error', 'Unable to save milestone')))
    } finally {
      setSaving(false)
    }
  }

  const addTask = async (milestone: TemplateMilestone) => {
    if (!selected) return
    const form = taskForms[milestone.id] || emptyTask
    if (!form.title.trim()) return
    setSaving(true)
    setError(null)
    try {
      await api.post(`/api/execution/templates/${selected.id}/milestones/${milestone.id}/tasks`, form)
      setTaskForms((current) => ({ ...current, [milestone.id]: emptyTask }))
      setMessage(String(t('admin.template_saved', 'Template saved')))
      await load()
    } catch (err) {
      console.error('Task creation failed:', err)
      setError(String(t('admin.catalog_error', 'Unable to save task')))
    } finally {
      setSaving(false)
    }
  }

  const editMilestone = async (milestone: TemplateMilestone) => {
    if (!selected) return
    const title = window.prompt(String(t('admin.template_milestone_title', 'Milestone title')), milestone.title)
    if (title === null || !title.trim()) return
    const description = window.prompt(String(t('admin.description', 'Description')), milestone.description || '')
    try {
      await api.patch(`/api/execution/templates/${selected.id}/milestones/${milestone.id}`, {
        title,
        description: description ?? (milestone.description || ''),
      })
      await load()
    } catch (err) {
      console.error('Milestone update failed:', err)
      setError(String(t('admin.catalog_error', 'Unable to update milestone')))
    }
  }

  const editTask = async (milestone: TemplateMilestone, task: TemplateTask) => {
    if (!selected) return
    const title = window.prompt(String(t('admin.template_task_title', 'Task title')), task.title)
    if (title === null || !title.trim()) return
    const description = window.prompt(String(t('admin.description', 'Description')), task.description || '')
    try {
      await api.patch(`/api/execution/templates/${selected.id}/milestones/${milestone.id}/tasks/${task.id}`, {
        title,
        description: description ?? (task.description || ''),
      })
      await load()
    } catch (err) {
      console.error('Task update failed:', err)
      setError(String(t('admin.catalog_error', 'Unable to update task')))
    }
  }

  const deleteMilestone = async (milestone: TemplateMilestone) => {
    if (!selected || !window.confirm(String(t('admin.template_delete_confirm', 'Delete this template item?')))) return
    try {
      await api.delete(`/api/execution/templates/${selected.id}/milestones/${milestone.id}`)
      await load()
    } catch (err) {
      console.error('Milestone deletion failed:', err)
      setError(String(t('admin.catalog_error', 'Unable to delete milestone')))
    }
  }

  const deleteTask = async (milestone: TemplateMilestone, task: TemplateTask) => {
    if (!selected || !window.confirm(String(t('admin.template_delete_confirm', 'Delete this template item?')))) return
    try {
      await api.delete(`/api/execution/templates/${selected.id}/milestones/${milestone.id}/tasks/${task.id}`)
      await load()
    } catch (err) {
      console.error('Task deletion failed:', err)
      setError(String(t('admin.catalog_error', 'Unable to delete task')))
    }
  }

  const renderTask = (milestone: TemplateMilestone, task: TemplateTask) => (
    <div key={task.id} className="flex items-center justify-between gap-2 rounded-lg border border-white/10 px-2.5 py-2">
      <div className="min-w-0">
        <p className="truncate text-sm text-white/80">{task.title}</p>
        <p className="text-[11px] text-white/35">{task.priority} آ· {task.client_visible ? t('admin.client_visible', 'client visible') : t('admin.internal', 'internal')}</p>
      </div>
      <div className="flex gap-1">
        <button type="button" onClick={() => void editTask(milestone, task)} className="rounded-lg p-1.5 text-white/45 hover:bg-white/10 hover:text-white"><Edit3 className="h-3.5 w-3.5" /></button>
        <button type="button" onClick={() => void deleteTask(milestone, task)} className="rounded-lg p-1.5 text-white/45 hover:bg-red-500/10 hover:text-red-300"><Trash2 className="h-3.5 w-3.5" /></button>
      </div>
    </div>
  )

  const renderMilestone = (milestone: TemplateMilestone) => {
    const taskForm = taskForms[milestone.id] || emptyTask
    const tasks = [...(milestone.project_template_tasks || [])].sort((a, b) => a.position - b.position)
    return (
      <div key={milestone.id} className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="font-medium text-white">{milestone.position + 1}. {milestone.title}</p>
            {milestone.description && <p className="mt-1 text-xs text-white/40">{milestone.description}</p>}
          </div>
          <div className="flex gap-1">
            <button type="button" onClick={() => void editMilestone(milestone)} className="rounded-lg p-1.5 text-white/50 hover:bg-white/10 hover:text-white"><Edit3 className="h-3.5 w-3.5" /></button>
            <button type="button" onClick={() => void deleteMilestone(milestone)} className="rounded-lg p-1.5 text-white/50 hover:bg-red-500/10 hover:text-red-300"><Trash2 className="h-3.5 w-3.5" /></button>
          </div>
        </div>
        <div className="mt-3 space-y-2">
          {tasks.map((task) => renderTask(milestone, task))}
          <div className="grid gap-2 md:grid-cols-[1.4fr_1fr_auto]">
            <input value={taskForm.title} onChange={(e) => setTaskForms({ ...taskForms, [milestone.id]: { ...taskForm, title: e.target.value } })} placeholder={String(t('admin.template_task_title', 'Add task'))} className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs text-white placeholder:text-white/30 outline-none focus:border-gold/40" />
            <select value={taskForm.priority} onChange={(e) => setTaskForms({ ...taskForms, [milestone.id]: { ...taskForm, priority: e.target.value } })} className="rounded-lg border border-white/10 bg-slate-950 px-3 py-2 text-xs text-white outline-none focus:border-gold/40">
              {priorities.map((priority) => <option key={priority} value={priority}>{priority}</option>)}
            </select>
            <button type="button" disabled={saving || !taskForm.title.trim()} onClick={() => void addTask(milestone)} className="rounded-lg border border-white/10 px-3 py-2 text-xs text-white/70 disabled:opacity-40"><Plus className="mx-auto h-3.5 w-3.5" /></button>
          </div>
        </div>
      </div>
    )
  }

  const sortedMilestones = [...(selected?.project_template_milestones || [])].sort((a, b) => a.position - b.position)

  return (
    <section className="mb-8 glass rounded-3xl border border-gold/10 p-5">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.25em] text-gold/70">{t('admin.execution_templates', 'Execution control')}</p>
          <h2 className="text-xl font-semibold text-white">{t('admin.templates', 'Project templates')}</h2>
          <p className="mt-1 text-sm text-white/45">{t('admin.templates_hint', 'Manage the milestones and tasks used to initialize projects.')}</p>
        </div>
        <div className="flex gap-2">
          <button type="button" onClick={() => { resetForms(); setSelectedId(null) }} className="flex items-center gap-2 rounded-lg border border-gold/30 bg-gold/15 px-3 py-2 text-sm text-gold"><Plus className="h-4 w-4" />{t('admin.new_template', 'New template')}</button>
          <button type="button" onClick={() => void load()} className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white/70"><RefreshCw className="h-4 w-4" />{t('dashboard.refresh', 'Refresh')}</button>
        </div>
      </div>
      {message && <p className="mb-3 rounded-lg border border-green-400/20 bg-green-400/10 p-2 text-sm text-green-200">{message}</p>}
      {error && <p className="mb-3 rounded-lg border border-red-400/20 bg-red-500/10 p-2 text-sm text-red-200">{error}</p>}
      {loading ? <div className="py-8 text-center text-white/40">{t('dashboard.loading', 'Loading...')}</div> : (
        <div className="grid gap-5 lg:grid-cols-[minmax(220px,0.75fr)_minmax(0,1.75fr)]">
          <div className="space-y-2">
            {templates.length === 0 ? <div className="rounded-2xl border border-dashed border-white/15 p-5 text-sm text-white/45">{t('admin.templates_empty', 'No execution templates yet.')}</div> : templates.map((template) => (
              <button type="button" key={template.id} onClick={() => setSelectedId(template.id)} className={`w-full rounded-2xl border p-3 text-left transition ${selectedId === template.id ? 'border-gold/40 bg-gold/10' : 'border-white/10 bg-white/[0.03] hover:border-white/20'}`}>
                <div className="flex items-start justify-between gap-2"><span className="font-medium text-white">{template.name}</span><span className={`rounded-full px-2 py-0.5 text-[10px] ${template.is_active ? 'bg-emerald-400/10 text-emerald-200' : 'bg-white/10 text-white/45'}`}>{template.is_active ? t('admin.active', 'Active') : t('admin.archived', 'Archived')}</span></div>
                <p className="mt-1 text-xs text-white/40">{template.project_template_milestones?.length || 0} {t('admin.milestones', 'milestones')}</p>
              </button>
            ))}
          </div>
          <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div><h3 className="font-semibold text-white">{selected ? selected.name : t('admin.new_template', 'New template')}</h3><p className="text-xs text-white/40">{selected ? `${sortedMilestones.length} ${t('admin.milestones', 'milestones')}` : t('admin.template_create_hint', 'Start with the template identity, then add milestones and tasks.')}</p></div>
              {selected && <div className="flex gap-1"><button type="button" onClick={() => setEditingTemplate((value) => !value)} className="rounded-lg p-2 text-white/55 hover:bg-white/10 hover:text-white" title={String(t('admin.edit', 'Edit'))}><Edit3 className="h-4 w-4" /></button><button type="button" onClick={() => void duplicate(selected)} className="rounded-lg p-2 text-white/55 hover:bg-white/10 hover:text-white" title={String(t('admin.duplicate', 'Duplicate'))}><Copy className="h-4 w-4" /></button>{selected.is_active ? <button type="button" onClick={() => void setActive(selected, false)} className="rounded-lg p-2 text-white/55 hover:bg-red-500/10 hover:text-red-300" title={String(t('admin.archive', 'Archive'))}><Archive className="h-4 w-4" /></button> : <button type="button" onClick={() => void setActive(selected, true)} className="rounded-lg p-2 text-white/55 hover:bg-emerald-500/10 hover:text-emerald-300" title={String(t('admin.restore', 'Restore'))}><RotateCcw className="h-4 w-4" /></button>}</div>}
            </div>
            {(!selected || editingTemplate) && <div className="mb-5 grid gap-2 md:grid-cols-2"><input value={templateForm.name} onChange={(e) => setTemplateForm({ ...templateForm, name: e.target.value })} placeholder={String(t('admin.template_name', 'Template name'))} className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-white/30 outline-none focus:border-gold/40" /><select value={templateForm.service_id} onChange={(e) => setTemplateForm({ ...templateForm, service_id: e.target.value })} className="rounded-lg border border-white/10 bg-slate-950 px-3 py-2 text-sm text-white outline-none focus:border-gold/40"><option value="">{t('admin.no_service', 'No service association')}</option>{services.map((service) => <option key={service.id} value={service.id}>{service.name}</option>)}</select><textarea value={templateForm.description} onChange={(e) => setTemplateForm({ ...templateForm, description: e.target.value })} placeholder={String(t('admin.description', 'Description'))} rows={2} className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-white/30 outline-none focus:border-gold/40 md:col-span-2" /><button type="button" disabled={saving} onClick={() => void saveTemplate()} className="flex w-fit items-center gap-2 rounded-lg border border-gold/30 bg-gold/15 px-4 py-2 text-sm text-gold disabled:opacity-50"><Save className="h-4 w-4" />{saving ? t('admin.updating', 'Saving...') : t('admin.save', 'Save')}</button></div>}
            {selected && <>
              <div className="mb-4 rounded-xl border border-white/10 bg-white/[0.03] p-3"><div className="mb-2 flex items-center justify-between"><h4 className="text-sm font-medium text-white">{t('admin.add_milestone', 'Add milestone')}</h4><Check className="h-4 w-4 text-gold/70" /></div><div className="grid gap-2 md:grid-cols-2"><input value={milestoneForm.title} onChange={(e) => setMilestoneForm({ ...milestoneForm, title: e.target.value })} placeholder={String(t('admin.template_milestone_title', 'Milestone title'))} className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-white/30 outline-none focus:border-gold/40" /><input value={milestoneForm.description} onChange={(e) => setMilestoneForm({ ...milestoneForm, description: e.target.value })} placeholder={String(t('admin.description', 'Description'))} className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-white/30 outline-none focus:border-gold/40" /></div><button type="button" disabled={saving || !milestoneForm.title.trim()} onClick={() => void addMilestone()} className="mt-2 flex items-center gap-2 rounded-lg border border-white/10 px-3 py-2 text-xs text-white/70 disabled:opacity-40"><Plus className="h-3.5 w-3.5" />{t('admin.add', 'Add')}</button></div>
              <div className="space-y-3">{sortedMilestones.map(renderMilestone)}</div>
            </>}
          </div>
        </div>
      )}
      {selected && <button type="button" onClick={() => { resetForms(); setSelectedId(null) }} className="mt-4 flex items-center gap-2 text-xs text-white/40 hover:text-white"><X className="h-3.5 w-3.5" />{t('admin.close_editor', 'Close editor')}</button>}
    </section>
  )
}

