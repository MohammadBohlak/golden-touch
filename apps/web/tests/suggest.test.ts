import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
// نسخة الخادم: يجب أن تطابق نسخة الواجهة تماماً (لا حزمة مشتركة في المشروع)
import { normalizeArabic as serverNormalize } from '../../api/src/common/utils/arabic.ts'
import { normalizeArabic } from '../app/utils/arabic.ts'
import { rankSuggestions, splitHighlight } from '../app/utils/suggest.ts'

describe('splitHighlight', () => {
  it('يقسم حول أول تطابق ويحفظ النص الأصلي', () => {
    assert.deepEqual(splitHighlight('محمد سمير', 'سمي'), {
      before: 'محمد ',
      match: 'سمي',
      after: 'ر',
    })
    assert.deepEqual(splitHighlight('محمد سمير', 'محم'), {
      before: '',
      match: 'محم',
      after: 'د سمير',
    })
  })

  it('بلا حساسية لحالة الأحرف اللاتينية ويحفظ حالتها الأصلية', () => {
    assert.deepEqual(splitHighlight('John Smith', 'smi'), {
      before: 'John ',
      match: 'Smi',
      after: 'th',
    })
  })

  it('لا تطابق أو استعلام فارغ: النص كله في before', () => {
    assert.deepEqual(splitHighlight('أحمد', 'خالد'), { before: 'أحمد', match: '', after: '' })
    assert.deepEqual(splitHighlight('أحمد', '   '), { before: 'أحمد', match: '', after: '' })
  })

  it('يتجاهل المسافات الزائدة حول الاستعلام', () => {
    assert.deepEqual(splitHighlight('أحمد علي', ' أحم '), {
      before: '',
      match: 'أحم',
      after: 'د علي',
    })
  })
})

describe('rankSuggestions', () => {
  const names = (list: { name: string }[]) => list.map((c) => c.name)
  const items = [
    { name: 'سامر أحمد' }, // يحوي «أحم» (الأحدث نشاطاً)
    { name: 'أحمد علي' }, // يبدأ بـ «أحم»
    { name: 'خالد' }, // لا يطابق (وصل من استعلام سابق)
    { name: 'محمد أحمد' }, // يحوي
    { name: 'أحمد سمير' }, // يبدأ
  ]

  it('ما يبدأ بالاستعلام أولاً ثم ما يحويه، وترتيب الخادم محفوظ داخل كل مجموعة', () => {
    assert.deepEqual(names(rankSuggestions(items, 'أحم')), [
      'أحمد علي',
      'أحمد سمير',
      'سامر أحمد',
      'محمد أحمد',
    ])
  })

  it('يستبعد ما لم يعد يطابق ما كُتب (تابع المستخدم الكتابة)', () => {
    assert.deepEqual(names(rankSuggestions(items, 'أحمد ع')), ['أحمد علي'])
    assert.deepEqual(rankSuggestions(items, 'ز'), [])
  })

  it('استعلام فارغ ← لا اقتراحات', () => {
    assert.deepEqual(rankSuggestions(items, '  '), [])
  })

  it('استعلام هاتف: يُترك كما أرجعه الخادم', () => {
    assert.deepEqual(names(rankSuggestions(items, '099 123')), names(items))
  })

  it('يحترم الحدّ الأقصى', () => {
    const many = Array.from({ length: 10 }, (_, i) => ({ name: `أحمد ${i}` }))
    assert.equal(rankSuggestions(many, 'أحمد').length, 6)
    assert.equal(rankSuggestions(many, 'أحمد', 3).length, 3)
  })
})

describe('التوحيد العربي', () => {
  const corpus = [
    'أحمد',
    'احمد',
    'إحمد',
    'آمنة',
    'فاطمة',
    'فاطمه',
    'ليلى',
    'مؤمن',
    'رئيس',
    'مُحَمَّد',
    'محـــمد',
    '  أحمد   علي  ',
    'John SMITH',
    'سامر 123',
    'ٱلله',
    '\tأحمد\nعلي',
    'الأَمِيرَةُ',
    '',
  ]

  it('نسخة الواجهة تطابق نسخة الخادم حرفياً على العيّنات', () => {
    for (const text of corpus)
      assert.equal(normalizeArabic(text), serverNormalize(text), JSON.stringify(text))
  })

  it('«احمد» تتطابق مع «أحمد» و«إحمد»، و«فاطمه» مع «فاطمة»', () => {
    assert.equal(normalizeArabic('احمد'), normalizeArabic('أحمد'))
    assert.equal(normalizeArabic('احمد'), normalizeArabic('إحمد'))
    assert.equal(normalizeArabic('فاطمه'), normalizeArabic('فاطمة'))
  })

  it('الإبراز يحافظ على النص الأصلي بهمزاته', () => {
    assert.deepEqual(splitHighlight('أحمد علي', 'احم'), {
      before: '',
      match: 'أحم',
      after: 'د علي',
    })
    assert.deepEqual(splitHighlight('فاطمة', 'فاطمه'), { before: '', match: 'فاطمة', after: '' })
  })

  it('الإبراز يشمل التشكيل ولا ينزاح بسببه', () => {
    assert.deepEqual(splitHighlight('مُحَمَّد علي', 'محمد'), {
      before: '',
      match: 'مُحَمَّد',
      after: ' علي',
    })
    assert.deepEqual(splitHighlight('عبد مُحَمَّد', 'محم'), {
      before: 'عبد ',
      match: 'مُحَمَّ',
      after: 'د',
    })
  })

  it('الإبراز مع مسافات زائدة في الاسم الأصلي', () => {
    assert.deepEqual(splitHighlight('محمد   سمير', 'سمير'), {
      before: 'محمد   ',
      match: 'سمير',
      after: '',
    })
    assert.deepEqual(splitHighlight('محمد   سمير', 'محمد سمير'), {
      before: '',
      match: 'محمد   سمير',
      after: '',
    })
  })

  it('الترتيب يتجاهل الهمزات: «احمد» تجلب «أحمد» أولاً (يبدأ) ثم «سامر أحمد» (يحوي)', () => {
    const items = [
      { name: 'سامر أحمد' },
      { name: 'أحمد علي' },
      { name: 'خالد' },
      { name: 'إحمد سمير' },
    ]
    assert.deepEqual(
      rankSuggestions(items, 'احمد').map((c) => c.name),
      ['أحمد علي', 'إحمد سمير', 'سامر أحمد'],
    )
  })
})
