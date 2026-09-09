import React, { useEffect, useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { 
  AlertCircle, CheckCircle, Clock, DollarSign, RefreshCw, ShieldCheck, 
  FolderOpen, FolderPlus, X, Pencil, Trash2,
  Send, MessageSquare, FileText, Download, Ticket, User, Mail
} from 'lucide-react'
import axios from 'axios'
import { api } from '../utils/api-client'
import { useAuth } from '../contexts/AuthContext'
import AdminCatalogManager from '../components/AdminCatalogManager'
import AdminTemplateManager from '../components/AdminTemplateManager'
import OperationalPulse, { type PulseItem } from '../components/OperationalPulse'
import { Doughnut } from 'react-chartjs-2'
import { Chart, ArcElement, Tooltip, Legend } from 'chart.js'

Chart.register(ArcElement, Tooltip, Legend)

const escapeHtml = (value: unknown) => String(value ?? '')
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#039;')

// ... (جميع الواجهات تبقى كما هي بدون تغيير)
interface Order {
  id?: string
  submission_id?: string
  package?: string
  package_name?: string
  amount?: number | string | null
  price?: number | string | null
  total?: number | string | null
  status?: string
  txid?: string | null
  created_at?: string
  updated_at?: string
  email?: string | null
  full_name?: string | null
  user_id?: string | null
  project_id?: number | null
}

interface Analytics {
  totalOrders: number
  totalRevenue: number
  statusCounts: { status: string; count: number }[]
  recentActivity: { action: string; order_id: string; timestamp: string }[]
}

interface Project {
  id: number
  name: string
  description?: string
  status: string
  workspace_id: string
  created_by: string
  created_at: string
  updated_at: string
  execution_state?: string | null
  waiting_on?: string | null
}

interface DeliveryQueueItem {
  id: number
  name: string
  execution_state?: string | null
  waiting_on?: string | null
  pending_requirements: number
  task_count: number
  completed_task_count: number
  delivery_status?: string | null
  next_action?: { title: string; priority: string } | null
}

interface Invoice {
  id: number
  invoice_number: string
  order_id: number
  amount: number
  tax: number
  total: number
  status: string
  pdf_url: string | null
  created_at: string
  orders?: {
    full_name: string
    email: string
    submission_id: string
    package: string
  }
}

interface Ticket {
  id: number
  user_id: string
  title: string
  description: string
  status: 'open' | 'in_progress' | 'resolved' | 'closed'
  admin_response: string | null
  created_at: string
  updated_at: string
  users?: {
    full_name: string
    email: string
  }
}

interface Message {
  id: number
  conversation_id: number
  sender_id: string
  content: string
  read: boolean
  created_at: string
  sender: {
    id: string
    name: string
    email: string
    role: string
    avatar: string
  }
}

const AdminPanel: React.FC = () => {
  const { t, i18n } = useTranslation()
  const [orders, setOrders] = useState<Order[]>([])
  const [projects, setProjects] = useState<Project[]>([])
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [adminTickets, setAdminTickets] = useState<Ticket[]>([])
  const [deliveryQueue, setDeliveryQueue] = useState<DeliveryQueueItem[]>([])
  const [analytics, setAnalytics] = useState<Analytics | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadingAnalytics, setLoadingAnalytics] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [updatingId, setUpdatingId] = useState<string | null>(null)
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null)
  const [selectedProject, setSelectedProject] = useState<Project | null>(null)
  const [showProjectModal, setShowProjectModal] = useState(false)
  const [editingProject, setEditingProject] = useState<Project | null>(null)
  const [projectForm, setProjectForm] = useState({ name: '', description: '', status: 'active' })
  const [projectFilter, setProjectFilter] = useState<string>('all')

  const [chatMessages, setChatMessages] = useState<Message[]>([])
  const [newMessage, setNewMessage] = useState('')
  const [conversationId, setConversationId] = useState<number | null>(null)
  const [loadingChat, setLoadingChat] = useState(false)
  const { user: authUser, loading: authLoading } = useAuth()
  const currentUserId = authUser?.id || null

  const [filters, setFilters] = useState({ search: '', status: 'all', startDate: '', endDate: '' })

  // ===== جميع الدوال تبقى كما هي =====
  const fetchOrders = async () => {
    try {
      const params = new URLSearchParams()
      if (filters.search) params.append('search', filters.search)
      if (filters.status !== 'all') params.append('status', filters.status)
      if (filters.startDate) params.append('startDate', filters.startDate)
      if (filters.endDate) params.append('endDate', filters.endDate)
      const url = `/api/orders${params.toString() ? `?${params.toString()}` : ''}`
      const { data } = await api.get(url)
// ✅ response الجديد فيه { data: [...], pagination: {...} }
const ordersData = data?.data || (Array.isArray(data) ? data : [])
setOrders(ordersData)
    } catch (err: unknown) {
      const message = axios.isAxiosError(err) ? err.response?.data?.message || 'Unable to load orders' : 'Unable to load orders'
      setError(message)
    }
  }

  const fetchProjects = async () => {
    try {
      const { data } = await api.get('/api/projects')
      setProjects(Array.isArray(data) ? data : [])
    } catch (err) {
      console.error('Error fetching projects:', err)
      setProjects([])
    }
  }

  const fetchInvoices = async () => {
    try {
      const { data } = await api.get('/api/invoices')
      setInvoices(Array.isArray(data) ? data : [])
    } catch (err) {
      console.error('Error fetching invoices:', err)
      setInvoices([])
    }
  }

  const fetchAdminTickets = async () => {
    try {
      const { data } = await api.get('/api/tickets')
      setAdminTickets(Array.isArray(data) ? data : [])
    } catch (err) {
      console.error('Error fetching tickets:', err)
      setAdminTickets([])
    }
  }

  const fetchDeliveryQueue = async () => {
    try {
      const { data } = await api.get('/api/service-delivery/operations/queue')
      setDeliveryQueue(Array.isArray(data?.data) ? data.data : [])
    } catch (err) {
      console.error('Error fetching delivery queue:', err)
      setDeliveryQueue([])
    }
  }

  const fetchAnalytics = async () => {
    try {
      const { data } = await api.get('/api/orders/admin/analytics')
      setAnalytics(data)
    } catch (err: unknown) {
      console.error('Analytics fetch error:', err)
    } finally {
      setLoadingAnalytics(false)
    }
  }

  const fetchAllData = async () => {
    setLoading(true)
    setLoadingAnalytics(true)
    setError(null)
    await Promise.all([fetchOrders(), fetchProjects(), fetchInvoices(), fetchAdminTickets(), fetchDeliveryQueue(), fetchAnalytics()])
    setLoading(false)
    setLoadingAnalytics(false)
  }

  useEffect(() => {
    if (authLoading || !authUser) return
    void fetchAllData()
  }, [authLoading, authUser])

  const handleFilterChange = (key: string, value: string) => {
    setFilters(prev => ({ ...prev, [key]: value }))
    setTimeout(() => fetchOrders(), 0)
  }

  const resetFilters = () => {
    setFilters({ search: '', status: 'all', startDate: '', endDate: '' })
    setTimeout(() => fetchOrders(), 0)
  }

  const updateStatus = async (orderId: string, status: string) => {
    try {
      setUpdatingId(orderId)
      await api.patch(`/api/orders/${orderId}`, { status })
      await fetchAllData()
    } catch (err: unknown) {
      const message = axios.isAxiosError(err) ? err.response?.data?.message || 'Unable to update order' : 'Unable to update order'
      setError(message)
    } finally { setUpdatingId(null) }
  }

  const handleProjectSubmit = async () => {
    try {
      if (editingProject) {
        await api.patch(`/api/projects/${editingProject.id}`, projectForm)
      } else {
        await api.post('/api/projects', projectForm)
      }
      setShowProjectModal(false)
      setEditingProject(null)
      setProjectForm({ name: '', description: '', status: 'active' })
      await fetchProjects()
    } catch (err) {
      alert('Failed to save project')
    }
  }

  const handleDeleteProject = async (id: number) => {
    if (!confirm('Delete this project?')) return
    try {
      await api.delete(`/api/projects/${id}`)
      await fetchProjects()
      if (selectedProject?.id === id) setSelectedProject(null)
    } catch (err) {
      alert('Failed to delete project')
    }
  }

  const assignOrderToProject = async (orderId: string, projectId: number) => {
    try {
      await api.patch(`/api/projects/${projectId}/assign/${orderId}`)
      await fetchAllData()
    } catch (err) {
      alert('Failed to assign order')
    }
  }

  const fetchChat = async (orderId?: string, projectId?: number) => {
    if (!orderId && !projectId) return
    setLoadingChat(true)
    try {
      const params = new URLSearchParams()
      if (orderId) params.append('order_id', orderId)
      if (projectId) params.append('project_id', String(projectId))
      
      const { data: conv } = await api.get(`/api/chat?${params.toString()}`)
      setConversationId(conv.id)
      
      const { data: messages } = await api.get(`/api/chat/${conv.id}/messages`)
      setChatMessages(messages || [])
      
      await api.patch(`/api/chat/${conv.id}/read`)
    } catch (err) {
      console.error('Error fetching chat:', err)
    } finally {
      setLoadingChat(false)
    }
  }

  const sendMessage = async () => {
    if (!newMessage.trim() || !conversationId) return
    try {
      const { data } = await api.post(`/api/chat/${conversationId}/messages`, {
        content: newMessage.trim()
      })
      setChatMessages(prev => [...prev, data])
      setNewMessage('')
    } catch (err) {
      alert('Failed to send message')
    }
  }

  useEffect(() => {
    if (selectedOrder) {
      fetchChat(selectedOrder.id)
    }
  }, [selectedOrder])

  const getOrderPrice = (order: Order) => {
    const rawValue = order.price ?? order.amount ?? order.total ?? 0
    return Number.isFinite(Number(rawValue)) ? Number(rawValue) : 0
  }

  const getStatusMeta = (status?: string) => {
    const normalized = (status || 'new').toLowerCase()
    if (normalized === 'processing') return { label: t('dashboard.processing'), icon: Clock, badgeClass: 'border-yellow-400/30 bg-yellow-400/10 text-yellow-300' }
    if (normalized === 'completed') return { label: t('dashboard.completed'), icon: CheckCircle, badgeClass: 'border-green-400/30 bg-green-400/10 text-green-300' }
    return { label: t('dashboard.new'), icon: AlertCircle, badgeClass: 'border-blue-400/30 bg-blue-400/10 text-blue-300' }
  }

  const formatDate = (value?: string) => {
    if (!value) return '—'
    const date = new Date(value)
    const locale = i18n.language === 'ar' ? 'ar-EG' : i18n.language === 'tr' ? 'tr-TR' : 'en-US'
    return isNaN(date.getTime()) ? '—' : date.toLocaleDateString(locale, { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
  }

  const stats = useMemo(() => {
    const newCount = orders.filter(o => (o.status || 'new').toLowerCase() === 'new').length
    const processingCount = orders.filter(o => (o.status || '').toLowerCase() === 'processing').length
    const completedCount = orders.filter(o => (o.status || '').toLowerCase() === 'completed').length
    const revenue = orders.reduce((sum, o) => sum + Number(o.amount ?? o.price ?? o.total ?? 0), 0)
    return { newCount, processingCount, completedCount, revenue }
  }, [orders])

  const statusCounts = analytics?.statusCounts || []
  const statusMap: Record<string, string> = { new: t('dashboard.new'), processing: t('dashboard.processing'), completed: t('dashboard.completed') }
  const colors: Record<string, string> = { new: '#3B82F6', processing: '#F59E0B', completed: '#10B981' }

  const chartData = {
    labels: statusCounts.map(s => statusMap[s.status] || s.status),
    datasets: [{
      data: statusCounts.map(s => s.count),
      backgroundColor: statusCounts.map(s => colors[s.status] || '#6B7280'),
      borderColor: '#0B0E14',
      borderWidth: 2,
    }]
  }

  const chartOptions = { responsive: true, plugins: { legend: { labels: { color: '#EDF2F7', font: { size: 12, family: 'Cairo' }, padding: 16 } } }, cutout: '65%' }

  const filteredOrders = projectFilter === 'all' ? orders : orders.filter(o => String(o.project_id) === projectFilter)

  const operationalSignals = useMemo(() => {
    const openTickets = adminTickets.filter((ticket) => ticket.status === 'open' || ticket.status === 'in_progress').length
    const unassignedOrders = orders.filter((order) => !order.project_id && (order.status || 'new').toLowerCase() !== 'completed').length
    const activeProjects = projects.filter((project) => ['active', 'in_progress', 'planning'].includes(project.status.toLowerCase())).length
    return { openTickets, unassignedOrders, activeProjects, attentionTotal: stats.newCount + openTickets + unassignedOrders }
  }, [adminTickets, orders, projects, stats.newCount])

  const operationalPulse = useMemo(() => {
    const now = Date.now()
    const hoursSince = (value?: string) => value ? Math.max(0, (now - new Date(value).getTime()) / 36e5) : 0
    const orderLabel = (order: Order) => `#${String(order.submission_id || order.id || 'order').slice(0, 8)}`
    const jumpTo = (id: string) => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    const priority: PulseItem[] = []

    adminTickets
      .filter((ticket) => ticket.status === 'open' || ticket.status === 'in_progress')
      .sort((a, b) => hoursSince(b.updated_at || b.created_at) - hoursSince(a.updated_at || a.created_at))
      .slice(0, 3)
      .forEach((ticket) => priority.push({
        id: `ticket-${ticket.id}`,
        title: ticket.title,
        description: ticket.status === 'open' ? t('admin.review_open_ticket', 'Review this unresolved support ticket.') : t('admin.continue_ticket', 'Continue the response on this ticket.'),
        meta: `#${ticket.id} آ· ${formatDate(ticket.updated_at || ticket.created_at)}`,
        level: hoursSince(ticket.updated_at || ticket.created_at) > 48 ? 'critical' : 'high',
        onClick: () => jumpTo('admin-tickets-section'),
      }))

    orders
      .filter((order) => (order.status || 'new').toLowerCase() === 'new' || (!order.project_id && (order.status || '').toLowerCase() !== 'completed'))
      .sort((a, b) => hoursSince(b.created_at) - hoursSince(a.created_at))
      .slice(0, 3)
      .forEach((order) => priority.push({
        id: `order-${order.id}`,
        title: t('admin.review_order_named', { defaultValue: 'Review order {{order}}', order: orderLabel(order) }),
        description: !order.project_id ? t('admin.order_needs_assignment', 'This order is not assigned to a project yet.') : t('admin.pending_order_action', 'This order is waiting for the next operational step.'),
        meta: `${order.package || order.package_name || t('dashboard.package')} آ· ${formatDate(order.created_at)}`,
        level: !order.project_id || hoursSince(order.created_at) > 24 ? 'high' : 'medium',
        onClick: () => { setSelectedOrder(order); jumpTo('admin-orders-section') },
      }))

    const inProgress: PulseItem[] = [
      ...orders.filter((order) => (order.status || '').toLowerCase() === 'processing').slice(0, 3).map((order) => ({
        id: `processing-${order.id}`,
        title: orderLabel(order),
        description: t('admin.order_in_progress', 'Order is currently being processed.'),
        meta: `${order.package || order.package_name || t('dashboard.package')} آ· ${formatDate(order.updated_at || order.created_at)}`,
        level: 'medium' as const,
        onClick: () => { setSelectedOrder(order); jumpTo('admin-orders-section') },
      })),
      ...projects.filter((project) => ['active', 'in_progress', 'planning'].includes(project.status.toLowerCase())).slice(0, 2).map((project) => ({
        id: `project-${project.id}`,
        title: project.name,
        description: t('admin.project_active_next', 'Project is active and ready for its next update.'),
        meta: `${project.status} آ· ${formatDate(project.updated_at || project.created_at)}`,
        level: 'low' as const,
        onClick: () => { setSelectedProject(project); jumpTo('admin-projects-section') },
      })),
    ]

    const completed: PulseItem[] = [
      ...orders.filter((order) => (order.status || '').toLowerCase() === 'completed').slice(0, 3).map((order) => ({
        id: `completed-order-${order.id}`,
        title: orderLabel(order),
        description: t('admin.order_completed_recently', 'Order completed successfully.'),
        meta: formatDate(order.updated_at || order.created_at),
        level: 'low' as const,
        onClick: () => { setSelectedOrder(order); jumpTo('admin-orders-section') },
      })),
      ...adminTickets.filter((ticket) => ticket.status === 'resolved' || ticket.status === 'closed').slice(0, 2).map((ticket) => ({
        id: `completed-ticket-${ticket.id}`,
        title: ticket.title,
        description: t('admin.ticket_closed_recently', 'Support ticket is resolved.'),
        meta: `#${ticket.id} آ· ${formatDate(ticket.updated_at || ticket.created_at)}`,
        level: 'low' as const,
        onClick: () => jumpTo('admin-tickets-section'),
      })),
    ]

    const activity = (analytics?.recentActivity || []).slice(0, 6).map((item, index) => ({
      id: `${item.order_id}-${item.timestamp}-${index}`,
      title: item.action || t('admin.activity_update', 'Order activity updated'),
      meta: `${item.order_id ? `#${String(item.order_id).slice(0, 8)} آ· ` : ''}${formatDate(item.timestamp)}`,
    }))

    const hour = new Date().getHours()
    const greetingKey = hour < 12 ? 'admin.good_morning' : hour < 18 ? 'admin.good_afternoon' : 'admin.good_evening'
    return {
      greeting: t(greetingKey, 'Good day'),
      subtitle: priority.length > 0
        ? t('admin.attention_summary', { defaultValue: '{{count}} items need your attention.', count: priority.length })
        : t('admin.no_attention_summary', 'Everything is quiet right now. Keep an eye on recent activity below.'),
      priority,
      inProgress,
      completed,
      activity,
    }
  }, [adminTickets, analytics?.recentActivity, formatDate, i18n.language, orders, projects, t])

  const updateTicket = async (ticketId: number, payload: { status?: string; admin_response?: string }) => {
    try {
      await api.patch(`/api/tickets/${ticketId}`, payload)
      await fetchAdminTickets()
    } catch (err) {
      alert('Failed to update ticket')
    }
  }

  // PDF generation function remains as is
  const generatePDF = async (invoiceId: number) => {
    // ... (كما هي بدون تغيير) ...
    try {
      const { data: invoiceData } = await api.get(`/api/invoices/${invoiceId}`)
      const container = document.createElement('div')
      container.style.cssText = `
        position: fixed; top: -9999px; left: 0; 
        background: white; padding: 40px; width: 600px; 
        font-family: 'Cairo', 'Segoe UI', 'Tahoma', sans-serif; 
        direction: rtl; color: #000; z-index: 9999;
      `
      container.innerHTML = `
        <div style="border-bottom: 3px solid #D4AF37; padding-bottom: 10px; margin-bottom: 20px; text-align: center;">
          <h1 style="font-size: 28px; color: #D4AF37; margin: 0; letter-spacing: 2px;">BİŞIŞ</h1>
          <p style="margin: 0; color: #666; font-size: 14px;">AI Business Growth System</p>
        </div>
        <h2 style="text-align: center; color: #333; font-size: 22px; margin: 10px 0;">فاتورة</h2>
        <div style="display: flex; justify-content: space-between; margin: 20px 0; font-size: 14px;">
          <div>
            <p><strong>رقم الفاتورة:</strong> ${escapeHtml(invoiceData.invoice_number)}</p>
            <p><strong>التاريخ:</strong> ${new Date(invoiceData.created_at).toLocaleDateString('ar-EG')}</p>
            <p><strong>الحالة:</strong> ${invoiceData.status === 'issued' ? 'مصدرة ✅' : invoiceData.status === 'refunded' ? 'مستردة' : 'ملغاة'}</p>
          </div>
          <div style="text-align: left;">
            <p><strong>العميل:</strong> ${escapeHtml(invoiceData.orders?.full_name || 'غير محدد')}</p>
            <p><strong>البريد:</strong> ${escapeHtml(invoiceData.orders?.email || 'غير محدد')}</p>
          </div>
        </div>
        <table style="width: 100%; border-collapse: collapse; margin: 20px 0; font-size: 14px;">
          <thead>
            <tr style="background: #f8f8f8; border-bottom: 2px solid #D4AF37;">
              <th style="padding: 12px; text-align: right;">الخدمة</th>
              <th style="padding: 12px; text-align: center;">السعر</th>
              <th style="padding: 12px; text-align: center;">الضريبة</th>
              <th style="padding: 12px; text-align: center;">الإجمالي</th>
            </tr>
          </thead>
          <tbody>
            <tr style="border-bottom: 1px solid #eee;">
              <td style="padding: 12px;">${escapeHtml(invoiceData.orders?.package || 'خدمة')}</td>
              <td style="padding: 12px; text-align: center;">$${Number(invoiceData.amount).toFixed(2)}</td>
              <td style="padding: 12px; text-align: center;">$${Number(invoiceData.tax || 0).toFixed(2)}</td>
              <td style="padding: 12px; text-align: center;">$${Number(invoiceData.total).toFixed(2)}</td>
            </tr>
          </tbody>
          <tfoot>
            <tr style="border-top: 3px double #D4AF37; background: #fafafa;">
              <td colspan="3" style="padding: 12px; text-align: left; font-weight: bold; font-size: 16px;">الإجمالي الكلي</td>
              <td style="padding: 12px; text-align: center; font-weight: bold; font-size: 16px; color: #D4AF37;">$${Number(invoiceData.total).toFixed(2)}</td>
            </tr>
          </tfoot>
        </table>
        <div style="margin-top: 30px; border-top: 1px solid #ddd; padding-top: 20px; text-align: center; color: #888; font-size: 12px;">
          شكراً لثقتك بنا. هذه الفاتورة صادرة من BİŞIŞ.
          <br>للتواصل: info@BİŞİŞ.com
        </div>
      `
      document.body.appendChild(container)
      const html2canvas = (await import('html2canvas')).default
      const canvas = await html2canvas(container, { 
        scale: 2, 
        useCORS: true,
        backgroundColor: '#ffffff',
        logging: false
      })
      document.body.removeChild(container)
      const imgData = canvas.toDataURL('image/png')
      const { default: jsPDF } = await import('jspdf')
      const pdf = new jsPDF('p', 'mm', 'a4')
      const pdfWidth = pdf.internal.pageSize.getWidth()
      const pdfHeight = (canvas.height * pdfWidth) / canvas.width
      pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight)
      pdf.save(`invoice-${escapeHtml(invoiceData.invoice_number)}.pdf`)
    } catch (error) {
      console.error('PDF generation error:', error)
      alert('❌ فشل تحميل الفاتورة. يرجى المحاولة مرة أخرى.')
    }
  }

  if (authLoading) {
    return <div className="min-h-screen flex items-center justify-center text-white bg-transparent">{t('dashboard.loading')}</div>
  }

  if (!currentUserId) {
    return <div className="min-h-screen flex items-center justify-center text-white bg-transparent">{t('dashboard.login_required')}</div>
  }

  return (
    <div className="min-h-screen pt-24 pb-20 section-padding">
      <div className="max-w-7xl mx-auto">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          {/* Header */}
          <div className="mb-8 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="text-sm uppercase tracking-[0.3em] text-gold/70">{t('admin.operations_center')}</p>
              <h1 className="text-3xl font-bold text-white">{t('admin.title')}</h1>
              <p className="mt-2 text-white/50">{t('admin.monitor_requests')}</p>
            </div>
            <button onClick={() => void fetchAllData()} className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white/70 hover:bg-white/10">
              <RefreshCw className="h-4 w-4" /> {t('dashboard.refresh')}
            </button>
          </div>

          {/* Stats */}
          <div className="mb-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {[
              { label: t('admin.open_requests'), value: stats.newCount, icon: AlertCircle, accent: 'text-blue-300' },
              { label: t('admin.in_progress'), value: stats.processingCount, icon: Clock, accent: 'text-yellow-300' },
              { label: t('admin.completed'), value: stats.completedCount, icon: CheckCircle, accent: 'text-green-300' },
              { label: t('admin.revenue'), value: `$${stats.revenue.toFixed(2)}`, icon: DollarSign, accent: 'text-gold' },
            ].map((item, index) => (
              <div key={index} className="glass rounded-2xl border-gold/5 p-5">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-white/50">{item.label}</span>
                  <item.icon className={`h-5 w-5 ${item.accent}`} />
                </div>
                <div className="mt-4 text-2xl font-semibold text-white">{item.value}</div>
              </div>
            ))}
          </div>

          <section aria-labelledby="action-center-title" className="mb-8 glass rounded-3xl border border-gold/10 p-5">
            <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
              <div>
                <p className="text-sm uppercase tracking-[0.25em] text-gold/70">{t('admin.operations_center')}</p>
                <h2 id="action-center-title" className="text-xl font-semibold text-white">{t('admin.action_center', 'Needs attention')}</h2>
              </div>
              <span className={`rounded-full border px-3 py-1 text-xs ${operationalSignals.attentionTotal > 0 ? 'border-red-400/30 bg-red-500/10 text-red-200' : 'border-green-400/30 bg-green-500/10 text-green-200'}`}>
                {operationalSignals.attentionTotal > 0 ? `${operationalSignals.attentionTotal} ${t('admin.items_need_attention', 'items')}` : t('admin.all_clear', 'All clear')}
              </span>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <div className="rounded-2xl border border-blue-400/20 bg-blue-500/10 p-4">
                <div className="flex items-center gap-2 text-blue-200"><AlertCircle className="h-4 w-4" /><span className="text-sm">{t('admin.open_requests')}</span></div>
                <p className="mt-2 text-2xl font-semibold text-white">{stats.newCount}</p>
              </div>
              <div className="rounded-2xl border border-orange-400/20 bg-orange-500/10 p-4">
                <div className="flex items-center gap-2 text-orange-200"><FolderPlus className="h-4 w-4" /><span className="text-sm">{t('admin.unassigned_orders', 'Unassigned orders')}</span></div>
                <p className="mt-2 text-2xl font-semibold text-white">{operationalSignals.unassignedOrders}</p>
              </div>
              <div className="rounded-2xl border border-red-400/20 bg-red-500/10 p-4">
                <div className="flex items-center gap-2 text-red-200"><Ticket className="h-4 w-4" /><span className="text-sm">{t('tickets.open')}</span></div>
                <p className="mt-2 text-2xl font-semibold text-white">{operationalSignals.openTickets}</p>
              </div>
              <div className="rounded-2xl border border-green-400/20 bg-green-500/10 p-4">
                <div className="flex items-center gap-2 text-green-200"><FolderOpen className="h-4 w-4" /><span className="text-sm">{t('projects.active')}</span></div>
                <p className="mt-2 text-2xl font-semibold text-white">{operationalSignals.activeProjects}</p>
              </div>
            </div>
            <p className="mt-4 text-xs text-white/40">{t('admin.action_center_source', 'Signals are calculated from the current orders, tickets, and projects loaded from the backend.')}</p>
          </section>

          {deliveryQueue.length > 0 && <section aria-labelledby="delivery-queue-title" className="mb-8 glass rounded-3xl border border-gold/10 p-5"><div className="mb-4 flex flex-wrap items-end justify-between gap-3"><div><p className="text-xs uppercase tracking-[0.22em] text-gold/70">{t('workbench.delivery_queue')}</p><h2 id="delivery-queue-title" className="mt-1 text-xl font-semibold text-white">{t('admin.delivery_exceptions', 'Service delivery exceptions')}</h2></div><Link to="/workbench" className="text-sm text-gold hover:underline">{t('workbench.open_project')}</Link></div><div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{deliveryQueue.filter((item) => item.next_action || item.pending_requirements > 0 || item.execution_state === 'blocked').slice(0, 6).map((item) => <Link key={item.id} to={`/projects/${item.id}`} className="rounded-2xl border border-white/10 bg-black/20 p-4 transition hover:border-gold/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/70"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="truncate text-sm font-semibold text-white">{item.name}</p><p className="mt-1 text-xs text-gold/80">{t(`client.state.${item.execution_state}`, item.execution_state || 'not_started')}</p></div><FolderOpen className="h-4 w-4 shrink-0 text-gold" /></div><p className="mt-3 text-sm text-white/60">{item.next_action?.title || (item.pending_requirements > 0 ? `${item.pending_requirements} ${t('workbench.requirements_pending')}` : t('admin.project_needs_attention', 'Project needs attention.'))}</p><p className="mt-2 text-xs text-white/35">{item.task_count ? `${item.completed_task_count}/${item.task_count} ${t('client.home.steps_done', 'steps complete')}` : t('client.home.progress_not_available')}</p></Link>)}</div></section>}

          <OperationalPulse
            greeting={operationalPulse.greeting}
            subtitle={operationalPulse.subtitle}
            priority={operationalPulse.priority}
            inProgress={operationalPulse.inProgress}
            completed={operationalPulse.completed}
            activity={operationalPulse.activity}
            emptyPriority={t('admin.no_priority_items', 'No urgent items. That is a good sign.')}
            emptyProgress={t('admin.no_in_progress', 'Nothing is moving right now.')}
            emptyCompleted={t('admin.no_recently_completed', 'Completed work will appear here.')}
            emptyActivity={t('admin.no_recent_activity', 'No activity has happened yet.')}
          />

          <div className="mb-8 grid gap-3 md:grid-cols-2">
            <Link to="/workbench" className="group rounded-2xl border border-gold/15 bg-gold/[0.06] p-4 transition hover:border-gold/35 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/70"><div className="flex items-center justify-between"><div><p className="text-xs uppercase tracking-[0.2em] text-gold/70">{t('admin.quick_action', 'Quick action')}</p><p className="mt-1 text-sm font-semibold text-white">{t('admin.open_workbench', 'Open Workbench')}</p></div><FolderOpen className="h-5 w-5 text-gold transition-transform group-hover:scale-110" /></div><p className="mt-2 text-xs text-white/45">{t('admin.open_workbench_hint', 'Move from decisions to focused execution.')}</p></Link>
            <Link to="/clients" className="group rounded-2xl border border-white/10 bg-white/[0.03] p-4 transition hover:border-gold/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/70"><div className="flex items-center justify-between"><div><p className="text-xs uppercase tracking-[0.2em] text-white/40">{t('admin.quick_action', 'Quick action')}</p><p className="mt-1 text-sm font-semibold text-white">{t('admin.open_client_360', 'Open Client 360')}</p></div><User className="h-5 w-5 text-gold transition-transform group-hover:scale-110" /></div><p className="mt-2 text-xs text-white/45">{t('admin.open_client_360_hint', 'See relationship context across orders and support.')}</p></Link>
          </div>

          <AdminCatalogManager />
          <AdminTemplateManager />

          {/* Analytics Row */}
          <div className="mb-8 grid gap-6 lg:grid-cols-[1fr_2fr]">
            <div className="glass rounded-2xl border-gold/5 p-5">
              <h3 className="text-sm font-semibold text-white/70 mb-3">{t('admin.order_distribution')}</h3>
              {loadingAnalytics ? <div className="py-8 text-center text-white/40">{t('dashboard.loading')}</div> : statusCounts.length === 0 ? <div className="py-8 text-center text-white/40">{t('dashboard.no_data')}</div> : <div className="max-w-xs mx-auto"><Doughnut data={chartData} options={chartOptions} /></div>}
            </div>
            <div className="glass rounded-2xl border-gold/5 p-5">
              <h3 className="text-sm font-semibold text-white/70 mb-3">{t('admin.quick_stats')}</h3>
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-xl border border-white/10 bg-white/5 p-3"><div className="flex items-center gap-2 text-white/50 text-xs">ًں“¦ {t('admin.total_orders')}</div><div className="text-xl font-bold text-white">{analytics?.totalOrders ?? 0}</div></div>
                <div className="rounded-xl border border-white/10 bg-white/5 p-3"><div className="flex items-center gap-2 text-white/50 text-xs">ًں’° {t('admin.revenue')}</div><div className="text-xl font-bold text-gold">${(analytics?.totalRevenue ?? 0).toFixed(2)}</div></div>
                <div className="rounded-xl border border-white/10 bg-white/5 p-3"><div className="flex items-center gap-2 text-white/50 text-xs">ًںں، {t('admin.in_progress')}</div><div className="text-xl font-bold text-yellow-300">{statusCounts.find(s => s.status === 'processing')?.count || 0}</div></div>
                <div className="rounded-xl border border-white/10 bg-white/5 p-3"><div className="flex items-center gap-2 text-white/50 text-xs">✅ {t('admin.completed')}</div><div className="text-xl font-bold text-green-300">{statusCounts.find(s => s.status === 'completed')?.count || 0}</div></div>
              </div>
            </div>
          </div>

          {/* Invoices Section */}
          <div className="mb-6 glass rounded-3xl border-gold/5 p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <FileText className="w-5 h-5 text-gold" />
                <h2 className="text-lg font-semibold text-white">{t('invoices.title')}</h2>
                <span className="text-sm text-white/40">({invoices.length})</span>
              </div>
            </div>
            <div className="space-y-2">
              {invoices.length === 0 && <p className="text-white/40 text-sm">{t('invoices.no_invoices')}</p>}
              {invoices.map(inv => (
                <div key={inv.id} className="glass rounded-xl border border-white/10 p-3 flex items-center justify-between">
                  <div>
                    <p className="text-sm text-white font-semibold">{inv.invoice_number}</p>
                    <p className="text-xs text-white/40">
                      {inv.orders?.full_name || t('dashboard.client')} • {new Date(inv.created_at).toLocaleDateString('ar-EG')}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-sm text-gold">${Number(inv.total).toFixed(2)}</span>
                    <button
                      onClick={() => generatePDF(inv.id)}
                      className="flex items-center gap-1 px-3 py-1 rounded-lg bg-gold/20 border border-gold/30 text-sm text-gold hover:bg-gold/30"
                    >
                      <Download className="w-3 h-3" />
                      PDF
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Tickets Section (Admin) */}
          <div id="admin-tickets-section" className="mb-6 glass rounded-3xl border-gold/5 p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <Ticket className="w-5 h-5 text-gold" />
                <h2 className="text-lg font-semibold text-white">{t('tickets.title')}</h2>
                <span className="text-sm text-white/40">({adminTickets.length})</span>
              </div>
              <div className="flex items-center gap-2">
                <span className={`px-2 py-0.5 text-xs rounded-full ${
                  adminTickets.filter(t => t.status === 'open').length > 0 
                    ? 'bg-red-500/20 text-red-300 border border-red-500/30' 
                    : 'bg-green-500/20 text-green-300 border border-green-500/30'
                }`}>
                  {adminTickets.filter(t => t.status === 'open').length} {t('tickets.open')}
                </span>
              </div>
            </div>

            {adminTickets.length === 0 ? (
              <p className="text-white/40 text-sm text-center py-4">{t('tickets.no_tickets')}</p>
            ) : (
              <div className="space-y-3 max-h-[400px] overflow-y-auto pr-1">
                {adminTickets.map((ticket) => (
                  <div key={ticket.id} className="bg-white/5 border border-white/10 rounded-xl p-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <span className="text-sm font-semibold text-white">#{ticket.id}</span>
                        <span className={`px-2 py-0.5 text-xs rounded-full border ${
                          ticket.status === 'open' ? 'bg-red-500/20 text-red-300 border-red-500/30' :
                          ticket.status === 'in_progress' ? 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30' :
                          ticket.status === 'resolved' ? 'bg-green-500/20 text-green-300 border-green-500/30' :
                          'bg-gray-500/20 text-gray-300 border-gray-500/30'
                        }`}>
                          {ticket.status === 'open' ? t('tickets.open') :
                           ticket.status === 'in_progress' ? t('tickets.in_progress') :
                           ticket.status === 'resolved' ? t('tickets.resolved') : t('tickets.closed')}
                        </span>
                      </div>
                      <div className="text-xs text-white/30">
                        {formatDate(ticket.created_at)}
                      </div>
                    </div>
                    <p className="text-white font-semibold mt-2">{ticket.title}</p>
                    <p className="text-sm text-white/50 line-clamp-2">{ticket.description}</p>
                    <div className="flex items-center gap-2 mt-2 text-xs text-white/40">
                      <User className="w-3 h-3" />
                      <span>{ticket.users?.full_name || t('dashboard.user')}</span>
                      <span className="mx-1">•</span>
                      <Mail className="w-3 h-3" />
                      <span>{ticket.users?.email || '—'}</span>
                    </div>
                    {ticket.admin_response && (
                      <div className="mt-2 p-2 bg-gold/10 rounded-lg border border-gold/20">
                        <p className="text-xs text-gold">{t('tickets.admin_response')}</p>
                        <p className="text-sm text-white/80">{ticket.admin_response}</p>
                      </div>
                    )}
                    <div className="mt-3 flex gap-2">
                      <button
                        onClick={async () => {
                          const response = prompt(t('tickets.respond'))
                          if (response) {
                            await updateTicket(ticket.id, { admin_response: response, status: 'in_progress' })
                          }
                        }}
                        className="px-3 py-1 bg-gold/20 border border-gold/30 rounded-lg text-xs text-gold hover:bg-gold/30"
                      >
                        {t('tickets.respond')}
                      </button>
                      <button
                        onClick={async () => {
                          const newStatus = prompt(t('tickets.change_status'), ticket.status)
                          if (newStatus && ['open', 'in_progress', 'resolved', 'closed'].includes(newStatus)) {
                            await updateTicket(ticket.id, { status: newStatus })
                          }
                        }}
                        className="px-3 py-1 bg-white/5 border border-white/10 rounded-lg text-xs text-white/50 hover:border-white/20"
                      >
                        {t('tickets.change_status')}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Projects Section */}
          <div id="admin-projects-section" className="mb-6 glass rounded-3xl border-gold/5 p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <FolderOpen className="w-5 h-5 text-gold" />
                <h2 className="text-lg font-semibold text-white">{t('projects.title')}</h2>
                <span className="text-sm text-white/40">({projects.length})</span>
              </div>
              <button onClick={() => { setEditingProject(null); setProjectForm({ name: '', description: '', status: 'active' }); setShowProjectModal(true) }} className="flex items-center gap-2 rounded-lg border border-gold/20 bg-gold/10 px-3 py-1.5 text-sm text-gold hover:bg-gold/20">
                <FolderPlus className="w-4 h-4" /> {t('projects.new')}
              </button>
            </div>
            <div className="flex flex-wrap gap-2 mb-3">
              <button onClick={() => setProjectFilter('all')} className={`px-3 py-1 rounded-full text-xs font-medium transition ${projectFilter === 'all' ? 'bg-gold/20 text-gold border border-gold/30' : 'bg-white/5 text-white/50 border border-white/10 hover:bg-white/10'}`}>{t('admin.all_status')}</button>
              {projects.map(p => (
                <button key={p.id} onClick={() => setProjectFilter(String(p.id))} className={`px-3 py-1 rounded-full text-xs font-medium transition ${projectFilter === String(p.id) ? 'bg-gold/20 text-gold border border-gold/30' : 'bg-white/5 text-white/50 border border-white/10 hover:bg-white/10'}`}>{p.name}</button>
              ))}
            </div>
            <div className="flex flex-wrap gap-2">
              {projects.length === 0 && <p className="text-white/40 text-sm">{t('projects.no_projects')}</p>}
              {projects.map(p => (
                <div key={p.id} className={`glass rounded-xl border p-3 transition ${selectedProject?.id === p.id ? 'border-gold/40 bg-gold/5' : 'border-white/10 hover:border-gold/20'}`}>
                  <div className="flex items-center justify-between gap-4">
                    <div className="cursor-pointer" onClick={() => setSelectedProject(p)}>
                      <Link to={`/projects/${p.id}`} onClick={(event) => event.stopPropagation()} className="text-sm font-medium text-white hover:text-gold">{p.name}</Link>
                      <p className="text-xs text-white/40">{p.description || t('projects.no_description')}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <span className={`text-xs px-2 py-0.5 rounded-full ${p.status === 'active' ? 'bg-green-500/20 text-green-300' : 'bg-gray-500/20 text-gray-300'}`}>{p.status === 'active' ? t('projects.active') : t('projects.archived')}</span>
                        <span className="text-xs text-white/30">{formatDate(p.created_at)}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <button onClick={() => { setEditingProject(p); setProjectForm({ name: p.name, description: p.description || '', status: p.status }); setShowProjectModal(true) }} className="p-1 rounded hover:bg-white/10 text-white/40 hover:text-white"><Pencil className="w-3.5 h-3.5" /></button>
                      <button onClick={() => handleDeleteProject(p.id)} className="p-1 rounded hover:bg-red-500/10 text-white/40 hover:text-red-400"><Trash2 className="w-3.5 h-3.5" /></button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {error && <div className="mb-6 rounded-2xl border border-red-400/20 bg-red-500/10 p-4 text-sm text-red-200">{error}</div>}

          {/* Orders + Details */}
          <div id="admin-orders-section" className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
            <div className="glass rounded-3xl border-gold/5 p-5">
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-white">{t('admin.recent_requests')}</h2>
                  <p className="text-sm text-white/50">{t('admin.filtered_by_project')}</p>
                </div>
                <div className="flex items-center gap-2 rounded-full border border-gold/20 bg-gold/10 px-3 py-1 text-sm text-gold"><ShieldCheck className="h-4 w-4" /> {t('admin.live')}</div>
              </div>

              {/* Filters */}
              <div className="mb-4 grid grid-cols-1 md:grid-cols-4 gap-3">
                <input type="text" placeholder={t('admin.search')} value={filters.search} onChange={(e) => handleFilterChange('search', e.target.value)} className="bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-gold/50" />
                <select value={filters.status} onChange={(e) => handleFilterChange('status', e.target.value)} className="bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-sm text-white focus:outline-none focus:border-gold/50"><option value="all">{t('admin.all_status')}</option><option value="new">{t('dashboard.new')}</option><option value="processing">{t('dashboard.processing')}</option><option value="completed">{t('dashboard.completed')}</option></select>
                <input type="date" value={filters.startDate} onChange={(e) => handleFilterChange('startDate', e.target.value)} className="bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-sm text-white focus:outline-none focus:border-gold/50" />
                <div className="flex gap-2"><input type="date" value={filters.endDate} onChange={(e) => handleFilterChange('endDate', e.target.value)} className="flex-1 bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-sm text-white focus:outline-none focus:border-gold/50" />{(filters.search || filters.status !== 'all' || filters.startDate || filters.endDate) && <button onClick={resetFilters} className="px-3 py-2 rounded-lg border border-white/10 text-white/50 hover:text-white"><X className="w-4 h-4" /></button>}</div>
              </div>

              {loading ? <div className="rounded-2xl border border-white/10 bg-white/5 p-8 text-center text-white/40">{t('dashboard.loading')}</div> : filteredOrders.length === 0 ? <div className="rounded-2xl border border-dashed border-white/10 bg-white/5 p-8 text-center text-white/40">{t('dashboard.no_orders')}</div> : <div className="space-y-3 max-h-[600px] overflow-y-auto pr-1">
                {filteredOrders.map((order) => {
                  const statusMeta = getStatusMeta(order.status)
                  return (
                    <button key={order.id} type="button" onClick={() => setSelectedOrder(order)} className={`w-full rounded-2xl border p-4 text-left transition ${selectedOrder?.id === order.id ? 'border-gold/40 bg-gold/5' : 'border-white/10 bg-black/20 hover:border-gold/20'}`}>
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div><div className="text-sm font-semibold text-white">#{String(order.submission_id || order.id || 'order').slice(0, 8)}</div><div className="mt-1 text-sm text-white/50">{order.full_name || order.email || t('dashboard.client')}</div></div>
                        <span className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide ${statusMeta.badgeClass}`}>{statusMeta.label}</span>
                      </div>
                      <div className="mt-3 flex flex-wrap items-center gap-3 text-sm text-white/60">
                        <span className="rounded-full bg-white/5 px-2.5 py-1">{order.package || order.package_name || t('dashboard.package')}</span>
                        <span>${Number(getOrderPrice(order) || 0).toFixed(2)}</span>
                        <span>{formatDate(order.created_at)}</span>
                        <span className="text-xs text-white/30">{t('projects.title')}: {projects.find(p => p.id === order.project_id)?.name || t('admin.none')}</span>
                      </div>
                    </button>
                  )
                })}
              </div>}
            </div>

            <div className="glass rounded-3xl border-gold/5 p-5">
              <div className="mb-4 flex items-center justify-between">
                <div><h2 className="text-lg font-semibold text-white">{t('admin.request_details')}</h2><p className="text-sm text-white/50">{t('admin.review_chat_assign')}</p></div>
                <div className="rounded-full border border-gold/20 bg-gold/10 px-3 py-1 text-sm text-gold">{t('admin.action')}</div>
              </div>
              {selectedOrder ? (
                <div className="space-y-4">
                  <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                    <div className="flex items-center justify-between">
                      <div><p className="text-sm text-white/50">{t('admin.request_id')}</p><p className="text-base font-semibold text-white">#{String(selectedOrder.submission_id || selectedOrder.id || 'order').slice(0, 8)}</p></div>
                      <div className={`rounded-full px-3 py-1 text-sm ${(selectedOrder.status || 'new').toLowerCase() === 'new' ? 'bg-blue-500/20 text-blue-300' : (selectedOrder.status || '').toLowerCase() === 'processing' ? 'bg-yellow-500/20 text-yellow-300' : 'bg-green-500/20 text-green-300'}`}>{selectedOrder.status || 'new'}</div>
                    </div>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="rounded-2xl border border-white/10 bg-white/5 p-4"><p className="text-sm text-white/50">{t('dashboard.client')}</p><p className="mt-2 text-sm font-medium text-white">{selectedOrder.full_name || t('dashboard.anonymous')}</p></div>
                    <div className="rounded-2xl border border-white/10 bg-white/5 p-4"><p className="text-sm text-white/50">{t('dashboard.email')}</p><p className="mt-2 text-sm font-medium text-white">{selectedOrder.email || '—'}</p></div>
                    <div className="rounded-2xl border border-white/10 bg-white/5 p-4"><p className="text-sm text-white/50">{t('dashboard.package')}</p><p className="mt-2 text-sm font-medium text-white">{selectedOrder.package || selectedOrder.package_name || '—'}</p></div>
                    <div className="rounded-2xl border border-white/10 bg-white/5 p-4"><p className="text-sm text-white/50">{t('dashboard.amount')}</p><p className="mt-2 text-sm font-medium text-gold">${getOrderPrice(selectedOrder).toFixed(2)}</p></div>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-white/5 p-4"><p className="text-sm text-white/50">{t('projects.title')}</p>
                    <select value={selectedOrder.project_id || ''} onChange={(e) => { if (e.target.value) assignOrderToProject(selectedOrder.id || '', Number(e.target.value)) }} className="mt-1 w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-gold/50">
                      <option value="">{t('admin.none')}</option>
                      {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                    </select>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-white/5 p-4"><p className="text-sm text-white/50">{t('dashboard.transaction')}</p><p className="mt-2 text-sm font-mono text-white/80 break-all">{selectedOrder.txid || '—'}</p></div>
                  
                  {/* Chat Section */}
                  <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <MessageSquare className="w-4 h-4 text-gold" />
                      <h4 className="text-sm font-semibold text-white">{t('chat.title')}</h4>
                      {chatMessages.filter(m => !m.read && m.sender_id !== currentUserId).length > 0 && (
                        <span className="bg-gold/20 text-gold text-xs px-2 py-0.5 rounded-full">
                          {chatMessages.filter(m => !m.read && m.sender_id !== currentUserId).length} {t('chat.new_messages')}
                        </span>
                      )}
                    </div>
                    
                    <div className="max-h-40 overflow-y-auto space-y-2 mb-3">
                      {loadingChat ? (
                        <p className="text-white/40 text-sm">{t('dashboard.loading')}</p>
                      ) : chatMessages.length === 0 ? (
                        <p className="text-white/40 text-sm">{t('chat.no_messages')}</p>
                      ) : (
                        chatMessages.map((msg, idx) => (
                          <div key={idx} className={`flex ${msg.sender_id === currentUserId ? 'justify-end' : 'justify-start'}`}>
                            <div className={`max-w-[80%] rounded-lg px-3 py-2 text-sm ${
                              msg.sender_id === currentUserId 
                                ? 'bg-gold/20 text-white' 
                                : 'bg-white/10 text-white/80'
                            }`}>
                              <p className="text-xs text-white/50">{msg.sender?.name || t('dashboard.user')}</p>
                              <p>{msg.content}</p>
                              <p className="text-xs text-white/30 mt-1">{formatDate(msg.created_at)}</p>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                    
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={newMessage}
                        onChange={(e) => setNewMessage(e.target.value)}
                        placeholder={t('chat.placeholder')}
                        className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-gold/50"
                        onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
                      />
                      <button
                        onClick={sendMessage}
                        disabled={!newMessage.trim()}
                        className="px-4 py-2 bg-gold/20 border border-gold/30 rounded-lg text-sm text-gold hover:bg-gold/30 disabled:opacity-50"
                      >
                        <Send className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-3">
                    <button onClick={() => void updateStatus(selectedOrder.id || '', 'processing')} disabled={!selectedOrder.id || updatingId === selectedOrder.id || (selectedOrder.status || '').toLowerCase() === 'processing'} className="rounded-lg border border-yellow-400/20 bg-yellow-400/10 px-4 py-2 text-sm font-medium text-yellow-200 transition hover:bg-yellow-400/20 disabled:opacity-50 disabled:cursor-not-allowed">{updatingId === selectedOrder.id ? t('admin.updating') : t('admin.mark_processing')}</button>
                    <button onClick={() => void updateStatus(selectedOrder.id || '', 'completed')} disabled={!selectedOrder.id || updatingId === selectedOrder.id || (selectedOrder.status || '').toLowerCase() === 'completed'} className="rounded-lg border border-green-400/20 bg-green-400/10 px-4 py-2 text-sm font-medium text-green-200 transition hover:bg-green-400/20 disabled:opacity-50 disabled:cursor-not-allowed">{updatingId === selectedOrder.id ? t('admin.updating') : t('admin.mark_completed')}</button>
                  </div>
                </div>
              ) : (
                <div className="rounded-2xl border border-dashed border-white/10 bg-white/5 p-8 text-center text-white/40">{t('admin.select_request')}</div>
              )}
            </div>
          </div>
        </motion.div>
      </div>

      {/* Project Modal */}
      <div className={`fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm transition ${showProjectModal ? 'opacity-100' : 'opacity-0 pointer-events-none'}`} onClick={() => setShowProjectModal(false)}>
        <div className="glass rounded-3xl border-gold/10 p-6 max-w-md w-full" onClick={(e) => e.stopPropagation()}>
          <h3 className="text-xl font-bold text-white mb-4">{editingProject ? t('projects.edit') : t('projects.new')}</h3>
          <div className="space-y-3">
            <input type="text" placeholder={t('projects.name')} value={projectForm.name} onChange={(e) => setProjectForm(prev => ({ ...prev, name: e.target.value }))} className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-white placeholder:text-white/30 focus:outline-none focus:border-gold/50" />
            <textarea placeholder={t('projects.description')} value={projectForm.description} onChange={(e) => setProjectForm(prev => ({ ...prev, description: e.target.value }))} className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-white placeholder:text-white/30 focus:outline-none focus:border-gold/50" rows={2} />
            <select value={projectForm.status} onChange={(e) => setProjectForm(prev => ({ ...prev, status: e.target.value }))} className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-gold/50">
              <option value="active">{t('projects.active')}</option>
              <option value="archived">{t('projects.archived')}</option>
            </select>
          </div>
          <div className="flex gap-3 mt-4">
            <button onClick={() => setShowProjectModal(false)} className="flex-1 py-2 border border-white/10 rounded-lg text-sm text-white/50 hover:text-white">{t('admin.cancel')}</button>
            <button onClick={handleProjectSubmit} className="flex-1 py-2 bg-gold/20 border border-gold/30 rounded-lg text-sm text-gold hover:bg-gold/30">{editingProject ? t('projects.edit') : t('projects.create')}</button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default AdminPanel

