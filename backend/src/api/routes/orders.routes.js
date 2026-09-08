const express = require('express')
const crypto = require('crypto')
const multer = require('multer')
const path = require('path')

const {
  authenticate,
  authorize,
} = require('../middleware/auth.middleware')

const supabase = require('../../config/supabase.config')

const {
  createInvoice,
} = require('../../services/nowpayments.service')

const router = express.Router()

// ============================================================
// CONFIGURATION
// ============================================================

const staffRoles = new Set([
  'admin',
  'super_admin',
  'manager',
])

// ============================================================
// ACCESS CONTROL
// ============================================================

const canAccessOrder = (user, order) => {
  if (!user || !order) {
    return false
  }

  if (order.user_id === user.id) {
    return true
  }

  if (!staffRoles.has(user.role)) {
    return false
  }

  return (
    user.role === 'super_admin' ||
    Boolean(
      user.workspace_id &&
        user.workspace_id ===
          order.workspace_id,
    )
  )
}

const findAccessibleOrder = async (
  orderId,
  user,
) => {
  const {
    data: order,
    error,
  } = await supabase
    .from('orders')
    .select(
      'id, user_id, workspace_id, payment_status, status',
    )
    .eq('id', orderId)
    .maybeSingle()

  if (
    error ||
    !order ||
    !canAccessOrder(user, order)
  ) {
    return null
  }

  return order
}

const requireStaffWorkspace = (
  req,
  res,
) => {
  if (
    req.user.role !== 'super_admin' &&
    !req.user.workspace_id
  ) {
    res.status(403).json({
      message:
        'An active workspace is required',
    })

    return false
  }

  return true
}

// ============================================================
// MULTER
// ============================================================

const storage =
  multer.memoryStorage()

const upload = multer({
  storage,

  limits: {
    fileSize: 10 * 1024 * 1024,
  },

  fileFilter: (
    req,
    file,
    cb,
  ) => {
    const allowedTypes = [
      'image/jpeg',
      'image/png',
      'image/gif',
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    ]

    if (
      allowedTypes.includes(
        file.mimetype,
      )
    ) {
      return cb(null, true)
    }

    return cb(
      new Error(
        'Unsupported file type',
      ),
      false,
    )
  },
})

const uploadFile = (
  req,
  res,
  next,
) => {
  upload.single('file')(
    req,
    res,
    (error) => {
      if (!error) {
        return next()
      }

      if (
        error.code ===
        'LIMIT_FILE_SIZE'
      ) {
        return res.status(400).json({
          message:
            'File exceeds the 10MB limit',
        })
      }

      if (
        error.message ===
        'Unsupported file type'
      ) {
        return res.status(400).json({
          message:
            'Unsupported file type',
        })
      }

      return res.status(400).json({
        message:
          'Invalid file upload',
      })
    },
  )
}

// ============================================================
// HELPERS
// ============================================================

const createOrder = async (
  basePayload,
  userId,
) => {
  const payload = {
    ...basePayload,

    user_id: userId,

    status: 'new',

    payment_status: 'pending',

    submission_id:
      crypto.randomUUID(),

    payment_provider:
      'nowpayments',
  }

  const {
    data,
    error,
  } = await supabase
    .from('orders')
    .insert([payload])
    .select()
    .single()

  return {
    data,
    error,
  }
}

const getOrdersForUser = async (
  userId,
) => {
  const {
    data,
    error,
  } = await supabase
    .from('orders')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', {
      ascending: false,
    })

  return {
    data,
    error,
  }
}

const getPublicApiUrl = () => {
  return String(
    process.env.PUBLIC_API_URL ||
      process.env.API_PUBLIC_URL ||
      '',
  ).replace(/\/+$/, '')
}

const getPublicWebUrl = () => {
  return String(
    process.env.PUBLIC_WEB_URL ||
      process.env.FRONTEND_PUBLIC_URL ||
      '',
  ).replace(/\/+$/, '')
}

const normalizeOptionalString = (
  value,
) => {
  if (
    value === undefined ||
    value === null
  ) {
    return null
  }

  const normalized =
    String(value).trim()

  return normalized || null
}

// ============================================================
// 1. POST /
// إنشاء طلب جديد
// ============================================================

