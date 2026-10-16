/** تحويل أي خطأ (ofetch / شبكة / إلغاء) إلى رسالة عربية موحّدة — ملف نقي */

export interface ApiError {
  status: number
  message: string
  errors?: Record<string, string[]>
  /** الطلب أُلغي عمداً (AbortController) — يُتجاهل بصمت */
  aborted?: boolean
}

const STATUS_MESSAGES: Record<number, string> = {
  400: 'الطلب غير صالح',
  401: 'انتهت الجلسة، يرجى تسجيل الدخول مجدداً',
  403: 'ليس لديك صلاحية للقيام بهذا الإجراء',
  404: 'العنصر المطلوب غير موجود',
  409: 'تعارض مع بيانات موجودة',
  422: 'البيانات المدخلة غير صالحة',
  429: 'محاولات كثيرة، انتظر قليلاً ثم أعد المحاولة',
  500: 'حدث خطأ في الخادم، حاول مجدداً',
  502: 'الخادم غير متاح حالياً، حاول بعد قليل',
  503: 'الخدمة غير متاحة مؤقتاً، حاول بعد قليل',
  504: 'انتهت مهلة الاتصال بالخادم',
}

const NETWORK_MESSAGE = 'تعذّر الاتصال — تحقق من الإنترنت وحاول مجدداً'

interface FetchLikeError {
  name?: string
  message?: string
  statusCode?: number
  status?: number
  data?: unknown
  response?: { status?: number; _data?: unknown }
  cause?: unknown
}

function isAbort(error: FetchLikeError): boolean {
  const cause = error.cause as FetchLikeError | undefined
  return error.name === 'AbortError' || cause?.name === 'AbortError'
}

export function toApiError(error: unknown): ApiError {
  if (!error || typeof error !== 'object') return { status: 0, message: NETWORK_MESSAGE }
  const e = error as FetchLikeError
  if (isAbort(e)) return { status: 0, message: 'تم إلغاء الطلب', aborted: true }

  const status = e.response?.status ?? e.statusCode ?? e.status ?? 0
  const body = (e.response?._data ?? e.data) as
    { message?: unknown; errors?: Record<string, string[]> } | undefined

  if (!status) return { status: 0, message: NETWORK_MESSAGE }

  const serverMessage = typeof body?.message === 'string' ? body.message : undefined
  const message =
    serverMessage && /[؀-ۿ]/.test(serverMessage)
      ? serverMessage
      : (STATUS_MESSAGES[status] ?? STATUS_MESSAGES[500]!)
  return body?.errors ? { status, message, errors: body.errors } : { status, message }
}

/** أول رسالة لكل حقل — جاهزة لـ vee-validate setErrors */
export function fieldErrors(
  error: ApiError,
  rename: Record<string, string> = {},
): Record<string, string> {
  return Object.fromEntries(
    Object.entries(error.errors ?? {}).map(([field, messages]) => [
      rename[field] ?? field,
      messages[0] ?? '',
    ]),
  )
}
