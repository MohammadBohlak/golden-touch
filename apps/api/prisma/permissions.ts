/**
 * تعريف الصلاحيات والأدوار — مصدر واحد يستورده الـ seed واختبار المصفوفة.
 * بلا أي استيراد: يعمل مباشرة في Node (type stripping) وفي Jest.
 *
 * عند تغيير قوائم الأدوار هنا، أضف migration بيانات مطابقاً (الإنتاج يشغّل
 * `db:migrate` ولا يشغّل `db:seed`) — انظر migrations/*_staff_restrictions.
 */
export const PERMISSIONS: Array<[key: string, description: string]> = [
  ['users.read', 'عرض المستخدمين'],
  ['users.create', 'إضافة مستخدم'],
  ['users.update', 'تعديل مستخدم'],
  ['users.delete', 'حذف مستخدم'],
  ['roles.read', 'عرض الأدوار والصلاحيات'],
  ['services.read', 'عرض الخدمات'],
  ['services.create', 'إضافة خدمة'],
  ['services.update', 'تعديل خدمة'],
  ['services.delete', 'حذف خدمة'],
  ['customers.read', 'عرض الزبائن'],
  ['customers.create', 'إضافة زبون'],
  ['customers.update', 'تعديل زبون'],
  ['customers.delete', 'حذف زبون'],
  ['bookings.read', 'عرض الحجوزات'],
  ['bookings.create', 'إنشاء حجز'],
  ['bookings.update', 'تعديل حجز'],
  ['bookings.complete', 'إكمال حجز وتسجيل الدفع'],
  ['bookings.cancel', 'إلغاء حجز'],
  ['bookings.delete', 'حذف حجز نهائياً'],
  ['bookings.history', 'عرض الحجوزات السابقة وسجل الزبائن'],
  ['finance.read', 'عرض الأسعار والمبالغ المالية'],
  ['recurring.read', 'عرض الحجوزات الدورية'],
  ['recurring.manage', 'إنشاء الحجوزات الدورية وتعديلها وإيقافها'],
  ['notifications.receive', 'استقبال إشعارات الحجوزات قبل موعدها'],
  ['stats.read', 'عرض الإحصائيات'],
  ['settings.read', 'عرض إعدادات الصالون'],
  ['settings.update', 'تعديل إعدادات الصالون'],
]

/**
 * مشرف الحجوزات: يدير الحجوزات الحالية والقادمة فقط.
 * ممنوع عليه: أي مال (finance.read)، السجل (bookings.history)، الإحصائيات، وتعديل الخدمات.
 * يستطيع «تأكيد» الحجز (bookings.complete) لكن بلا إدخال مبلغ: الـ API يسجّل سعر الحجز
 * تلقائياً ويرفض أي مبلغ صريح منه. راجع docs/STAFF_RESTRICTIONS_PLAN.md (D3, D11).
 */
export const STAFF_PERMISSIONS: string[] = [
  'services.read', // الاسم والمدة فقط — الـ API يحذف السعر عنه
  'customers.read',
  'customers.create', // إضافة زبون فقط — تعديل بياناته للمدير وحده
  'bookings.read',
  'bookings.create',
  'bookings.update',
  'bookings.complete', // تأكيد الحجز بسعره المحفوظ — لا يرى ولا يُدخل مبلغاً
  'bookings.cancel',
  'recurring.read', // لا مال ولا ماضٍ في الـ API الدوري (docs/RECURRING_BOOKINGS_PLAN.md D11, D12)
  'recurring.manage',
  'notifications.receive', // إشعار «موعد بعد 15 دقيقة»: اسم وخدمة ووقت فقط، بلا مال ولا سجل (docs/PUSH_NOTIFICATIONS_PLAN.md D1)
  'settings.read',
]
