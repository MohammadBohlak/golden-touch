/**
 * قفل تمرير الصفحة بعدّاد مشترك بين كل الحوارات: إغلاق حوار فوق آخر (تأكيد فوق ورقة) لا يفكّ القفل
 * ما دام هناك حوار مفتوح. العدّاد على مستوى الوحدة (لا داخل المكوّن) كي يُشارَك بين النسخ — للعميل فقط.
 */
let locks = 0

/** يقفل التمرير ويعيد دالة تحرّر هذا القفل بعينه (آمنة للاستدعاء أكثر من مرة) */
export function acquireScrollLock(): () => void {
  if (locks++ === 0) document.documentElement.style.overflow = 'hidden'
  let released = false
  return () => {
    if (released) return
    released = true
    if (--locks <= 0) {
      locks = 0
      document.documentElement.style.overflow = ''
    }
  }
}
