/** أنواع مشتركة لمكوّنات الواجهة */

export interface BarPoint {
  key: string
  label: string
  /** تسمية مختصرة تحت العمود */
  short: string
  value: number
}

export interface TableColumn {
  key: string
  label: string
  class?: string
  /** يُخفى في بطاقة الموبايل (مثلاً لأنه معروض في عنوانها) */
  hideOnMobile?: boolean
}
