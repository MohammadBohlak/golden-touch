import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  canPreview,
  countAppointments,
  createBody,
  describeRecurrence,
  describeServices,
  formatClockTime,
  ISSUE_LABELS,
  issueLine,
  INTERVAL_OPTIONS,
  isUpcomingRecurring,
  issuesTitle,
  moveItem,
  nextLabel,
  nextWeekdayDate,
  parseRecurringPrefill,
  patchBody,
  previewBody,
  recurringQueryFrom,
  rotationCaption,
  STATUS_LABELS,
  type RecurringFormValues,
} from '../app/utils/recurrence.ts'

describe('describeRecurrence', () => {
  it('أسبوعي: «كل سبت»', () => {
    assert.equal(describeRecurrence(6, 1), 'كل سبت')
    assert.equal(describeRecurrence(0, 1), 'كل أحد')
  })

  it('أسبوع نعم وأسبوع لا: «كل أسبوعين يوم السبت»', () => {
    assert.equal(describeRecurrence(6, 2), 'كل أسبوعين يوم السبت')
  })

  it('3 و4 أسابيع', () => {
    assert.equal(describeRecurrence(3, 3), 'كل 3 أسابيع يوم الأربعاء')
    assert.equal(describeRecurrence(5, 4), 'كل 4 أسابيع يوم الجمعة')
  })
})

describe('formatClockTime', () => {
  it('12 ساعة بلا إزاحة منطقة زمنية', () => {
    assert.match(formatClockTime('17:00'), /^5:00\s?م$/)
    assert.match(formatClockTime('09:30'), /^9:30\s?ص$/)
    assert.match(formatClockTime('00:15'), /^12:15\s?ص$/)
  })
})

describe('describeServices', () => {
  it('خدمة واحدة باسمها', () => {
    assert.equal(describeServices(['شعر']), 'شعر')
  })

  it('تناوب بالترتيب مع التكرار', () => {
    assert.equal(describeServices(['شعر', 'لحية']), 'تتناوب: شعر ← لحية')
    assert.equal(describeServices(['شعر', 'شعر', 'لحية']), 'تتناوب: شعر ← شعر ← لحية')
  })

  it('بلا خدمات: شرطة', () => {
    assert.equal(describeServices([]), '—')
  })
})

describe('الجمع العربي', () => {
  it('countAppointments', () => {
    assert.equal(countAppointments(1), 'موعد واحد')
    assert.equal(countAppointments(2), 'موعدان')
    assert.equal(countAppointments(3), '3 مواعيد')
    assert.equal(countAppointments(10), '10 مواعيد')
    assert.equal(countAppointments(11), '11 موعداً')
  })

  it('issuesTitle: المفعول به منصوب في المثنى', () => {
    assert.equal(issuesTitle(1), 'تعذّر إنشاء موعد واحد')
    assert.equal(issuesTitle(2), 'تعذّر إنشاء موعدين')
    assert.equal(issuesTitle(5), 'تعذّر إنشاء 5 مواعيد')
  })
})

describe('المشكلات والحالات', () => {
  it('لكل سبب نص عربي غير فارغ، وكل حالة تسمية', () => {
    for (const reason of ['CLOSED', 'OUTSIDE_HOURS', 'SERVICE_UNAVAILABLE', 'CONFLICT'] as const) {
      assert.ok(ISSUE_LABELS[reason].length > 0)
    }
    assert.deepEqual(Object.keys(STATUS_LABELS).sort(), ['ACTIVE', 'ENDED', 'STOPPED'])
  })

  it('issueLine: اسم اليوم والتاريخ ثم السبب', () => {
    assert.equal(
      issueLine({ date: '2026-10-31', reason: 'CONFLICT' }),
      'السبت، 31 تشرين الأول — يتعارض مع حجز آخر',
    )
  })

  it('nextLabel: غداً · الوقت بتوقيت الصالون', () => {
    // 14:00Z = 17:00 دمشق
    const label = nextLabel(
      { date: '2026-10-17', startAt: '2026-10-17T14:00:00Z' },
      '2026-10-16',
      'Asia/Damascus',
    )
    assert.match(label, /^غداً · 5:00\s?م$/)
  })
})

