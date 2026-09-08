import { useEffect, useState } from 'react'
import { Plus, RefreshCw, Archive, Pencil, X } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { api } from '../utils/api-client'

type CatalogTab = 'services' | 'packages' | 'faqs'
type CatalogId = number | string
type Service = { id: number; name: string; category: string; level: string; price: number; description?: string | null; is_active: boolean }
type Package = { id: number; name: string; category?: string | null; price: number; features?: string[]; is_active: boolean }
type FAQ = { id: string; question: Record<string, string>; answer: Record<string, string>; category: string; order_index: number; is_active: boolean }

type ServiceForm = { name: string; category: string; level: string; price: string; description: string; is_active: boolean }
type PackageForm = { name: string; category: string; price: string; features: string; is_active: boolean }
type FaqForm = { question_ar: string; question_en: string; question_tr: string; answer_ar: string; answer_en: string; answer_tr: string; category: string; order_index: string; is_active: boolean }

const emptyService: ServiceForm = { name: '', category: '', level: 'Starter', price: '', description: '', is_active: true }
const emptyPackage: PackageForm = { name: '', category: '', price: '', features: '', is_active: true }
const emptyFaq: FaqForm = { question_ar: '', question_en: '', question_tr: '', answer_ar: '', answer_en: '', answer_tr: '', category: 'general', order_index: '1', is_active: true }

