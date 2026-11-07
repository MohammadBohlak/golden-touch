/**
 * «نمو» عند الظهور: يعيد `grown` يصير true بعد إطارين من التركيب، ويُعاد تسليحه (false ثم true)
 * كلما تغيّرت `signature`. اربط به `:key="signature"` على العناصر كي تُنشأ من جديد عند الصفر
 * فتنمو بـ transition بدل القفز (أعمدة مخطط، أشرطة نسب).
 * تقليل الحركة: true فوراً.
 */
export function useGrowIn(signature: () => string) {
  const grown = ref(false)
  let token = 0

  function arm() {
    const mine = ++token
    grown.value = false
    if (prefersReducedMotion()) {
      grown.value = true
      return
    }
    requestAnimationFrame(() =>
      requestAnimationFrame(() => {
        if (mine === token) grown.value = true
      }),
    )
  }

  onMounted(arm)
  watch(signature, arm)
  onBeforeUnmount(() => token++)

  return { grown, signature: computed(signature) }
}
