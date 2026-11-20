import { normalizePhone, phoneSearchFilters, phoneVariants, syrianNational } from './phone'

describe('syrianNational', () => {
  it.each([
    '0991234567',
    '963991234567',
    '+963991234567',
    '00963991234567',
    '+9630991234567'.replace('0991', '991'),
  ])('%s ← 991234567', (value) => {
    expect(syrianNational(value)).toBe('991234567')
  })

  it.each(['+971501234567', '00971501234567', '991234567', '0123', '00441234567'])(
    '%s ليس سورياً',
    (value) => {
      expect(syrianNational(value)).toBeNull()
    },
  )
})

describe('phoneVariants', () => {
  const expected = ['0991234567', '963991234567', '+963991234567', '00963991234567']

  it.each(['0991234567', '963991234567', '+963991234567', '00963991234567'])(
    '%s يطابق الصيغ الأربع',
    (value) => {
      expect(phoneVariants(value).sort()).toEqual([...expected].sort())
    },
  )

  it('الأرقام العربية والفراغات بعد normalizePhone', () => {
    const phone = normalizePhone('+٩٦٣ ٩٩١ ٢٣٤ ٥٦٧')!
    expect(phoneVariants(phone)).toContain('0991234567')
  })

  it('رقم غير سوري: نفسه فقط', () => {
    expect(phoneVariants('+971501234567')).toEqual(['+971501234567'])
  })
})

describe('phoneSearchFilters', () => {
  it('نص بلا أرقام ← لا شروط', () => {
    expect(phoneSearchFilters('أحمد')).toEqual([])
    expect(phoneSearchFilters(undefined)).toEqual([])
  })

  it('جزء من الرقم بلا مفتاح: احتواء فقط (يطابق كل الصيغ أصلاً)', () => {
    expect(phoneSearchFilters('99123')).toEqual([{ contains: '99123' }])
  })

  it.each(['0991', '٠٩٩١', '+96399 1', '963991', '00963991'])(
    '%s ← يجد 0991… و963991… و+963991… و00963991… بالبداية',
    (input) => {
      const filters = phoneSearchFilters(input)
      const starts = filters.flatMap((f) => ('startsWith' in f ? [f.startsWith] : []))
      const all = ['0991', '963991', '+963991', '00963991']
      for (const v of all) {
        expect(v === normalizePhone(input) || starts.includes(v)).toBe(true)
      }
    },
  )

  it('بادئة فقط (0 أو 963) بلا بقية ← لا توسيع واسع', () => {
    expect(phoneSearchFilters('0')).toEqual([{ contains: '0' }])
    expect(phoneSearchFilters('963')).toEqual([{ contains: '963' }])
  })
})