router.post(
  '/',
  authenticate,
  async (req, res) => {
    try {
      const {
        package_id,
        service_id,
      } = req.body

      if (
        !package_id &&
        !service_id
      ) {
        return res.status(400).json({
          message:
            'package_id or service_id is required',
        })
      }

      if (
        package_id &&
        service_id
      ) {
        return res.status(400).json({
          message:
            'Choose either a package or a service',
        })
      }

      let selectedPackage = null
      let selectedService = null

      // --------------------------------------------------------
      // Package
      // --------------------------------------------------------

      if (package_id) {
        const result =
          await supabase
            .from('packages')
            .select(
              'id, name, price',
            )
            .eq(
              'id',
              package_id,
            )
            .eq(
              'is_active',
              true,
            )
            .single()

        selectedPackage =
          result.data

        if (
          result.error ||
          !selectedPackage ||
          Number(
            selectedPackage.price,
          ) <= 0
        ) {
          return res.status(400).json({
            message:
              'A valid active package is required',
          })
        }
      } else {
        // ------------------------------------------------------
        // Service
        // ------------------------------------------------------

        const result =
          await supabase
            .from('services')
            .select(
              'id, name, price, is_active',
            )
            .eq(
              'id',
              service_id,
            )
            .eq(
              'is_active',
              true,
            )
            .single()

        selectedService =
          result.data

        if (
          result.error ||
          !selectedService ||
          Number(
            selectedService.price,
          ) <= 0
        ) {
          return res.status(400).json({
            message:
              'A valid active service is required',
          })
        }
      }

      // --------------------------------------------------------
      // Amount
      // --------------------------------------------------------

      const numericAmount =
        Number(
          selectedPackage?.price ??
            selectedService?.price,
        )

      if (
        !Number.isFinite(
          numericAmount,
        ) ||
        numericAmount <= 0
      ) {
        return res.status(400).json({
          message:
            'Invalid order amount',
        })
      }

      // --------------------------------------------------------
      // User
      // --------------------------------------------------------

      const fullName =
        req.user?.full_name ||
        req.user?.name ||
        'Anonymous'

      // --------------------------------------------------------
      // Order payload
      // --------------------------------------------------------

      const basePayload = {
        amount: numericAmount,

        price: numericAmount,

        package_id:
          selectedPackage?.id ||
          null,

        service:
          selectedService?.name ||
          null,

        network: 'bsc',

        currency: 'USDC',

        full_name:
          fullName,

        email:
          req.user?.email ||
          null,

        workspace_id:
          req.user?.workspace_id ||
          null,

        payment_provider:
          'nowpayments',
      }

      const {
        data: order,
        error,
      } = await createOrder(
        basePayload,
        req.user.id,
      )

      if (error) {
        console.error(
          '❌ Error creating order:',
          error,
        )

        throw error
      }

      // --------------------------------------------------------
      // Event
      // --------------------------------------------------------

      const {
        error: eventError,
      } = await supabase
        .from('order_events')
        .insert([
          {
            order_id:
              order.id,

            actor_id:
              req.user.id,

            event_type:
              'order_created',

            payload: {
              payment_status:
                order.payment_status,

              payment_provider:
                'nowpayments',
            },
          },
        ])

      if (eventError) {
        console.warn(
          '⚠️ Failed to create order event:',
          eventError,
        )
      }

      return res
        .status(201)
        .json(order)
    } catch (err) {
      console.error(
        'Order creation failed:',
        err,
      )

      return res.status(500).json({
        message:
          'Unable to create order',
      })
    }
  },
)

// ============================================================
// 2. POST /:id/create-payment
// إنشاء NOWPayments Invoice
// ============================================================