describe('nextWeekdayDate', () => {
  // 2026-10-16 جمعة
  it('أول تاريخ ≥ المعطى في يوم الأسبوع', () => {
    assert.equal(nextWeekdayDate('2026-10-16', 6), '2026-10-17') // السبت
    assert.equal(nextWeekdayDate('2026-10-16', 0), '2026-10-18') // الأحد
    assert.equal(nextWeekdayDate('2026-10-16', 4), '2026-10-22') // الخميس
  })

  it('نفس اليوم يبقى كما هو', () => {
    assert.equal(nextWeekdayDate('2026-10-16', 5), '2026-10-16')
  })

  it('يعبر حدود الشهر والسنة', () => {
    assert.equal(nextWeekdayDate('2026-12-30', 6), '2027-01-02')
  })
})

describe('moveItem', () => {
  it('ينقل خطوة للأعلى أو للأسفل دون تعديل الأصل', () => {
    const list = ['a', 'b', 'c']
    assert.deepEqual(moveItem(list, 1, -1), ['b', 'a', 'c'])
    assert.deepEqual(moveItem(list, 1, 1), ['a', 'c', 'b'])
    assert.deepEqual(list, ['a', 'b', 'c'])
  })

  it('خارج الحدود: لا تغيير', () => {
    assert.deepEqual(moveItem(['a', 'b'], 0, -1), ['a', 'b'])
    assert.deepEqual(moveItem(['a', 'b'], 1, 1), ['a', 'b'])
    assert.deepEqual(moveItem(['a', 'b'], 5, -1), ['a', 'b'])
  })
})

describe('rotationCaption / INTERVAL_OPTIONS', () => {
  it('خدمة واحدة: لا وصف تناوب', () => {
    assert.equal(rotationCaption(['شعر']), null)
    assert.equal(rotationCaption([]), null)
  })

  it('ترتيب الموعد ثم «ثم يتكرر»', () => {
    assert.equal(
      rotationCaption(['شعر', 'لحية', 'شعر']),
      'الأول: شعر · الثاني: لحية · الثالث: شعر · ثم يتكرر',
    )
  })

  it('خيارات التكرار 1–4 بتسميات', () => {
    assert.deepEqual(
      INTERVAL_OPTIONS.map((o) => o.value),
      [1, 2, 3, 4],
    )
  })
})

