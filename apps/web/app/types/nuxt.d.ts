declare module '#app' {
  interface PageMeta {
    /** صلاحية (أو صلاحيات — يكفي واحدة) مطلوبة لفتح الصفحة */
    permission?: string | string[]
    /** عنوان الصفحة في الترويسة */
    title?: string
  }
}

export {}