router.post(
  '/:id/create-payment',
  authenticate,
  async (req, res) => {
    try {
      const orderId =
        req.params.id

      // --------------------------------------------------------
      // Load order
      // --------------------------------------------------------

      const {
        data: order,
        error: orderError,
      } = await supabase
        .from('orders')
        .select(
          [
            'id',
            'user_id',
            'workspace_id',
            'amount',
            'price',
            'status',
            'payment_status',
            'package',
            'package_id',
            'service',
            'email',
            'payment_provider',
            'nowpayments_payment_id',
            'nowpayments_invoice_id',
            'nowpayments_purchase_id',
            'payment_url',
            'nowpayments_pay_address',
            'nowpayments_pay_currency',
            'nowpayments_pay_amount',
            'nowpayments_price_amount',
            'nowpayments_price_currency',
            'nowpayments_status',
            'nowpayments_last_ipn_at',
          ].join(', '),
        )
        .eq('id', orderId)
        .maybeSingle()

      if (orderError) {
        console.error(
          'Failed to load order:',
          orderError,
        )

        return res.status(500).json({
          message:
            'Unable to load order',
        })
      }

      if (!order) {
        return res.status(404).json({
          message:
            'Order not found',
        })
      }

      // --------------------------------------------------------
      // Ownership
      // --------------------------------------------------------

      if (
        order.user_id !==
        req.user.id
      ) {
        return res.status(403).json({
          message:
            'Not allowed',
        })
      }

      // --------------------------------------------------------
      // Status protection
      // --------------------------------------------------------

      if (
        [
          'completed',
          'cancelled',
          'refunded',
        ].includes(order.status)
      ) {
        return res.status(409).json({
          message:
            'This order is not available for payment',
        })
      }

      if (
        order.payment_status ===
        'verified'
      ) {
        return res.status(409).json({
          message:
            'This order has already been paid',
        })
      }

      // --------------------------------------------------------
      // Reuse an already-created invoice when possible
      // --------------------------------------------------------

      if (
        order.payment_url &&
        [
          'waiting',
          'pending',
        ].includes(
          String(
            order.nowpayments_status ||
              order.payment_status ||
              '',
          ).toLowerCase(),
        )
      ) {
        return res.status(200).json({
          order_id:
            order.id,

          invoice_id:
            order.nowpayments_invoice_id,

          payment_id:
            order.nowpayments_payment_id,

          invoice_url:
            order.payment_url,

          payment_status:
            order.nowpayments_status ||
            'waiting',

          pay_address:
            order.nowpayments_pay_address,

          pay_amount:
            order.nowpayments_pay_amount,

          pay_currency:
            order.nowpayments_pay_currency,

          price_amount:
            order.nowpayments_price_amount ||
            Number(
              order.amount ??
                order.price,
            ),

          price_currency:
            order.nowpayments_price_currency ||
            'usd',

          network:
            'bsc',

          purchase_id:
            order.nowpayments_purchase_id,

          last_ipn_at:
            order.nowpayments_last_ipn_at,
        })
      }

      // --------------------------------------------------------
      // Amount
      // --------------------------------------------------------

      const amount = Number(
        order.amount ??
          order.price,
      )

      if (
        !Number.isFinite(
          amount,
        ) ||
        amount <= 0
      ) {
        return res.status(422).json({
          message:
            'Order does not have a valid payment amount',
        })
      }

      // --------------------------------------------------------
      // Public URLs
      // --------------------------------------------------------

      const publicApiUrl =
        getPublicApiUrl()

      const publicWebUrl =
        getPublicWebUrl()

      const ipnCallbackUrl =
        publicApiUrl
          ? `${publicApiUrl}/api/orders/${order.id}/nowpayments-ipn`
          : undefined

      const successUrl =
        publicWebUrl
          ? `${publicWebUrl}/payment/success?order_id=${encodeURIComponent(
              order.id,
            )}`
          : undefined

      const cancelUrl =
        publicWebUrl
          ? `${publicWebUrl}/payment/cancelled?order_id=${encodeURIComponent(
              order.id,
            )}`
          : undefined

      // --------------------------------------------------------
      // Create NOWPayments Invoice
      // --------------------------------------------------------

      const payment =
        await createInvoice({
          priceAmount:
            amount,

          orderId:
            String(order.id),

          orderDescription:
            order.package ||
            order.service ||
            `BISIS Order #${order.id}`,

          ipnCallbackUrl,

          successUrl,

          cancelUrl,

          customerEmail:
            req.user?.email ||
            order.email ||
            undefined,
        })

      // --------------------------------------------------------
      // Normalize response
      // --------------------------------------------------------

      const invoiceId =
        normalizeOptionalString(
          payment?.id ??
            payment?.invoice_id,
        )

      const paymentId =
        normalizeOptionalString(
          payment?.payment_id,
        )

      const purchaseId =
        normalizeOptionalString(
          payment?.purchase_id,
        )

      const invoiceUrl =
        normalizeOptionalString(
          payment?.invoice_url ??
            payment?.url,
        )

      const payAddress =
        normalizeOptionalString(
          payment?.pay_address,
        )

      const payCurrency =
        normalizeOptionalString(
          payment?.pay_currency,
        ) || 'usdcbsc'

      const paymentStatus =
        normalizeOptionalString(
          payment?.payment_status,
        ) || 'waiting'

      const rawPriceAmount =
        payment?.price_amount ??
        amount

      const priceAmount =
        Number(
          rawPriceAmount,
        )

      const rawPayAmount =
        payment?.pay_amount

      const payAmount =
        rawPayAmount !==
          undefined &&
        rawPayAmount !== null &&
        Number.isFinite(
          Number(rawPayAmount),
        )
          ? Number(
              rawPayAmount,
            )
          : null

      // --------------------------------------------------------
      // Save NOWPayments data
      // --------------------------------------------------------

      const updatePayload = {
        payment_provider:
          'nowpayments',

        nowpayments_payment_id:
          paymentId,

        nowpayments_invoice_id:
          invoiceId,

        nowpayments_purchase_id:
          purchaseId,

        payment_url:
          invoiceUrl,

        nowpayments_pay_address:
          payAddress,

        nowpayments_pay_currency:
          payCurrency,

        nowpayments_pay_amount:
          payAmount,

        nowpayments_price_amount:
          Number.isFinite(
            priceAmount,
          )
            ? priceAmount
            : amount,

        nowpayments_price_currency:
          normalizeOptionalString(
            payment?.price_currency,
          ) || 'usd',

        nowpayments_status:
          paymentStatus,

        network:
          'bsc',

        currency:
          'USDC',

        updated_at:
          new Date().toISOString(),
      }

      const {
        data: updatedOrder,
        error: updateError,
      } = await supabase
        .from('orders')
        .update(
          updatePayload,
        )
        .eq('id', order.id)
        .select()
        .single()

      if (updateError) {
        console.error(
          'Failed to save NOWPayments data:',
          updateError,
        )

        throw updateError
      }

      // --------------------------------------------------------
      // Event
      // --------------------------------------------------------

      const {
        error: eventError,
      } = await supabase
        .from('order_events')
        .insert([
          {
            order_id:
              order.id,

            actor_id:
              req.user.id,

            event_type:
              'payment.nowpayments.created',

            payload: {
              invoice_id:
                invoiceId,

              payment_id:
                paymentId,

              purchase_id:
                purchaseId,

              payment_status:
                paymentStatus,

              invoice_url:
                invoiceUrl,

              pay_address:
                payAddress,

              pay_amount:
                payAmount,

              pay_currency:
                payCurrency,

              price_amount:
                priceAmount,

              price_currency:
                payment?.price_currency ||
                'usd',

              network:
                payment?.network ||
                'bsc',
            },
          },
        ])

      if (eventError) {
        console.warn(
          '⚠️ Failed to create payment event:',
          eventError,
        )
      }

      // --------------------------------------------------------
      // Response
      // --------------------------------------------------------

      return res
        .status(201)
        .json({
          order_id:
            updatedOrder.id,

          invoice_id:
            invoiceId,

          invoice_url:
            invoiceUrl,

          payment_id:
            paymentId,

          payment_status:
            paymentStatus,

          pay_address:
            payAddress,

          pay_amount:
            payAmount,

          pay_currency:
            payCurrency,

          price_amount:
            Number.isFinite(
              priceAmount,
            )
              ? priceAmount
              : amount,

          price_currency:
            payment?.price_currency ||
            'usd',

          network:
            payment?.network ||
            'bsc',

          purchase_id:
            purchaseId,

          created_at:
            payment?.created_at ||
            null,

          valid_until:
            payment?.valid_until ||
            null,

          expiration_estimate_date:
            payment?.expiration_estimate_date ||
            null,

          order:
            updatedOrder,
        })
    } catch (err) {
      console.error(
        'NOWPayments invoice creation failed:',
        err,
      )

      return res
        .status(
          Number(err?.status) ||
            500,
        )
        .json({
          message:
            err?.message ||
            'Unable to create NOWPayments payment',

          code:
            err?.code ||
            'NOWPAYMENTS_PAYMENT_CREATION_FAILED',
        })
    }
  },
)

