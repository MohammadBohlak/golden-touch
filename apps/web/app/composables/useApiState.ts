import type { Ref } from 'vue'
import { toApiError, type ApiError } from '~/utils/handle-error'

interface CacheEntry {
  data: unknown
  expires: number
}

/** كاش في الذاكرة مشترك بين كل الاستدعاءات (على المتصفح فقط) */
const memoryCache = new Map<string, CacheEntry>()

/** إبطال الكاش: كل شيء، أو المفاتيح التي تبدأ بـ prefix */
export function invalidateApiCache(prefix?: string): void {
  if (!prefix) return memoryCache.clear()
  for (const key of memoryCache.keys()) if (key.startsWith(prefix)) memoryCache.delete(key)
}

export interface UseApiStateOptions<TRaw, T, A extends unknown[]> {
  /** تنفيذ تلقائي عند التركيب (true أو مصفوفة وسائط) */
  immediate?: boolean | A
  transform?: (raw: TRaw) => T
  onSuccess?: (data: T) => void
  onError?: (error: ApiError) => void
  cacheKey?: string | ((...args: A) => string)
  /** مدة صلاحية الكاش بالميلي ثانية (افتراضياً دقيقة) */
  ttl?: number
  initialData?: T
}

/**
 * حالة طلب موحّدة: loading / data / error / errorMessage
 * - يلغي الطلب السابق تلقائياً (AbortController) ويتجاهل الإلغاء بصمت
 * - كاش اختياري بـ cacheKey + ttl، وتجاوزه بـ forceExecute أو refresh
 */
export function useApiState<TRaw, T = TRaw, A extends unknown[] = []>(
  fetcher: (signal: AbortSignal, ...args: A) => Promise<TRaw>,
  options: UseApiStateOptions<TRaw, T, A> = {},
) {
  const data = shallowRef(options.initialData ?? null) as Ref<T | null>
  const error = shallowRef<ApiError | null>(null)
  const loading = ref(Boolean(options.immediate))
  const errorMessage = computed(() => error.value?.message ?? '')

  let controller: AbortController | null = null
  let lastArgs = [] as unknown as A
  let lastKey: string | undefined

  const keyFor = (args: A) =>
    typeof options.cacheKey === 'function' ? options.cacheKey(...args) : options.cacheKey

  async function run(args: A, force: boolean): Promise<T | null> {
    lastArgs = args
    const key = keyFor(args)
    lastKey = key

    if (key && !force) {
      const hit = memoryCache.get(key)
      if (hit && hit.expires > Date.now()) {
        controller?.abort()
        data.value = hit.data as T
        error.value = null
        loading.value = false
        return data.value
      }
    }

    controller?.abort()
    const current = new AbortController()
    controller = current
    loading.value = true
    error.value = null

    try {
      const raw = await fetcher(current.signal, ...args)
      if (controller !== current) return data.value
      const result = options.transform ? options.transform(raw) : (raw as unknown as T)
      data.value = result
      if (key) memoryCache.set(key, { data: result, expires: Date.now() + (options.ttl ?? 60_000) })
      options.onSuccess?.(result)
      return result
    } catch (caught) {
      const apiError = toApiError(caught)
      if (apiError.aborted || controller !== current) return null
      error.value = apiError
      options.onError?.(apiError)
      return null
    } finally {
      if (controller === current) {
        controller = null
        loading.value = false
      }
    }
  }

  const execute = (...args: A) => run(args, false)
  const forceExecute = (...args: A) => run(args, true)
  const refresh = () => run(lastArgs, true)

  function abort(): void {
    controller?.abort()
    controller = null
    loading.value = false
  }

  function invalidate(): void {
    if (lastKey) memoryCache.delete(lastKey)
  }

  if (options.immediate && import.meta.client) {
    onMounted(() => {
      const args = (Array.isArray(options.immediate) ? options.immediate : []) as A
      void run(args, false)
    })
  }
  if (getCurrentScope()) onScopeDispose(abort)

  return { data, error, errorMessage, loading, execute, forceExecute, refresh, abort, invalidate }
}