const AdminCatalogManager = () => {
  const { t } = useTranslation()
  const [tab, setTab] = useState<CatalogTab>('services')
  const [services, setServices] = useState<Service[]>([])
  const [packages, setPackages] = useState<Package[]>([])
  const [faqs, setFaqs] = useState<FAQ[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<CatalogId | null>(null)
  const [serviceForm, setServiceForm] = useState<ServiceForm>(emptyService)
  const [packageForm, setPackageForm] = useState<PackageForm>(emptyPackage)
  const [faqForm, setFaqForm] = useState<FaqForm>(emptyFaq)
  const [pendingArchive, setPendingArchive] = useState<{ kind: CatalogTab; id: CatalogId } | null>(null)

  const loadCatalog = async () => {
    setLoading(true)
    setError(null)
    try {
      const [serviceResponse, packageResponse, faqResponse] = await Promise.all([
        api.get('/api/services/admin'),
        api.get('/api/packages/admin'),
        api.get('/api/faqs/admin'),
      ])
      setServices(Array.isArray(serviceResponse.data) ? serviceResponse.data : [])
      setPackages(Array.isArray(packageResponse.data) ? packageResponse.data : [])
      setFaqs(Array.isArray(faqResponse.data?.data) ? faqResponse.data.data : [])
    } catch (err) {
      console.error('Catalog loading failed:', err)
      setError(String(t('admin.catalog_error')))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { void loadCatalog() }, [])

  const resetForm = () => {
    setEditingId(null)
    setServiceForm(emptyService)
    setPackageForm(emptyPackage)
    setFaqForm(emptyFaq)
  }

  const startServiceEdit = (item: Service) => {
    setTab('services')
    setEditingId(item.id)
    setServiceForm({ name: item.name, category: item.category, level: item.level, price: String(item.price ?? ''), description: item.description || '', is_active: item.is_active })
  }

  const startPackageEdit = (item: Package) => {
    setTab('packages')
    setEditingId(item.id)
    setPackageForm({ name: item.name, category: item.category || '', price: String(item.price ?? ''), features: (item.features || []).join('\n'), is_active: item.is_active })
  }

  const startFaqEdit = (item: FAQ) => {
    setTab('faqs')
    setEditingId(item.id)
    setFaqForm({
      question_ar: item.question?.ar || '', question_en: item.question?.en || '', question_tr: item.question?.tr || '',
      answer_ar: item.answer?.ar || '', answer_en: item.answer?.en || '', answer_tr: item.answer?.tr || '',
      category: item.category || 'general', order_index: String(item.order_index ?? 1), is_active: item.is_active,
    })
  }

  const save = async () => {
    setSaving(true)
    setError(null)
    setMessage(null)
    try {
      if (tab === 'services') {
        const payload = { ...serviceForm, price: Number(serviceForm.price || 0) }
        if (editingId) await api.patch(`/api/services/${editingId}`, payload)
        else await api.post('/api/services', payload)
      } else if (tab === 'packages') {
        const payload = { ...packageForm, price: Number(packageForm.price || 0), features: packageForm.features.split('\n').map((line) => line.trim()).filter(Boolean) }
        if (editingId) await api.put(`/api/packages/${editingId}`, payload)
        else await api.post('/api/packages', payload)
      } else {
        const payload = {
          question: { ar: faqForm.question_ar, en: faqForm.question_en, tr: faqForm.question_tr },
          answer: { ar: faqForm.answer_ar, en: faqForm.answer_en, tr: faqForm.answer_tr },
          category: faqForm.category,
          order_index: Number(faqForm.order_index || 0),
          is_active: faqForm.is_active,
        }
        if (editingId) await api.patch(`/api/faqs/${editingId}`, payload)
        else await api.post('/api/faqs', payload)
      }
      resetForm()
      setMessage(String(t('admin.catalog_saved')))
      await loadCatalog()
    } catch (err) {
      console.error('Catalog save failed:', err)
      setError(String(t('admin.catalog_error')))
    } finally {
      setSaving(false)
    }
  }

  const archive = async (kind: CatalogTab, id: CatalogId) => {
    setError(null)
    try {
      await api.delete(`/api/${kind}/${id}`)
      setMessage(String(t('admin.catalog_saved')))
      if (editingId === id) resetForm()
      await loadCatalog()
    } catch (err) {
      console.error('Catalog archive failed:', err)
      setError(String(t('admin.catalog_error')))
    }
  }

  const form = tab === 'services' ? (
    <div className="grid gap-2 md:grid-cols-2">
      <input value={serviceForm.name} onChange={(e) => setServiceForm({ ...serviceForm, name: e.target.value })} placeholder={String(t('projects.name'))} className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-white/30 outline-none focus:border-gold/40" />
      <input value={serviceForm.category} onChange={(e) => setServiceForm({ ...serviceForm, category: e.target.value })} placeholder={String(t('admin.category'))} className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-white/30 outline-none focus:border-gold/40" />
      <input value={serviceForm.level} onChange={(e) => setServiceForm({ ...serviceForm, level: e.target.value })} placeholder="Level" className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-white/30 outline-none focus:border-gold/40" />
      <input type="number" min="0" step="0.01" value={serviceForm.price} onChange={(e) => setServiceForm({ ...serviceForm, price: e.target.value })} placeholder={String(t('dashboard.price'))} className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-white/30 outline-none focus:border-gold/40" />
      <textarea value={serviceForm.description} onChange={(e) => setServiceForm({ ...serviceForm, description: e.target.value })} placeholder={String(t('admin.description'))} className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-white/30 outline-none focus:border-gold/40 md:col-span-2" rows={2} />
    </div>
  ) : tab === 'packages' ? (
    <div className="grid gap-2 md:grid-cols-2">
      <input value={packageForm.name} onChange={(e) => setPackageForm({ ...packageForm, name: e.target.value })} placeholder={String(t('projects.name'))} className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-white/30 outline-none focus:border-gold/40" />
      <input value={packageForm.category} onChange={(e) => setPackageForm({ ...packageForm, category: e.target.value })} placeholder={String(t('admin.category'))} className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-white/30 outline-none focus:border-gold/40" />
      <input type="number" min="0" step="0.01" value={packageForm.price} onChange={(e) => setPackageForm({ ...packageForm, price: e.target.value })} placeholder={String(t('dashboard.price'))} className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-white/30 outline-none focus:border-gold/40" />
      <textarea value={packageForm.features} onChange={(e) => setPackageForm({ ...packageForm, features: e.target.value })} placeholder={String(t('admin.features'))} className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-white/30 outline-none focus:border-gold/40 md:col-span-2" rows={3} />
    </div>
  ) : (
    <div className="grid gap-2 md:grid-cols-2">
      <input value={faqForm.question_ar} onChange={(e) => setFaqForm({ ...faqForm, question_ar: e.target.value })} placeholder={String(t('admin.question_ar'))} className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-white/30 outline-none focus:border-gold/40" />
      <input value={faqForm.question_en} onChange={(e) => setFaqForm({ ...faqForm, question_en: e.target.value })} placeholder={String(t('admin.question_en'))} className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-white/30 outline-none focus:border-gold/40" />
      <input value={faqForm.question_tr} onChange={(e) => setFaqForm({ ...faqForm, question_tr: e.target.value })} placeholder={String(t('admin.question_tr'))} className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-white/30 outline-none focus:border-gold/40" />
      <input value={faqForm.category} onChange={(e) => setFaqForm({ ...faqForm, category: e.target.value })} placeholder={String(t('admin.category'))} className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-white/30 outline-none focus:border-gold/40" />
      <textarea value={faqForm.answer_ar} onChange={(e) => setFaqForm({ ...faqForm, answer_ar: e.target.value })} placeholder={String(t('admin.answer_ar'))} className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-white/30 outline-none focus:border-gold/40" rows={2} />
      <textarea value={faqForm.answer_en} onChange={(e) => setFaqForm({ ...faqForm, answer_en: e.target.value })} placeholder={String(t('admin.answer_en'))} className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-white/30 outline-none focus:border-gold/40" rows={2} />
      <textarea value={faqForm.answer_tr} onChange={(e) => setFaqForm({ ...faqForm, answer_tr: e.target.value })} placeholder={String(t('admin.answer_tr'))} className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-white/30 outline-none focus:border-gold/40" rows={2} />
      <input type="number" min="0" value={faqForm.order_index} onChange={(e) => setFaqForm({ ...faqForm, order_index: e.target.value })} placeholder="Order" className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-white/30 outline-none focus:border-gold/40" />
    </div>
  )

  return (
    <section className="mb-8 glass rounded-3xl border-gold/5 p-5">
      {pendingArchive && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm" role="presentation" onMouseDown={() => setPendingArchive(null)}>
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="archive-confirm-title"
            className="w-full max-w-md rounded-2xl border border-white/10 bg-slate-950 p-6 shadow-2xl"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <h2 id="archive-confirm-title" className="text-lg font-semibold text-white">{t('admin.archive_confirm')}</h2>
            <p className="mt-2 text-sm text-white/60">{t('admin.archive_warning', 'This item will be archived and removed from the active catalog.')}</p>
            <div className="mt-6 flex justify-end gap-3">
              <button type="button" onClick={() => setPendingArchive(null)} className="rounded-lg border border-white/10 px-4 py-2 text-sm text-white/70 hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/70">
                {t('common.cancel', 'Cancel')}
              </button>
              <button
                type="button"
                onClick={() => {
                  const target = pendingArchive
                  setPendingArchive(null)
                  void archive(target.kind, target.id)
                }}
                className="rounded-lg border border-red-400/30 bg-red-500/10 px-4 py-2 text-sm text-red-200 hover:bg-red-500/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-300/70"
              >
                {t('admin.archive', 'Archive')}
              </button>
            </div>
          </div>
        </div>
      )}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div><p className="text-sm uppercase tracking-[0.25em] text-gold/70">{t('admin.catalog')}</p><h2 className="text-xl font-semibold text-white">{t('admin.catalog')}</h2></div>
        <button onClick={() => { resetForm(); void loadCatalog() }} className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white/70"><RefreshCw className="h-4 w-4" />{t('dashboard.refresh')}</button>
      </div>
      <div className="mb-4 flex flex-wrap gap-2">
        {([['services', t('admin.services')], ['packages', t('admin.packages')], ['faqs', t('admin.faqs')]] as const).map(([value, label]) => <button key={value} onClick={() => { resetForm(); setTab(value) }} className={`rounded-full px-3 py-1.5 text-sm ${tab === value ? 'bg-gold/20 text-gold border border-gold/30' : 'bg-white/5 text-white/60 border border-white/10'}`}>{label}</button>)}
      </div>
      {message && <p className="mb-3 rounded-lg border border-green-400/20 bg-green-400/10 p-2 text-sm text-green-200">{message}</p>}
      {error && <p className="mb-3 rounded-lg border border-red-400/20 bg-red-500/10 p-2 text-sm text-red-200">{error}</p>}
      <div className="mb-4 rounded-2xl border border-white/10 bg-black/20 p-4">
        <div className="mb-3 flex items-center justify-between"><h3 className="text-sm font-semibold text-white">{editingId ? t('admin.edit') : t('admin.add')}</h3>{editingId && <button onClick={resetForm} className="text-white/50 hover:text-white"><X className="h-4 w-4" /></button>}</div>
        {form}
        <button disabled={saving} onClick={() => void save()} className="mt-3 flex items-center gap-2 rounded-lg border border-gold/30 bg-gold/15 px-4 py-2 text-sm text-gold disabled:opacity-50"><Plus className="h-4 w-4" />{saving ? t('admin.updating') : t('admin.save')}</button>
      </div>
      {loading ? <div className="py-5 text-center text-white/40">{t('dashboard.loading')}</div> : tab === 'services' ? <div className="space-y-2">{services.map((item) => <div key={item.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/5 p-3"><div><p className="text-sm font-semibold text-white">{item.name}</p><p className="text-xs text-white/50">{item.category} آ· {item.level} آ· ${Number(item.price || 0).toFixed(2)}</p></div><div className="flex gap-2"><button onClick={() => startServiceEdit(item)} className="rounded-lg p-2 text-white/50 hover:bg-white/10 hover:text-white"><Pencil className="h-4 w-4" /></button>{item.is_active && <button onClick={() => setPendingArchive({ kind: 'services', id: item.id })} className="rounded-lg p-2 text-white/50 hover:bg-red-500/10 hover:text-red-300"><Archive className="h-4 w-4" /></button>}</div></div>)}</div> : tab === 'packages' ? <div className="space-y-2">{packages.map((item) => <div key={item.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/5 p-3"><div><p className="text-sm font-semibold text-white">{item.name}</p><p className="text-xs text-white/50">{item.category || '—'} آ· ${Number(item.price || 0).toFixed(2)} آ· {item.is_active ? 'active' : 'archived'}</p></div><div className="flex gap-2"><button onClick={() => startPackageEdit(item)} className="rounded-lg p-2 text-white/50 hover:bg-white/10 hover:text-white"><Pencil className="h-4 w-4" /></button>{item.is_active && <button onClick={() => setPendingArchive({ kind: 'packages', id: item.id })} className="rounded-lg p-2 text-white/50 hover:bg-red-500/10 hover:text-red-300"><Archive className="h-4 w-4" /></button>}</div></div>)}</div> : <div className="space-y-2">{faqs.map((item) => <div key={item.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/5 p-3"><div><p className="text-sm font-semibold text-white">{item.question?.ar || item.question?.en}</p><p className="text-xs text-white/50">{item.category} آ· #{item.order_index} آ· {item.is_active ? 'active' : 'archived'}</p></div><div className="flex gap-2"><button onClick={() => startFaqEdit(item)} className="rounded-lg p-2 text-white/50 hover:bg-white/10 hover:text-white"><Pencil className="h-4 w-4" /></button>{item.is_active && <button onClick={() => setPendingArchive({ kind: 'faqs', id: item.id })} className="rounded-lg p-2 text-white/50 hover:bg-red-500/10 hover:text-red-300"><Archive className="h-4 w-4" /></button>}</div></div>)}</div>}
    </section>
  )
}

export default AdminCatalogManager