// ============================================================
// 3. GET /my-orders
// طلبات المستخدم
// ============================================================

router.get(
  '/my-orders',
  authenticate,
  async (req, res) => {
    try {
      const {
        data: orders,
        error,
      } = await getOrdersForUser(
        req.user.id,
      )

      if (error) {
        throw error
      }

      return res.json(
        orders || [],
      )
    } catch (err) {
      console.error(
        'Order listing failed:',
        err,
      )

      return res.status(500).json({
        message:
          'Unable to load orders',
      })
    }
  },
)

// ============================================================
// 4. GET /notifications
// ============================================================

router.get(
  '/notifications',
  authenticate,
  async (req, res) => {
    try {
      const {
        data,
        error,
      } = await supabase
        .from(
          'notifications',
        )
        .select(
          'id,order_id,message,type,read,created_at,orders(project_id)',
        )
        .eq(
          'user_id',
          req.user.id,
        )
        .order(
          'created_at',
          {
            ascending:
              false,
          },
        )
        .limit(50)

      if (error) {
        throw error
      }

      return res.json(
        (data || []).map(
          (notification) => ({
            ...notification,

            project_id:
              notification
                .orders
                ?.project_id ||
              null,

            orders:
              undefined,
          }),
        ),
      )
    } catch (err) {
      console.error(
        'Notification listing failed:',
        err,
      )

      return res.status(500).json({
        message:
          'Unable to load notifications',
      })
    }
  },
)