describe('جسم الطلبات', () => {
  const values = (over: Partial<RecurringFormValues> = {}): RecurringFormValues => ({
    startDate: '2026-10-17',
    startTime: '17:00',
    intervalWeeks: 2,
    serviceIds: ['s1', 's2'],
    endDate: null,
    notes: '',
    ...over,
  })
  const original = {
    id: 'r1',
    customer: { id: 'c1', name: 'زبون', phone: null },
    startDate: '2026-10-03', // بدأت في الماضي
    startTime: '17:00',
    intervalWeeks: 2,
    endDate: null,
    notes: null,
    services: [
      { id: 's1', name: 'شعر', durationMinutes: 30 },
      { id: 's2', name: 'لحية', durationMinutes: 45 },
    ],
  }

  it('canPreview: تاريخ ووقت صالحان وكل الخدمات مختارة', () => {
    assert.equal(canPreview(values()), true)
    assert.equal(canPreview(values({ startTime: '' })), false)
    assert.equal(canPreview(values({ startTime: '25:00' })), false)
    assert.equal(canPreview(values({ startDate: '' })), false)
    assert.equal(canPreview(values({ serviceIds: [] })), false)
    assert.equal(canPreview(values({ serviceIds: ['s1', ''] })), false)
  })

  it('createBody: يحذف الفارغ ويقصّ الملاحظات', () => {
    assert.deepEqual(createBody(values({ notes: '  قصة قصيرة ' }), 'c1'), {
      customerId: 'c1',
      startDate: '2026-10-17',
      startTime: '17:00',
      intervalWeeks: 2,
      serviceIds: ['s1', 's2'],
      endDate: undefined,
      notes: 'قصة قصيرة',
    })
    assert.equal(createBody(values({ notes: '   ' }), 'c1').notes, undefined)
  })

  it('patchBody: لا يرسل startDate إن لم يتغيّر (سلسلة بدأت في الماضي)', () => {
    const body = patchBody(original, values({ startDate: '2026-10-03', startTime: '18:00' }), 'c1')
    assert.deepEqual(body, { startTime: '18:00' })
  })

  it('patchBody: التغييرات كلها، ومسح endDate وnotes', () => {
    const withEnd = { ...original, endDate: '2026-12-01', notes: 'قديمة' }
    const body = patchBody(
      withEnd,
      values({ startDate: '2026-10-03', serviceIds: ['s2', 's1'], endDate: null, notes: '' }),
      'c9',
    )
    assert.deepEqual(body, { serviceIds: ['s2', 's1'], endDate: null, customerId: 'c9', notes: '' })
  })

  it('patchBody: بلا تغيير ← جسم فارغ', () => {
    assert.deepEqual(patchBody(original, values({ startDate: '2026-10-03' }), 'c1'), {})
  })

  it('previewBody: كامل للجديدة، وللتعديل المتغيّر فقط مع seriesId', () => {
    assert.deepEqual(previewBody(values()), {
      startDate: '2026-10-17',
      startTime: '17:00',
      intervalWeeks: 2,
      serviceIds: ['s1', 's2'],
      endDate: null,
    })
    assert.deepEqual(previewBody(values({ startDate: '2026-10-03', intervalWeeks: 1 }), original), {
      seriesId: 'r1',
      intervalWeeks: 1,
    })
  })
})

describe('isUpcomingRecurring', () => {
  const now = new Date('2026-10-16T12:00:00Z')
  it('دوري لم ينتهِ ← نعم', () => {
    assert.equal(
      isUpcomingRecurring({ recurringId: 'r1', endAt: '2026-10-17T14:30:00Z' }, now),
      true,
    )
  })
  it('دوري انتهى ← لا', () => {
    assert.equal(
      isUpcomingRecurring({ recurringId: 'r1', endAt: '2026-10-16T11:30:00Z' }, now),
      false,
    )
  })
  it('حجز عادي ← لا', () => {
    assert.equal(
      isUpcomingRecurring({ recurringId: null, endAt: '2026-10-17T14:30:00Z' }, now),
      false,
    )
  })
})

describe('«اجعله دورياً»', () => {
  it('recurringQueryFrom: بعد أسبوع من الحجز بالوقت المحلي', () => {
    // 2026-10-16 17:00 دمشق = 14:00Z
    assert.deepEqual(
      recurringQueryFrom(
        {
          customer: { id: 'c1', name: 'زبون', phone: null },
          serviceId: 's1',
          startAt: '2026-10-16T14:00:00Z',
        },
        'Asia/Damascus',
      ),
      { customerId: 'c1', serviceId: 's1', date: '2026-10-23', time: '17:00' },
    )
  })

  it('parseRecurringPrefill: يقبل الصحيح ويتجاهل المشوّه', () => {
    assert.deepEqual(
      parseRecurringPrefill({ date: '2026-10-23', time: '17:00', serviceId: 's1' }),
      {
        date: '2026-10-23',
        time: '17:00',
        serviceId: 's1',
      },
    )
    assert.deepEqual(parseRecurringPrefill({ date: '23/10', time: '25:00', serviceId: '' }), {
      date: undefined,
      time: undefined,
      serviceId: undefined,
    })
    assert.deepEqual(parseRecurringPrefill({ date: ['x'] }), {
      date: undefined,
      time: undefined,
      serviceId: undefined,
    })
  })
})
