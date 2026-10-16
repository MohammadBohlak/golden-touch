import { setLocale } from 'yup'

/** رسائل yup الافتراضية بالعربية (الحقول تستخدم label لتسمية واضحة) */
export default defineNuxtPlugin({
  name: 'yup-locale',
  setup() {
    setLocale({
      mixed: {
        required: ({ label }) => (label ? `${label} مطلوب` : 'هذا الحقل مطلوب'),
        notType: ({ label }) => (label ? `${label} غير صالح` : 'القيمة غير صالحة'),
        oneOf: 'القيمة المختارة غير مسموحة',
        defined: 'هذا الحقل مطلوب',
      },
      string: {
        email: 'البريد الإلكتروني غير صالح',
        min: ({ min, label }) => `${label ?? 'النص'} يجب أن يكون ${min} أحرف على الأقل`,
        max: ({ max, label }) => `${label ?? 'النص'} يجب ألا يتجاوز ${max} حرفاً`,
        matches: ({ label }) => `${label ?? 'القيمة'} بصيغة غير صحيحة`,
        trim: 'أزل المسافات الزائدة',
      },
      number: {
        min: ({ min, label }) => `${label ?? 'القيمة'} يجب أن تكون ${min} على الأقل`,
        max: ({ max, label }) => `${label ?? 'القيمة'} يجب ألا تتجاوز ${max}`,
        integer: ({ label }) => `${label ?? 'القيمة'} يجب أن تكون عدداً صحيحاً`,
        positive: ({ label }) => `${label ?? 'القيمة'} يجب أن تكون أكبر من صفر`,
      },
      array: {
        min: ({ min }) => `اختر ${min} على الأقل`,
      },
    })
  },
})