// ============================================================
// 5. PATCH /notifications/read-all
// ============================================================

router.patch(
  '/notifications/read-all',
  authenticate,
  async (req, res) => {
    try {
      const {
        data,
        error,
      } = await supabase
        .from(
          'notifications',
        )
        .update({
          read: true,
        })
        .eq(
          'user_id',
          req.user.id,
        )
        .eq(
          'read',
          false,
        )
        .select('id')

      if (error) {
        throw error
      }

      return res.json({
        updated:
          data?.length || 0,
      })
    } catch (err) {
      console.error(
        'Notification bulk update failed:',
        err,
      )

      return res.status(500).json({
        message:
          'Unable to update notifications',
      })
    }
  },
)

// ============================================================
// 6. PATCH /notifications/:id
// ============================================================

router.patch(
  '/notifications/:id',
  authenticate,
  async (req, res) => {
    try {
      const { id } =
        req.params

      const {
        data,
        error,
      } = await supabase
        .from(
          'notifications',
        )
        .update({
          read: true,
        })
        .eq('id', id)
        .eq(
          'user_id',
          req.user.id,
        )
        .select()
        .single()

      if (error) {
        throw error
      }

      return res.json(data)
    } catch (err) {
      console.error(
        'Notification update failed:',
        err,
      )

      return res.status(500).json({
        message:
          'Unable to update notification',
      })
    }
  },
)

// ============================================================
// 7. GET /admin/analytics
// ============================================================

router.get(
  '/admin/analytics',
  authenticate,
  authorize(
    'super_admin',
    'admin',
    'manager',
  ),
  async (req, res) => {
    try {
      if (
        !requireStaffWorkspace(
          req,
          res,
        )
      ) {
        return
      }

      let totalOrdersQuery =
        supabase
          .from('orders')
          .select('*', {
            count:
              'exact',
            head: true,
          })

      if (
        req.user.role !==
          'super_admin' &&
        req.user.workspace_id
      ) {
        totalOrdersQuery =
          totalOrdersQuery.eq(
            'workspace_id',
            req.user.workspace_id,
          )
      }

      const {
        count: totalOrders,
        error:
          totalOrdersError,
      } =
        await totalOrdersQuery

      if (totalOrdersError) {
        throw totalOrdersError
      }

      let statusQuery =
        supabase
          .from('orders')
          .select('status')

      if (
        req.user.role !==
          'super_admin' &&
        req.user.workspace_id
      ) {
        statusQuery =
          statusQuery.eq(
            'workspace_id',
            req.user.workspace_id,
          )
      }

      const {
        data: allOrders,
        error:
          statusError,
      } =
        await statusQuery

      if (statusError) {
        throw statusError
      }

      const statusMap = {}

      ;(
        allOrders || []
      ).forEach(
        (order) => {
          const key =
            order.status ||
            'new'

          statusMap[key] =
            (statusMap[key] ||
              0) + 1
        },
      )

      const statusData =
        Object.entries(
          statusMap,
        ).map(
          ([
            status,
            count,
          ]) => ({
            status,
            count,
          }),
        )

      let revenueQuery =
        supabase
          .from('orders')
          .select(
            'amount, price',
          )
          .eq(
            'status',
            'completed',
          )

      if (
        req.user.role !==
          'super_admin' &&
        req.user.workspace_id
      ) {
        revenueQuery =
          revenueQuery.eq(
            'workspace_id',
            req.user.workspace_id,
          )
      }

      const {
        data: revenueData,
        error:
          revenueError,
      } =
        await revenueQuery

      if (revenueError) {
        throw revenueError
      }

      const totalRevenue =
        (
          revenueData || []
        ).reduce(
          (sum, order) => {
            const value =
              order.amount ??
              order.price ??
              0

            return (
              sum +
              Number(value)
            )
          },
          0,
        )

      let activityQuery =
        supabase
          .from('orders')
          .select(
            'id, status, updated_at, created_at',
          )
          .order(
            'updated_at',
            {
              ascending:
                false,
            },
          )
          .limit(5)

      if (
        req.user.role !==
          'super_admin' &&
        req.user.workspace_id
      ) {
        activityQuery =
          activityQuery.eq(
            'workspace_id',
            req.user.workspace_id,
          )
      }

      const {
        data: recentActivity,
        error:
          activityError,
      } =
        await activityQuery

      if (activityError) {
        throw activityError
      }

      const formattedActivity =
        (
          recentActivity ||
          []
        ).map(
          (order) => ({
            action:
              order.status ===
              'new'
                ? 'New request created'
                : `Status updated to ${order.status}`,

            order_id:
              order.id,

            timestamp:
              order.updated_at ||
              order.created_at,
          }),
        )

      return res.json({
        totalOrders:
          totalOrders || 0,

        totalRevenue:
          totalRevenue || 0,

        statusCounts:
          statusData,

        recentActivity:
          formattedActivity,
      })
    } catch (err) {
      console.error(
        '❌ Analytics error:',
        err,
      )

      return res.status(500).json({
        message:
          'Unable to load analytics',
      })
    }
  },
)

