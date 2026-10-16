import type { Ref } from 'vue'

/** نسخة متأخرة من قيمة (للبحث أثناء الكتابة) */
export function useDebounced<T>(source: Ref<T>, delay = 350): Ref<T> {
  const debounced = ref(source.value) as Ref<T>
  let timer: ReturnType<typeof setTimeout> | undefined
  watch(source, (value) => {
    clearTimeout(timer)
    timer = setTimeout(() => (debounced.value = value), delay)
  })
  onScopeDispose(() => clearTimeout(timer))
  return debounced
}
