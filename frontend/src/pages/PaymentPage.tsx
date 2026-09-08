import React, { useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import axios from 'axios'
import { motion } from 'framer-motion'
import {
  ArrowRight,
  Check,
  Copy,
  File,
  Loader2,
  Upload,
  Wallet,
  X,
  AlertTriangle,
  ExternalLink,
} from 'lucide-react'
import { api } from '../utils/api-client'

type PaymentState = {
  package?: string
  packageId?: number
  service?: string
  serviceId?: number
}

type CatalogItem = {
  name: string
  price: number
  kind: 'package' | 'service'
}

type PaymentData = {
  order_id: number
  invoice_id: string | null
  invoice_url: string | null
  payment_id: string | null
  payment_status: string
  pay_address: string | null
  pay_amount: number | null
  pay_currency: string | null
  price_amount: number
  price_currency: string
  network: string
  purchase_id: string | null
  valid_until: string | null
  expiration_estimate_date: string | null
}

const PaymentPage: React.FC = () => {
  const { t } = useTranslation()
  const location = useLocation()
  const navigate = useNavigate()

  const paymentState =
    (location.state || {}) as PaymentState

  const pkgName =
    paymentState.package || ''

  const pkgId =
    Number.isInteger(
      paymentState.packageId
    )
      ? paymentState.packageId!
      : null

  const serviceName =
    paymentState.service || ''

  const serviceId =
    Number.isInteger(
      paymentState.serviceId
    )
      ? paymentState.serviceId!
      : null

  const [catalogItem, setCatalogItem] =
    useState<CatalogItem | null>(null)

  const [loadingCatalog, setLoadingCatalog] =
    useState(true)

  const [creatingPayment, setCreatingPayment] =
    useState(false)

  const [paymentError, setPaymentError] =
    useState<string | null>(null)

  const [payment, setPayment] =
    useState<PaymentData | null>(null)

  const [copied, setCopied] =
    useState(false)

  const [orderId, setOrderId] =
    useState<number | null>(null)

  const [file, setFile] =
    useState<File | null>(null)

  const [uploading, setUploading] =
    useState(false)

  const [fileUrl, setFileUrl] =
    useState<string | null>(null)

  const [uploadError, setUploadError] =
    useState<string | null>(null)

  useEffect(() => {
    if (!pkgId && !serviceId) {
      setLoadingCatalog(false)
      return
    }

    const fetchCatalogItem = async () => {
      try {
        const endpoint = pkgId
          ? '/api/packages'
          : '/api/services'

        const { data } =
          await api.get(endpoint)

        const selected =
          Array.isArray(data)
            ? data.find(
                (item: { id?: number }) =>
                  item.id ===
                  (pkgId || serviceId)
              )
            : null

        if (selected) {
          setCatalogItem({
            name: selected.name,
            price: Number(
              selected.price
            ),
            kind: pkgId
              ? 'package'
              : 'service',
          })
        }
      } catch (err) {
        console.error(
          'Failed to load selected catalog item:',
          err
        )
      } finally {
        setLoadingCatalog(false)
      }
    }

    void fetchCatalogItem()
  }, [pkgId, serviceId])

  const getApiErrorMessage = (
    error: unknown
  ): string | null => {
    if (
      !axios.isAxiosError(error) ||
      !error.response?.data
    ) {
      return null
    }

    const responseData =
      error.response.data

    if (
      typeof responseData !==
        'object' ||
      responseData === null
    ) {
      return null
    }

    const dataWithMessage =
      responseData as Record<
        string,
        unknown
      >

    if (
      typeof dataWithMessage.message ===
      'string'
    ) {
      return dataWithMessage.message
    }

    return null
  }

  const handleCreatePayment = async () => {
    if (!pkgId && !serviceId) {
      alert(
        'A valid package or service must be selected before payment.'
      )
      return
    }

    setCreatingPayment(true)
    setPaymentError(null)

    try {
      const orderResponse =
        await api.post(
          '/api/orders',
          pkgId
            ? { package_id: pkgId }
            : { service_id: serviceId }
        )

      const newOrder =
        orderResponse.data

      const newOrderId =
        Number(newOrder?.id)

      if (
        !Number.isInteger(
          newOrderId
        )
      ) {
        throw new Error(
          'Order was created but no valid order ID was returned.'
        )
      }

      setOrderId(newOrderId)

      const paymentResponse =
        await api.post(
          `/api/orders/${newOrderId}/create-payment`
        )

      const paymentData =
        paymentResponse.data as PaymentData

      setPayment(
        paymentData
      )

      if (
        paymentData.invoice_url
      ) {
        window.location.assign(
          paymentData.invoice_url
        )
      }
    } catch (err) {
      console.error(
        'Failed to create payment:',
        err
      )

      const message =
        getApiErrorMessage(err) ||
        'Unable to create payment.'

      setPaymentError(message)
    } finally {
      setCreatingPayment(false)
    }
  }

  const handleCopyAddress = async () => {
    if (!payment?.pay_address) {
      return
    }

    try {
      await navigator.clipboard.writeText(
        payment.pay_address
      )

      setCopied(true)

      window.setTimeout(
        () => setCopied(false),
        2000
      )
    } catch (err) {
      console.error(
        'Failed to copy payment address:',
        err
      )
    }
  }

  const handleFileChange = (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const selectedFile =
      e.target.files?.[0]

    if (!selectedFile) {
      return
    }

    if (
      selectedFile.size >
      10 * 1024 * 1024
    ) {
      setUploadError(
        t(
          'payment.file_size_error'
        )
      )
      setFile(null)
      return
    }

    const allowedTypes = [
      'image/jpeg',
      'image/png',
      'image/gif',
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    ]

    if (
      !allowedTypes.includes(
        selectedFile.type
      )
    ) {
      setUploadError(
        t(
          'payment.file_type_error'
        )
      )
      setFile(null)
      return
    }

    setFile(selectedFile)
    setUploadError(null)
  }

  const handleFileUpload = async () => {
    if (!file || !orderId) {
      return
    }

    setUploading(true)
    setUploadError(null)

    const formData =
      new FormData()

    formData.append(
      'file',
      file
    )

    try {
      const { data } =
        await api.post(
          `/api/orders/${orderId}/upload`,
          formData,
          {
            headers: {
              'Content-Type':
                'multipart/form-data',
            },
          }
        )

      setFileUrl(
        data.file?.object_path ||
          data.fileUrl ||
          data.file?.url ||
          null
      )

      setUploading(false)

      alert(
        t(
          'payment.file_upload_success'
        )
      )
    } catch (err) {
      setUploading(false)

      const msg =
        getApiErrorMessage(err) ||
        t(
          'payment.file_upload_error'
        )

      setUploadError(msg)
    }
  }

  const handleRemoveFile = () => {
    setFile(null)
    setFileUrl(null)
    setUploadError(null)
  }

  const handleGoToDashboard = () => {
    navigate('/dashboard')
  }

  if (loadingCatalog) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-white/50">
          جاري تحميل معلومات الطلب...
        </div>
      </div>
    )
  }

  if (!pkgId && !serviceId) {
    return (
      <div className="min-h-screen pt-24 pb-20 section-padding">
        <div className="max-w-2xl mx-auto">
          <div className="glass rounded-2xl p-8 border border-gold/10 text-center">
            <h1 className="text-2xl font-bold text-white mb-3">
              {t('packages.title')}
            </h1>

            <p className="text-white/60 mb-6">
              {t('packages.subtitle')}
            </p>

            <button
              onClick={() =>
                navigate(
                  '/packages'
                )
              }
              className="btn-primary"
            >
              {t(
                'payment.choose_package'
              )}
            </button>
          </div>
        </div>
      </div>
    )
  }

  const displayName =
    catalogItem?.name ||
    pkgName ||
    serviceName

  const displayPrice =
    catalogItem?.price || 0

  return (
    <div className="min-h-screen pt-24 pb-20 section-padding">
      <div className="max-w-2xl mx-auto">
        <motion.div
          initial={{
            opacity: 0,
            y: 30,
          }}
          animate={{
            opacity: 1,
            y: 0,
          }}
          className="glass rounded-2xl p-8 border-gold/10"
        >
          <span className="text-gold text-sm font-semibold tracking-wider uppercase mb-4 block">
            {t(
              'payment.eyebrow'
            )}
          </span>

          <h1 className="text-3xl font-bold text-white mb-2">
            {t(
              'payment.title'
            )}
          </h1>

          {displayName && (
            <p className="text-gold/80 text-sm mb-2">
              {displayName}
            </p>
          )}

          {catalogItem && (
            <p className="text-white/60 text-sm mb-2">
              ${displayPrice.toFixed(2)}
              {catalogItem.kind ===
                'service' &&
              serviceId === 42
                ? '/month'
                : ''}
            </p>
          )}

          <p className="text-white/50 mb-8">
            {t(
              'payment.desc'
            )}
          </p>

          {!payment && (
            <>
              <div className="bg-transparent rounded-xl p-6 mb-8 border border-white/5">
                <div className="flex items-center gap-2 mb-4">
                  <Wallet className="w-5 h-5 text-gold" />

                  <span className="text-sm text-white/70">
                    USDC — BSC
                  </span>
                </div>

                <p className="text-xs text-white/40">
                  سيتم إنشاء صفحة دفع آمنة عبر NOWPayments.
                </p>
              </div>

              {paymentError && (
                <div className="mb-6 bg-red-500/10 border border-red-500/20 rounded-lg p-4 text-red-300 text-sm flex items-start gap-3">
                  <AlertTriangle className="w-5 h-5 shrink-0" />
                  <span>
                    {paymentError}
                  </span>
                </div>
              )}

              <button
                onClick={
                  handleCreatePayment
                }
                disabled={
                  creatingPayment
                }
                className="w-full btn-primary flex items-center justify-center gap-2"
              >
                {creatingPayment ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    جاري إنشاء الدفع...
                  </>
                ) : (
                  <>
                    الدفع الآن
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </>
          )}

          {payment && (
            <>
              <div className="bg-green-500/10 border border-green-500/20 rounded-xl p-5 mb-6">
                <div className="flex items-center gap-3 text-green-300">
                  <Check className="w-5 h-5" />
                  <span className="font-medium">
                    تم إنشاء عملية الدفع
                  </span>
                </div>
              </div>

              {payment.invoice_url && (
                <a
                  href={
                    payment.invoice_url
                  }
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full btn-primary flex items-center justify-center gap-2 mb-6"
                >
                  فتح صفحة الدفع
                  <ExternalLink className="w-4 h-4" />
                </a>
              )}

              {payment.pay_address && (
                <div className="bg-transparent rounded-xl p-6 mb-6 border border-white/5">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                      <Wallet className="w-5 h-5 text-gold" />
                      <span className="text-sm text-white/70">
                        USDC — BSC
                      </span>
                    </div>

                    <span className="px-3 py-1 rounded-full bg-gold/10 text-gold text-xs font-medium">
                      {payment.payment_status}
                    </span>
                  </div>

                  <p className="text-xs text-white/40 mb-2">
                    المبلغ المطلوب:
                  </p>

                  <p className="text-xl font-bold text-white mb-4">
                    {payment.pay_amount}
                    {' '}
                    USDC
                  </p>

                  <div className="flex items-center gap-3 p-4 bg-black/40 rounded-lg border border-white/10">
                    <code className="flex-1 text-sm text-white/70 font-mono break-all">
                      {payment.pay_address}
                    </code>

                    <button
                      onClick={
                        handleCopyAddress
                      }
                      className="p-2 rounded-lg bg-white/5 hover:bg-white/10 transition-colors text-gold"
                      title="Copy"
                    >
                      {copied ? (
                        <Check className="w-4 h-4" />
                      ) : (
                        <Copy className="w-4 h-4" />
                      )}
                    </button>
                  </div>

                  {copied && (
                    <p className="text-xs text-green-300 mt-3">
                      تم نسخ العنوان
                    </p>
                  )}
                </div>
              )}

              <div className="space-y-4 mb-8">
                <h3 className="text-sm font-semibold text-white">
                  {t(
                    'payment.steps_title'
                  )}
                </h3>

                <ol className="space-y-2 text-sm text-white/50 list-decimal list-inside">
                  <li>
                    افتح صفحة الدفع وأكمل الدفع عبر NOWPayments.
                  </li>
                  <li>
                    تأكد من اختيار USDC على شبكة BSC.
                  </li>
                  <li>
                    بعد الدفع، ستصل حالة الدفع تلقائيًا إلى BİŞIŞ عبر NOWPayments.
                  </li>
                </ol>
              </div>

              {orderId && (
                <div className="glass p-4 rounded-lg border border-gold/10">
                  <h4 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
                    <Upload className="w-4 h-4 text-gold" />
                    {t(
                      'payment.attach_file'
                    )}
                  </h4>

                  <p className="text-xs text-white/40 mb-3">
                    {t(
                      'payment.file_support'
                    )}
                  </p>

                  {!fileUrl ? (
                    <div className="space-y-3">
                      <input
                        type="file"
                        id="file-upload"
                        onChange={
                          handleFileChange
                        }
                        className="hidden"
                        accept=".jpg,.jpeg,.png,.pdf,.doc,.docx"
                      />

                      <label
                        htmlFor="file-upload"
                        className="block cursor-pointer rounded-lg border-2 border-dashed border-white/10 bg-white/5 px-4 py-3 text-center text-sm text-white/50 hover:border-gold/30 hover:bg-white/10 transition-all"
                      >
                        {file ? (
                          <span className="flex items-center justify-center gap-2 text-white/80">
                            <File className="w-4 h-4" />
                            {file.name}
                          </span>
                        ) : (
                          <span>
                            {t(
                              'payment.click_to_select_file'
                            )}
                          </span>
                        )}
                      </label>

                      {uploadError && (
                        <div className="text-red-400 text-xs bg-red-500/10 border border-red-500/20 rounded-lg p-2 flex items-center justify-between">
                          <span>
                            {uploadError}
                          </span>

                          <button
                            onClick={() =>
                              setUploadError(
                                null
                              )
                            }
                            className="text-red-400 hover:text-red-300"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      )}

                      {file && (
                        <div className="flex gap-3">
                          <button
                            onClick={
                              handleFileUpload
                            }
                            disabled={
                              uploading
                            }
                            className="flex-1 py-2 bg-gold/20 border border-gold/30 rounded-lg text-sm text-gold hover:bg-gold/30 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
                          >
                            {uploading ? (
                              <>
                                <Loader2 className="w-4 h-4 animate-spin" />
                                {t(
                                  'payment.uploading'
                                )}
                              </>
                            ) : (
                              <>
                                <Upload className="w-4 h-4" />
                                {t(
                                  'payment.upload_file'
                                )}
                              </>
                            )}
                          </button>

                          <button
                            onClick={
                              handleRemoveFile
                            }
                            className="px-4 py-2 border border-white/10 rounded-lg text-sm text-white/40 hover:text-white/70 hover:border-white/20 transition-all"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-3 flex items-center justify-between">
                      <div className="flex items-center gap-2 text-green-300 text-sm">
                        <Check className="w-4 h-4" />
                        <span>
                          {t(
                            'payment.file_uploaded'
                          )}
                        </span>
                      </div>

                      <span className="text-gold text-sm flex items-center gap-1">
                        <File className="w-3 h-3" />
                        تم الرفع
                      </span>
                    </div>
                  )}
                </div>
              )}

              <button
                onClick={
                  handleGoToDashboard
                }
                className="w-full btn-primary flex items-center justify-center gap-2 mt-6"
              >
                {t(
                  'payment.go_to_dashboard'
                )}
                <ArrowRight className="w-4 h-4" />
              </button>
            </>
          )}
        </motion.div>
      </div>
    </div>
  )
}

export default PaymentPage