// ============================================================
// 8. GET /
// جميع الطلبات للمدير
// ============================================================

router.get(
  '/',
  authenticate,
  authorize(
    'super_admin',
    'admin',
    'manager',
  ),
  async (req, res) => {
    try {
      if (
        !requireStaffWorkspace(
          req,
          res,
        )
      ) {
        return
      }

      const page =
        parseInt(
          req.query.page,
          10,
        ) || 1

      const limit =
        parseInt(
          req.query.limit,
          10,
        ) || 20

      const safeLimit =
        Math.min(
          Math.max(limit, 1),
          100,
        )

      const offset =
        (page - 1) *
        safeLimit

      let query =
        supabase
          .from('orders')
          .select('*', {
            count:
              'exact',
          })

      if (
        req.user.role !==
          'super_admin' &&
        req.user.workspace_id
      ) {
        query =
          query.eq(
            'workspace_id',
            req.user.workspace_id,
          )
      }

      if (
        req.query.status &&
        req.query.status !==
          'all'
      ) {
        query =
          query.eq(
            'status',
            req.query.status,
          )
      }

      if (req.query.search) {
        const searchTerm =
          String(
            req.query.search,
          ).replace(
            /[%_]/g,
            '\\$&',
          )

        query = query.or(
          `full_name.ilike.%${searchTerm}%,email.ilike.%${searchTerm}%,submission_id.ilike.%${searchTerm}%`,
        )
      }

      if (req.query.startDate) {
        query =
          query.gte(
            'created_at',
            req.query.startDate,
          )
      }

      if (req.query.endDate) {
        query =
          query.lte(
            'created_at',
            req.query.endDate,
          )
      }

      const {
        data,
        error,
        count,
      } = await query
        .order(
          'created_at',
          {
            ascending:
              false,
          },
        )
        .range(
          offset,
          offset +
            safeLimit -
            1,
        )

      if (error) {
        throw error
      }

      return res.json({
        data:
          data || [],

        pagination: {
          page,

          limit:
            safeLimit,

          total:
            count || 0,

          pages:
            Math.ceil(
              (count || 0) /
                safeLimit,
            ),
        },
      })
    } catch (err) {
      console.error(
        'Admin order listing failed:',
        err,
      )

      return res.status(500).json({
        message:
          'Unable to load orders',
      })
    }
  },
)

// ============================================================
// 9. PATCH /:id
// تحديث حالة الطلب
// ============================================================

