/**
 * تثبيت عنصر مغادر في مكانه وحجمه قبل أن يتلاشى، كي لا يشدّ جيرانه ولا يتغيّر عرضه.
 * قياسات تخطيط فعلية (px) وليست تنسيقاً اتجاهياً، لذا تصح في RTL.
 * الحاوية يجب أن تكون عنصراً مُموضَعاً (relative/fixed/absolute).
 * يستعمله ListTransition، ومباشرةً أي `TransitionGroup` يُعرَض على الخادم (انظر ToastViewport).
 */
export function pinElement(el: Element): void {
  const target = el as HTMLElement
  target.style.position = 'absolute'
  target.style.width = `${target.offsetWidth}px`
  target.style.height = `${target.offsetHeight}px`
  target.style.left = `${target.offsetLeft}px`
  target.style.top = `${target.offsetTop}px`
  target.style.margin = '0'
}
