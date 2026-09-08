import React, { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { useTranslation } from 'react-i18next'
import {
  Bell, DollarSign,
  Plus, RefreshCw, Calendar,
  Package, MessageSquare, X, Sparkles, Send,
  Ticket
} from 'lucide-react'
import { api } from '../utils/api-client'
import OrderLifecycle from '../components/OrderLifecycle'
import { useTranslate } from '../hooks/useTranslate'
import { useAuth } from '../contexts/AuthContext'
import ClientDeliveryHome from '../components/ClientDeliveryHome'

// ====== الواجهات (Interfaces) ======
interface Order {
  id: string
  submission_id: string
  package_name: string
  status: 'new' | 'processing' | 'completed'
  price: number
  created_at: string
  updated_at: string
  txid?: string
}

interface Notification {
  id: number
  message: string
  type: string
  read: boolean
  created_at: string
  project_id?: number | null
}

interface Ticket {
  id: number
  title: string
  description: string
  status: 'open' | 'in_progress' | 'resolved' | 'closed'
  admin_response: string | null
  created_at: string
  project_id?: number | null
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

interface FAQ {
  id: number
  question: string | Record<string, string>
  answer: string | Record<string, string>
  category: string
  order: number
}

const localizedText = (
  value: string | Record<string, string> | null | undefined,
  language: string
) => {
  if (typeof value === 'string') return value
  if (!value || typeof value !== 'object') return ''
  return value[language] || value.ar || value.en || value.tr || ''
}

const Dashboard: React.FC = () => {
  const { t } = useTranslate()
  const { i18n } = useTranslation()
  const navigate = useNavigate()
  const { user: authUser, loading: authLoading } = useAuth()
  const currentUserId = authUser?.id || null

  // ====== حالات البيانات ======
  const [orders, setOrders] = useState<Order[]>([])
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [tickets, setTickets] = useState<Ticket[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)
  const [showNotifications, setShowNotifications] = useState(false)
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null)

  const [chatMessages, setChatMessages] = useState<Message[]>([])
  const [newMessage, setNewMessage] = useState('')
  const [conversationId, setConversationId] = useState<number | null>(null)
  const [loadingChat, setLoadingChat] = useState(false)

  const [faqs, setFaqs] = useState<FAQ[]>([])
  const [selectedFaq, setSelectedFaq] = useState<FAQ | null>(null)

  // ====== جلب البيانات ======
  useEffect(() => {
    if (authLoading || !authUser) return

    void fetchAllDataSafe()

    const interval = setInterval(() => {
      void fetchNotificationsSafe()
    }, 30000)

    return () => clearInterval(interval)
  }, [authLoading, authUser])

  const fetchAllDataSafe = async () => {
    setLoading(true)
    setLoadError(false)

    try {
      await Promise.all([
        fetchOrders(),
        fetchNotifications(),
        fetchTickets(),
        fetchFaqs()
      ])
    } catch (err) {
      console.warn(String(t('dashboard.server_unavailable')))
      setLoadError(true)
    } finally {
      setLoading(false)
    }
  }

  const fetchOrders = async () => {
    try {
      const { data } = await api.get('/api/orders/my-orders')
      setOrders(Array.isArray(data) ? data : [])
    } catch (err) {
      console.error('Error fetching orders:', err)
      throw err
    }
  }

  const fetchNotificationsSafe = async () => {
    try {
      await fetchNotifications()
    } catch (err) {
      console.error('Error fetching notifications:', err)
    }
  }

  const fetchNotifications = async () => {
    try {
      const { data } = await api.get('/api/orders/notifications')
      setNotifications(Array.isArray(data) ? data : [])
    } catch (err) {
      console.error('Error fetching notifications:', err)
      throw err
    }
  }

  const fetchTickets = async () => {
    try {
      const { data } = await api.get('/api/tickets/my')
      setTickets(Array.isArray(data) ? data : [])
    } catch (err) {
      console.error('Error fetching tickets:', err)
      throw err
    }
  }

  const fetchFaqs = async () => {
    try {
      const { data } = await api.get('/api/faqs')
      setFaqs(Array.isArray(data?.data) ? data.data : [])
    } catch (err) {
      console.error('Error fetching FAQs:', err)
      throw err
    }
  }

  const markNotificationAsRead = async (id: number) => {
    try {
      await api.patch(`/api/orders/notifications/${id}`, { read: true })
      setNotifications(prev =>
        prev.map(n => n.id === id ? { ...n, read: true } : n)
      )
    } catch (err) {
      console.error('Error marking notification as read:', err)
    }
  }

  const markAllNotificationsAsRead = async () => {
    try {
      await api.patch('/api/orders/notifications/read-all')
      setNotifications(prev =>
        prev.map(notification => ({ ...notification, read: true }))
      )
    } catch (err) {
      console.error('Error marking all notifications as read:', err)
    }
  }

  const createTicket = async () => {
    const title = prompt(String(t('tickets.title_label')))
    if (!title) return

    const description = prompt(String(t('tickets.description_label')))
    if (!description) return

    try {
      await api.post('/api/tickets', { title, description })
      alert(String(t('tickets.create_success')))
      await fetchTickets()
    } catch (err) {
      alert(String(t('tickets.create_error')))
    }
  }

  const fetchChat = async (orderId?: string) => {
    if (!orderId) return

    setLoadingChat(true)

    try {
      const params = new URLSearchParams()
      params.append('order_id', orderId)

      const { data: conv } = await api.get(`/api/chat?${params.toString()}`)
      setConversationId(conv.id)

      const { data: messages } = await api.get(`/api/chat/${conv.id}/messages`)
      setChatMessages(Array.isArray(messages) ? messages : [])

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
      const { data } = await api.post(
        `/api/chat/${conversationId}/messages`,
        { content: newMessage.trim() }
      )

      setChatMessages(prev => [...prev, data])
      setNewMessage('')
    } catch (err) {
      alert(String(t('chat.send_error')))
    }
  }

  useEffect(() => {
    if (selectedOrder) {
      void fetchChat(selectedOrder.id)
    }
  }, [selectedOrder])

  const getStatusBadge = (status: string) => {
    const styles = {
      new: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
      processing: 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30',
      completed: 'bg-green-500/20 text-green-300 border-green-500/30',
    }

    return {
      className: styles[status as keyof typeof styles] || styles.new,
      label: String(t(`dashboard.${status}`))
    }
  }

  const getTicketStatusBadge = (status: string) => {
    const styles = {
      open: 'bg-red-500/20 text-red-300 border-red-500/30',
      in_progress: 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30',
      resolved: 'bg-green-500/20 text-green-300 border-green-500/30',
      closed: 'bg-gray-500/20 text-gray-300 border-gray-500/30',
    }

    return {
      className: styles[status as keyof typeof styles] || styles.open,
      label: String(t(`tickets.${status}`))
    }
  }

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString(
      String(t('dashboard.locale')),
      {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      }
    )
  }

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'status_update':
        return <Bell className="w-4 h-4 text-gold" />
      default:
        return <MessageSquare className="w-4 h-4 text-white/50" />
    }
  }

  const unreadCount = notifications.filter(n => !n.read).length

  const notificationGroups = useMemo(() => {
    const groups = new Map<string, Notification[]>()

    notifications.forEach(notification => {
      const key = notification.project_id
        ? `project:${notification.project_id}`
        : 'general'

      groups.set(key, [
        ...(groups.get(key) || []),
        notification
      ])
    })

    return Array.from(groups.entries()).map(([key, items]) => ({
      key,
      items,
      unread: items.filter(item => !item.read).length
    }))
  }, [notifications])

  const nextUp = useMemo(() => {
    const activeOrder = orders.find(
      order => order.status === 'processing'
    )

    if (activeOrder) {
      return {
        kind: 'processing' as const,
        order: activeOrder
      }
    }

    const newOrder = orders.find(
      order => order.status === 'new'
    )

    if (newOrder) {
      return {
        kind: 'new' as const,
        order: newOrder
      }
    }

    const openTicket = tickets.find(
      ticket =>
        ticket.status === 'open' ||
        ticket.status === 'in_progress'
    )

    if (openTicket) {
      return {
        kind: 'ticket' as const,
        ticket: openTicket
      }
    }

    return null
  }, [orders, tickets])

  if (authLoading) {
    return (
      <div className="min-h-screen bg-transparent px-4 pb-20 pt-24 sm:px-6">
        <div className="mx-auto max-w-6xl animate-pulse space-y-6">
          <div className="h-8 w-56 rounded-lg bg-white/10" />
          <div className="h-4 w-80 rounded bg-white/5" />
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {Array.from({ length: 4 }).map((_, index) => (
              <div
                key={index}
                className="h-24 rounded-2xl bg-white/5"
              />
            ))}
          </div>
          <div className="h-56 rounded-3xl bg-white/5" />
        </div>
      </div>
    )
  }

  if (!currentUserId) {
    return (
      <div className="min-h-screen flex items-center justify-center text-white text-lg bg-transparent">
        {String(t('dashboard.login_required'))}
      </div>
    )
  }

  return (
    <div className="min-h-screen pt-24 pb-20 section-padding">
      <div className="max-w-6xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          {/* Header */}
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-8">
            <div>
              <h1 className="text-3xl font-bold text-white">
                <span className="text-gold">
                  {String(t('dashboard.title'))}
                </span>
              </h1>
              <p className="text-white/50">
                {String(t('dashboard.welcome_message'))}
              </p>
            </div>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setShowNotifications(!showNotifications)}
                aria-label={String(t('dashboard.notifications'))}
                aria-expanded={showNotifications}
                className="relative p-2 rounded-lg border border-white/10 bg-white/5 hover:bg-white/10 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/70"
              >
                <Bell className="w-5 h-5 text-white/70" />

                {unreadCount > 0 && (
                  <span className="absolute -top-1 -right-1 w-5 h-5 bg-gold text-black text-xs font-bold rounded-full flex items-center justify-center">
                    {unreadCount}
                  </span>
                )}
              </button>

              <button
                onClick={() => navigate('/packages')}
                className="btn-primary flex items-center gap-2 text-sm px-4 py-2"
              >
                <Plus className="w-4 h-4" />
                {String(t('dashboard.new_request'))}
              </button>

              <button
                type="button"
                onClick={() => void fetchAllDataSafe()}
                aria-label={String(t('dashboard.retry'))}
                className="p-2 rounded-lg border border-white/10 bg-white/5 hover:bg-white/10 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/70"
              >
                <RefreshCw className="w-5 h-5 text-white/70" />
              </button>
            </div>
          </div>

          {/* Notifications Panel */}
          {showNotifications && (
            <div className="mb-6 glass rounded-2xl border-gold/10 p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold text-white flex items-center gap-2">
                  <Bell className="w-4 h-4 text-gold" />
                  {String(t('dashboard.notifications'))}

                  {unreadCount > 0 && (
                    <span className="text-xs bg-gold/20 text-gold px-2 py-0.5 rounded-full">
                      {unreadCount} {String(t('dashboard.new_count'))}
                    </span>
                  )}
                </h3>

                <div className="flex items-center gap-2">
                  {unreadCount > 0 && (
                    <button
                      type="button"
                      onClick={() => void markAllNotificationsAsRead()}
                      className="rounded-lg border border-gold/20 px-2.5 py-1 text-xs text-gold hover:bg-gold/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/70"
                    >
                      {String(t('dashboard.mark_all_read', 'Mark all read'))}
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => setShowNotifications(false)}
                    aria-label={String(t('common.close', 'Close'))}
                    className="rounded text-white/40 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/70"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {notifications.length === 0 ? (
                <p className="text-white/40 text-sm">
                  {String(t('dashboard.no_notifications'))}
                </p>
              ) : (
                <div className="max-h-72 space-y-4 overflow-y-auto">
                  {notificationGroups.map(group => (
                    <section
                      key={group.key}
                      aria-labelledby={`notification-group-${group.key}`}
                    >
                      <div className="mb-2 flex items-center justify-between px-1">
                        <h4
                          id={`notification-group-${group.key}`}
                          className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/35"
                        >
                          {group.key === 'general'
                            ? String(t('dashboard.general_notifications', 'General'))
                            : String(t('dashboard.project_notifications', 'Project updates'))}
                        </h4>

                        {group.unread > 0 && (
                          <span className="text-[10px] text-gold">
                            {group.unread} {String(t('dashboard.new_count'))}
                          </span>
                        )}
                      </div>

                      <div className="space-y-2">
                        {group.items.map(notif => (
                          <button
                            type="button"
                            key={notif.id}
                            aria-label={`${notif.read ? '' : `${String(t('dashboard.unread', 'Unread'))}: `}${notif.message}`}
                            aria-pressed={notif.read}
                            className={`flex w-full items-center gap-3 rounded-lg p-3 text-start transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/70 ${
                              notif.read
                                ? 'bg-white/5'
                                : 'border border-gold/20 bg-gold/10'
                            }`}
                            onClick={() => {
                              void markNotificationAsRead(notif.id)

                              if (notif.project_id) {
                                navigate(`/projects/${notif.project_id}`)
                              }
                            }}
                          >
                            {getNotificationIcon(notif.type)}

                            <div className="flex-1">
                              <p className="text-sm text-white/90">
                                {notif.message}
                              </p>

                              <p className="text-xs text-white/30">
                                {formatDate(notif.created_at)}
                              </p>
                            </div>

                            {!notif.read && (
                              <span className="h-2 w-2 flex-shrink-0 rounded-full bg-gold" />
                            )}
                          </button>
                        ))}
                      </div>
                    </section>
                  ))}
                </div>
              )}
            </div>
          )}

          <ClientDeliveryHome />

          {/* Stats Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            <div className="glass rounded-2xl border-gold/5 p-4">
              <p className="text-white/50 text-sm">
                {String(t('dashboard.orders'))}
              </p>
              <p className="text-2xl font-bold text-white">
                {orders.length}
              </p>
            </div>

            <div className="glass rounded-2xl border-gold/5 p-4">
              <p className="text-white/50 text-sm">
                {String(t('dashboard.new'))}
              </p>
              <p className="text-2xl font-bold text-blue-400">
                {orders.filter(o => o.status === 'new').length}
              </p>
            </div>

            <div className="glass rounded-2xl border-gold/5 p-4">
              <p className="text-white/50 text-sm">
                {String(t('dashboard.processing'))}
              </p>
              <p className="text-2xl font-bold text-yellow-400">
                {orders.filter(o => o.status === 'processing').length}
              </p>
            </div>

            <div className="glass rounded-2xl border-gold/5 p-4">
              <p className="text-white/50 text-sm">
                {String(t('dashboard.completed'))}
              </p>
              <p className="text-2xl font-bold text-green-400">
                {orders.filter(o => o.status === 'completed').length}
              </p>
            </div>
          </div>

          <section
            aria-labelledby="dashboard-next-title"
            className="mb-6 grid gap-4 lg:grid-cols-[1.25fr_0.75fr]"
          >
            <div className="rounded-3xl border border-gold/15 bg-gradient-to-br from-gold/[0.08] via-white/[0.03] to-transparent p-5">
              <div className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.22em] text-gold/80">
                <Sparkles aria-hidden="true" className="h-4 w-4" />
                {String(t('dashboard.up_next', 'Up next'))}
              </div>

              <h2
                id="dashboard-next-title"
                className="text-xl font-semibold text-white"
              >
                {nextUp
                  ? String(t('dashboard.next_step_title', 'Here is what happens next'))
                  : String(t('dashboard.all_caught_up', 'You are all caught up'))}
              </h2>

              <p className="mt-2 max-w-xl text-sm leading-6 text-white/55">
                {nextUp?.kind === 'processing'
                  ? String(t('dashboard.next_processing', 'Your order is currently being processed. We will keep the status updated here.'))
                  : nextUp?.kind === 'new'
                    ? String(t('dashboard.next_new', 'Your request is received and waiting for the next operational step.'))
                    : nextUp?.kind === 'ticket'
                      ? String(t('dashboard.next_ticket', 'Your support request is open. Check the latest response when it arrives.'))
                      : String(t('dashboard.next_empty', 'There are no pending requests or support actions right now.'))}
              </p>

              {nextUp && (
                <button
                  type="button"
                  onClick={() =>
                    nextUp.kind === 'ticket'
                      ? document
                          .getElementById('dashboard-tickets-section')
                          ?.scrollIntoView({ behavior: 'smooth' })
                      : setSelectedOrder(nextUp.order)
                  }
                  className="mt-4 inline-flex items-center gap-2 rounded-lg border border-gold/25 bg-gold/10 px-3 py-2 text-sm text-gold transition hover:bg-gold/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/70"
                >
                  {nextUp.kind === 'ticket'
                    ? String(t('dashboard.view_ticket', 'View support'))
                    : String(t('dashboard.view_order', 'View order'))}
                </button>
              )}
            </div>

            <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-5">
              <div className="flex items-center justify-between">
                <span className="text-sm text-white/50">
                  {String(t('dashboard.unread_items', 'Unread items'))}
                </span>
                <Bell aria-hidden="true" className="h-4 w-4 text-gold" />
              </div>

              <p className="mt-3 text-3xl font-bold text-white">
                {unreadCount}
              </p>

              <p className="mt-2 text-sm text-white/45">
                {unreadCount > 0
                  ? String(t('dashboard.unread_hint', 'Open notifications to see what changed.'))
                  : String(t('dashboard.no_unread_hint', 'You are up to date.'))}
              </p>
            </div>
          </section>

          {loadError && (
            <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-red-400/20 bg-red-500/10 p-4 text-sm text-red-200">
              <span>{String(t('dashboard.server_unavailable'))}</span>

              <button
                type="button"
                onClick={() => void fetchAllDataSafe()}
                className="rounded-lg border border-red-300/30 px-3 py-1.5 hover:bg-red-400/10"
              >
                {String(t('dashboard.retry'))}
              </button>
            </div>
          )}

          {/* Orders List */}
          <div className="glass rounded-3xl border-gold/5 p-6">
            <h2 className="text-lg font-semibold text-white mb-4">
              {String(t('dashboard.orders'))}
            </h2>

            {loading ? (
              <div
                className="space-y-3"
                aria-label={String(t('dashboard.loading'))}
              >
                {Array.from({ length: 3 }).map((_, index) => (
                  <div
                    key={index}
                    className="animate-pulse rounded-2xl border border-white/10 bg-white/5 p-4"
                  >
                    <div className="h-4 w-1/3 rounded bg-white/10" />
                    <div className="mt-3 h-3 w-2/3 rounded bg-white/5" />
                    <div className="mt-3 h-2 w-full rounded bg-white/5" />
                  </div>
                ))}
              </div>
            ) : orders.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-white/10 bg-white/[0.03] p-8 text-center text-white/40">
                <Package className="mx-auto mb-3 h-12 w-12 opacity-30" />

                <p className="text-white/70">
                  {String(t('dashboard.no_orders'))}
                </p>

                <p className="mx-auto mt-2 max-w-sm text-sm text-white/40">
                  {String(
                    t(
                      'dashboard.no_orders_context',
                      'Your workspace is ready. Your first request will appear here when you choose a package.'
                    )
                  )}
                </p>

                <button
                  onClick={() => navigate('/packages')}
                  className="mt-4 btn-primary text-sm px-4 py-2"
                >
                  {String(t('dashboard.start_first_order'))}
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                {orders.map(order => {
                  const status = getStatusBadge(order.status)

                  return (
                    <div
                      key={order.id}
                      className="bg-white/5 border border-white/10 rounded-xl p-4 hover:border-gold/20 transition-all cursor-pointer"
                      onClick={() => setSelectedOrder(order)}
                    >
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <span className="text-sm font-semibold text-white">
                            #{order.submission_id?.slice(0, 8) || order.id?.slice(0, 8)}
                          </span>

                          <span
                            className={`px-2 py-0.5 text-xs rounded-full border ${status.className}`}
                          >
                            {status.label}
                          </span>
                        </div>

                        <div className="flex items-center gap-4 text-sm text-white/50">
                          <span className="flex items-center gap-1">
                            <DollarSign className="w-3 h-3" />
                            {order.price}
                          </span>

                          <span className="flex items-center gap-1">
                            <Calendar className="w-3 h-3" />
                            {formatDate(order.created_at)}
                          </span>
                        </div>
                      </div>

                      <div className="mt-4 rounded-xl border border-white/10 bg-black/20 p-3">
                        <OrderLifecycle status={order.status} />
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* Tickets Section */}
          <div
            id="dashboard-tickets-section"
            className="mt-8 glass rounded-3xl border-gold/5 p-6"
          >
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Ticket className="w-5 h-5 text-gold" />

                <h2 className="text-lg font-semibold text-white">
                  {String(t('tickets.title'))}
                </h2>

                <span className="text-sm text-white/40">
                  ({tickets.length})
                </span>
              </div>

              <button
                onClick={createTicket}
                className="px-4 py-2 bg-gold/20 border border-gold/30 rounded-lg text-sm text-gold hover:bg-gold/30 transition-all flex items-center gap-2"
              >
                <Plus className="w-4 h-4" />
                {String(t('tickets.new'))}
              </button>
            </div>

            {tickets.length === 0 ? (
              <p className="text-white/40 text-sm text-center py-4">
                {String(t('tickets.no_tickets'))}
              </p>
            ) : (
              <div className="space-y-3">
                {tickets.map(ticket => {
                  const status = getTicketStatusBadge(ticket.status)

                  return (
                    <div
                      key={ticket.id}
                      className="bg-white/5 border border-white/10 rounded-xl p-4 hover:border-gold/20 transition-all"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <span className="text-sm font-semibold text-white">
                            #{ticket.id}
                          </span>

                          <span
                            className={`px-2 py-0.5 text-xs rounded-full border ${status.className}`}
                          >
                            {status.label}
                          </span>
                        </div>

                        <div className="text-xs text-white/30">
                          {formatDate(ticket.created_at)}
                        </div>
                      </div>

                      <p className="text-white font-semibold mt-2">
                        {ticket.title}
                      </p>

                      {ticket.project_id && (
                        <Link
                          to={`/projects/${ticket.project_id}`}
                          className="mt-2 inline-flex items-center text-xs text-gold hover:underline"
                          onClick={event => event.stopPropagation()}
                        >
                          {String(t('tickets.open_project', 'Open project'))}
                        </Link>
                      )}

                      <p className="text-sm text-white/50 line-clamp-2">
                        {ticket.description}
                      </p>

                      {ticket.admin_response && (
                        <div className="mt-2 p-2 bg-white/5 rounded-lg border border-white/5">
                          <p className="text-xs text-gold">
                            {String(t('tickets.admin_response'))}
                          </p>

                          <p className="text-sm text-white/80">
                            {ticket.admin_response}
                          </p>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* FAQ Section */}
          <div className="mt-8 glass rounded-3xl border-gold/5 p-6">
            <div className="flex items-center gap-2 mb-4">
              <Sparkles className="w-5 h-5 text-gold" />

              <h2 className="text-lg font-semibold text-white">
                {String(t('faq.title'))}
              </h2>
            </div>

            {faqs.length === 0 ? (
              <p className="text-white/40 text-sm text-center py-4">
                {String(t('faq.no_questions'))}
              </p>
            ) : (
              <div className="space-y-2">
                {faqs.map(faq => (
                  <div
                    key={faq.id}
                    className="border border-white/10 rounded-lg overflow-hidden"
                  >
                    <button
                      onClick={() =>
                        setSelectedFaq(
                          selectedFaq?.id === faq.id ? null : faq
                        )
                      }
                      className="w-full text-start px-4 py-3 bg-white/5 hover:bg-white/10 transition-all flex justify-between items-center"
                    >
                      <span className="text-sm text-white">
                        {localizedText(faq.question, i18n.language)}
                      </span>

                      <span className="text-white/30">
                        {selectedFaq?.id === faq.id ? 'â–²' : 'â–¼'}
                      </span>
                    </button>

                    {selectedFaq?.id === faq.id && (
                      <div className="px-4 py-3 bg-black/20 text-sm text-white/70 border-t border-white/5">
                        {localizedText(faq.answer, i18n.language)}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            <div className="mt-4 p-4 bg-white/5 rounded-xl border border-white/10">
              <p className="text-sm text-white/50">
                {String(t('faq.not_found'))}
              </p>

              <button
                onClick={() => {
                  const question = prompt(
                    String(t('faq.ask_question'))
                  )

                  if (question) {
                    api.post('/api/tickets', {
                      title: String(
                        t('faq.support_request_title')
                      ),
                      description: `${String(
                        t('faq.question')
                      )}: ${question}`
                    })
                      .then(() => {
                        alert(String(t('faq.question_sent')))
                      })
                      .catch(() => {
                        alert(String(t('faq.question_error')))
                      })
                  }
                }}
                className="mt-2 px-4 py-2 bg-gold/20 border border-gold/30 rounded-lg text-sm text-gold hover:bg-gold/30 transition-all"
              >
                + {String(t('faq.ask_question'))}
              </button>
            </div>
          </div>

          {/* Order Detail Modal */}
          {selectedOrder && (
            <div
              className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
              onClick={() => setSelectedOrder(null)}
            >
              <div
                className="glass rounded-3xl border-gold/10 p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto"
                onClick={e => e.stopPropagation()}
              >
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-xl font-bold text-white">
                    {String(t('dashboard.order_details'))} #
                    {selectedOrder.submission_id?.slice(0, 8) ||
                      selectedOrder.id?.slice(0, 8)}
                  </h3>

                  <button
                    type="button"
                    onClick={() => setSelectedOrder(null)}
                    aria-label={String(
                      t('common.close', 'Close')
                    )}
                    className="text-white/40 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/70 rounded"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <div className="space-y-4">
                  <div className="mb-4 rounded-2xl border border-gold/15 bg-gold/[0.06] p-4">
                    <OrderLifecycle status={selectedOrder.status} />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-white/5 rounded-xl p-4">
                      <p className="text-white/50 text-sm">
                        {String(t('dashboard.status'))}
                      </p>

                      <p className="text-white font-semibold">
                        {getStatusBadge(selectedOrder.status).label}
                      </p>
                    </div>

                    <div className="bg-white/5 rounded-xl p-4">
                      <p className="text-white/50 text-sm">
                        {String(t('dashboard.price'))}
                      </p>

                      <p className="text-gold font-semibold">
                        ${selectedOrder.price}
                      </p>
                    </div>

                    <div className="bg-white/5 rounded-xl p-4">
                      <p className="text-white/50 text-sm">
                        {String(t('dashboard.created_at'))}
                      </p>

                      <p className="text-white font-semibold text-sm">
                        {formatDate(selectedOrder.created_at)}
                      </p>
                    </div>

                    <div className="bg-white/5 rounded-xl p-4">
                      <p className="text-white/50 text-sm">
                        {String(t('dashboard.txid'))}
                      </p>

                      <p className="text-white font-semibold text-sm truncate">
                        {selectedOrder.txid || '—'}
                      </p>
                    </div>
                  </div>

                  <div className="bg-white/5 rounded-xl p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <MessageSquare className="w-4 h-4 text-gold" />

                      <h4 className="text-sm font-semibold text-white">
                        {String(t('chat.title'))}
                      </h4>

                      {chatMessages.filter(
                        m =>
                          !m.read &&
                          m.sender_id !== currentUserId
                      ).length > 0 && (
                        <span className="bg-gold/20 text-gold text-xs px-2 py-0.5 rounded-full">
                          {
                            chatMessages.filter(
                              m =>
                                !m.read &&
                                m.sender_id !== currentUserId
                            ).length
                          }{' '}
                          {String(
                            t('chat.new_messages')
                          )}
                        </span>
                      )}
                    </div>

                    <div className="max-h-40 overflow-y-auto space-y-2 mb-3">
                      {loadingChat ? (
                        <p className="text-white/40 text-sm">
                          {String(t('dashboard.loading'))}
                        </p>
                      ) : chatMessages.length === 0 ? (
                        <p className="text-white/40 text-sm">
                          {String(t('chat.no_messages'))}
                        </p>
                      ) : (
                        chatMessages.map((msg, idx) => (
                          <div
                            key={idx}
                            className={`flex ${
                              msg.sender_id === currentUserId
                                ? 'justify-end'
                                : 'justify-start'
                            }`}
                          >
                            <div
                              className={`max-w-[80%] rounded-lg px-3 py-2 text-sm ${
                                msg.sender_id === currentUserId
                                  ? 'bg-gold/20 text-white'
                                  : 'bg-white/10 text-white/80'
                              }`}
                            >
                              <p className="text-xs text-white/50">
                                {msg.sender?.name ||
                                  String(
                                    t('dashboard.user')
                                  )}
                              </p>

                              <p>{msg.content}</p>

                              <p className="text-xs text-white/30 mt-1">
                                {formatDate(msg.created_at)}
                              </p>
                            </div>
                          </div>
                        ))
                      )}
                    </div>

                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={newMessage}
                        onChange={e =>
                          setNewMessage(e.target.value)
                        }
                        placeholder={String(
                          t('chat.placeholder')
                        )}
                        className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-gold/50"
                        onKeyDown={e => {
                          if (e.key === 'Enter') {
                            void sendMessage()
                          }
                        }}
                      />

                      <button
                        type="button"
                        onClick={() => void sendMessage()}
                        aria-label={String(
                          t('chat.send', 'Send message')
                        )}
                        disabled={!newMessage.trim()}
                        className="px-4 py-2 bg-gold/20 border border-gold/30 rounded-lg text-sm text-gold hover:bg-gold/30 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/70"
                      >
                        <Send className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  <button
                    onClick={() => {
                      setSelectedOrder(null)
                      navigate('/packages')
                    }}
                    className="w-full btn-primary text-center"
                  >
                    {String(t('dashboard.new_request'))}
                  </button>
                </div>
              </div>
            </div>
          )}
        </motion.div>
      </div>
    </div>
  )
}

export default Dashboard