router.patch(
  '/:id',
  authenticate,
  authorize(
    'super_admin',
    'admin',
    'manager',
  ),
  async (req, res) => {
    try {
      if (
        !requireStaffWorkspace(
          req,
          res,
        )
      ) {
        return
      }

      const {
        status,
      } = req.body

      const orderId =
        req.params.id

      const allowedStatuses =
        new Set([
          'new',
          'processing',
          'completed',
          'cancelled',
          'refunded',
        ])

      const allowedTransitions =
        new Map([
          [
            'new',
            new Set([
              'processing',
              'cancelled',
            ]),
          ],

          [
            'processing',
            new Set([
              'completed',
              'cancelled',
            ]),
          ],

          [
            'completed',
            new Set([
              'refunded',
            ]),
          ],

          [
            'cancelled',
            new Set(),
          ],

          [
            'refunded',
            new Set(),
          ],
        ])

      if (
        !allowedStatuses.has(
          status,
        )
      ) {
        return res.status(400).json({
          message:
            'Invalid order status',
        })
      }

      let query =
        supabase
          .from('orders')
          .select(
            'id, user_id, workspace_id, amount, price, payment_status, status',
          )
          .eq(
            'id',
            orderId,
          )

      if (
        req.user.role !==
          'super_admin' &&
        req.user.workspace_id
      ) {
        query =
          query.eq(
            'workspace_id',
            req.user.workspace_id,
          )
      }

      const {
        data: order,
        error:
          fetchError,
      } =
        await query.single()

      if (
        fetchError ||
        !order
      ) {
        return res.status(404).json({
          message:
            'Order not found',
        })
      }

      if (
        order.status ===
        status
      ) {
        return res.json({
          ...order,
          idempotent:
            true,
        })
      }

      if (
        !allowedTransitions
          .get(
            order.status ||
              'new',
          )
          ?.has(status)
      ) {
        return res.status(409).json({
          message:
            `Invalid order transition from ${
              order.status ||
              'new'
            } to ${status}`,
        })
      }

      if (
        [
          'processing',
          'completed',
        ].includes(
          status,
        ) &&
        order.payment_status !==
          'verified'
      ) {
        return res.status(409).json({
          message:
            'Order cannot enter fulfilment until payment is verified',
        })
      }

      if (
        status ===
          'refunded' &&
        order.payment_status !==
          'verified'
      ) {
        return res.status(409).json({
          message:
            'Order cannot be refunded until payment is verified',
        })
      }

      const updatePayload = {
        status,

        ...(status ===
        'refunded'
          ? {
              payment_status:
                'refunded',
            }
          : {}),
      }

      const result =
        await supabase
          .from('orders')
          .update(
            updatePayload,
          )
          .eq(
            'id',
            orderId,
          )
          .select()
          .single()

      if (result.error) {
        throw result.error
      }

      await supabase
        .from('order_events')
        .insert([
          {
            order_id:
              orderId,

            actor_id:
              req.user.id,

            event_type:
              'status_changed',

            payload: {
              from:
                order.status,

              to: status,
            },
          },
        ])

      const statusLabels = {
        new: 'جديد',

        processing:
          'قيد التنفيذ',

        completed:
          'مكتمل',

        cancelled:
          'ملغي',

        refunded:
          'مسترد',
      }

      const statusLabel =
        statusLabels[
          status
        ] || status

      const {
        error:
          notifError,
      } = await supabase
        .from(
          'notifications',
        )
        .insert([
          {
            user_id:
              order.user_id,

            order_id:
              orderId,

            message:
              `✅ تم تحديث حالة طلبك #${orderId} إلى "${statusLabel}"`,

            type:
              'status_update',

            created_at:
              new Date().toISOString(),
          },
        ])

      if (notifError) {
        console.warn(
          '⚠️ Failed to create notification:',
          notifError,
        )
      }

      // --------------------------------------------------------
      // Create invoice when order is completed
      // --------------------------------------------------------

      if (
        status ===
        'completed'
      ) {
        const {
          data:
            existingInvoice,
          error:
            checkError,
        } = await supabase
          .from(
            'invoices',
          )
          .select('id')
          .eq(
            'order_id',
            orderId,
          )
          .maybeSingle()

        if (checkError) {
          console.warn(
            '⚠️ Error checking existing invoice:',
            checkError,
          )
        }

        if (
          !existingInvoice
        ) {
          const amount =
            Number(
              order.amount ||
                order.price ||
                0,
            )

          const tax =
            Number(
              (
                amount *
                0.15
              ).toFixed(2),
            )

          const total =
            Number(
              (
                amount +
                tax
              ).toFixed(2),
            )

          const invoiceNumber =
            `INV-${Date.now()}-${Math.random()
              .toString(36)
              .substring(
                2,
                6,
              )
              .toUpperCase()}`

          const {
            error:
              invoiceError,
          } = await supabase
            .from(
              'invoices',
            )
            .insert([
              {
                order_id:
                  orderId,

                invoice_number:
                  invoiceNumber,

                amount,

                tax,

                total,

                status:
                  'paid',

                created_at:
                  new Date().toISOString(),

                updated_at:
                  new Date().toISOString(),
              },
            ])

          if (invoiceError) {
            console.warn(
              '⚠️ Failed to create invoice:',
              invoiceError,
            )
          }
        }
      }

      return res.json(
        result.data,
      )
    } catch (err) {
      console.error(
        'Order update failed:',
        err,
      )

      return res.status(500).json({
        message:
          'Unable to update order',
      })
    }
  },
)

// ============================================================
// 10. POST /:id/upload
// رفع ملف للطلب
// ============================================================

router.post(
  '/:id/upload',
  authenticate,
  uploadFile,
  async (req, res) => {
    try {
      const orderId =
        req.params.id

      const file =
        req.file

      const userId =
        req.user.id

      if (!file) {
        return res.status(400).json({
          message:
            'No file uploaded',
        })
      }

      const order =
        await findAccessibleOrder(
          orderId,
          req.user,
        )

      if (!order) {
        return res.status(404).json({
          message:
            'Order not found',
        })
      }

      const fileExt =
        path.extname(
          file.originalname,
        )

      const requestedFileKind =
        String(
          req.body?.file_kind ||
            '',
        )

      const fileKind =
        staffRoles.has(
          req.user.role,
        ) &&
        [
          'delivery',
          'internal',
        ].includes(
          requestedFileKind,
        )
          ? requestedFileKind
          : 'customer_input'

      const fileName =
        `${crypto.randomUUID()}${fileExt}`

      const filePath =
        `orders/${orderId}/${fileName}`

      const folderPath =
        `orders/${orderId}`

      try {
        const {
          error:
            folderError,
        } = await supabase.storage
          .from(
            'order-files',
          )
          .upload(
            `${folderPath}/.keep`,
            Buffer.from(''),
            {
              contentType:
                'text/plain',

              upsert:
                true,
            },
          )

        if (folderError) {
          console.warn(
            '⚠️ Could not create folder, continuing anyway:',
            folderError,
          )
        }
      } catch (err) {
        console.warn(
          '⚠️ Folder creation error:',
          err,
        )
      }

      const {
        error:
          uploadError,
      } = await supabase.storage
        .from(
          'order-files',
        )
        .upload(
          filePath,
          file.buffer,
          {
            contentType:
              file.mimetype,

            cacheControl:
              '3600',

            upsert:
              false,
          },
        )

      if (uploadError) {
        console.error(
          'Upload error:',
          uploadError,
        )

        return res.status(500).json({
          message:
            'Failed to upload file',
        })
      }

      const {
        data:
          updatedOrder,
        error:
          updateError,
      } = await supabase
        .from('orders')
        .update({
          file_path:
            filePath,

          file_url:
            null,

          updated_at:
            new Date().toISOString(),
        })
        .eq(
          'id',
          orderId,
        )
        .select()
        .single()

      if (updateError) {
        console.error(
          'Update error:',
          updateError,
        )

        return res.status(500).json({
          message:
            'Failed to update order with file URL',
        })
      }

      const {
        data:
          fileMetadata,
        error:
          metadataError,
      } = await supabase
        .from(
          'order_files',
        )
        .insert([
          {
            order_id:
              orderId,

            uploaded_by:
              userId,

            object_path:
              filePath,

            original_name:
              file.originalname,

            mime_type:
              file.mimetype,

            byte_size:
              file.size,

            file_kind:
              fileKind,
          },
        ])
        .select(
          'id,order_id,original_name,mime_type,byte_size,file_kind,created_at',
        )
        .single()

      if (metadataError) {
        throw metadataError
      }

      return res.json({
        message:
          'File uploaded successfully',

        filePath,

        file:
          fileMetadata,

        order:
          updatedOrder,
      })
    } catch (err) {
      console.error(
        'Upload error:',
        err,
      )

      return res.status(500).json({
        message:
          'Unable to process file upload',
      })
    }
  },
)

// ============================================================
// 11. GET /:id/files/:fileId/download
// تنزيل ملف
// ============================================================

router.get(
  '/:id/files/:fileId/download',
  authenticate,
  async (req, res) => {
    try {
      const order =
        await findAccessibleOrder(
          req.params.id,
          req.user,
        )

      if (!order) {
        return res.status(404).json({
          message:
            'Order not found',
        })
      }

      const {
        data: file,
        error:
          fileError,
      } = await supabase
        .from(
          'order_files',
        )
        .select(
          'id, order_id, object_path, original_name, file_kind',
        )
        .eq(
          'id',
          req.params.fileId,
        )
        .eq(
          'order_id',
          order.id,
        )
        .maybeSingle()

      if (
        fileError ||
        !file
      ) {
        return res.status(404).json({
          message:
            'File not found',
        })
      }

      if (
        file.file_kind ===
          'internal' &&
        !staffRoles.has(
          req.user.role,
        )
      ) {
        return res.status(403).json({
          message:
            'You are not allowed to download this file',
        })
      }

      const {
        data: signed,
        error:
          signedError,
      } = await supabase.storage
        .from(
          'order-files',
        )
        .createSignedUrl(
          file.object_path,
          60,
          {
            download:
              file.original_name,
          },
        )

      if (
        signedError ||
        !signed?.signedUrl
      ) {
        throw (
          signedError ||
          new Error(
            'Unable to create download URL',
          )
        )
      }

      return res.json({
        url:
          signed.signedUrl,

        expires_in:
          60,

        filename:
          file.original_name,
      })
    } catch (err) {
      console.error(
        'Signed download error:',
        err,
      )

      return res.status(500).json({
        message:
          'Unable to create download URL',
      })
    }
  },
)

// ============================================================
// EXPORT
// ============================================================

module.exports = router