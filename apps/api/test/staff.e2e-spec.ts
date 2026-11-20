/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * e2e لمشرف الحجوزات عبر طبقة HTTP الكاملة (JwtAuthGuard + PermissionsGuard + الفلاتر + الخدمات الحقيقية)
 * مع Prisma وهمي في الذاكرة — **لا يلمس أي قاعدة بيانات**.
 * (docs/STAFF_RESTRICTIONS_PLAN.md — المرحلة 6)
 *
 * عزل الإنتاج: نُغيّر DATABASE_URL/DIRECT_URL إلى عنوان ميت قبل استيراد التطبيق، فلو تسرّب PrismaClient
 * حقيقي لفشل الاتصال بدل أن يمسّ البيانات الفعلية. كذلك يُوجَّه keep-alive إلى منفذ ميت.
 */
process.env.DATABASE_URL = 'postgresql://e2e:e2e@127.0.0.1:1/e2e'
process.env.DIRECT_URL = 'postgresql://e2e:e2e@127.0.0.1:1/e2e'
process.env.KEEP_ALIVE_URL = 'http://127.0.0.1:9'
process.env.JWT_SECRET = 'e2e-secret-e2e-secret-e2e-secret-e2e-secret'
process.env.NODE_ENV = 'test'

import { randomUUID } from 'node:crypto'
import { INestApplication } from '@nestjs/common'
import { Test } from '@nestjs/testing'
import bcrypt from 'bcrypt'
import request from 'supertest'
import { PERMISSIONS, STAFF_PERMISSIONS } from '../prisma/permissions'
import { AppModule } from '../src/app.module'
import { addDays, toDateString } from '../src/common/utils/time'
import { PrismaService } from '../src/prisma/prisma.service'
import { historyCutoff } from '../src/modules/bookings/booking.visibility'
import { setupApp } from '../src/setup-app'

const TZ = 'Asia/Damascus'
const PASSWORD = 'e2e-password-1'
const HOUR = 3_600_000

// ───────────────────────── بيانات وهمية (نسبية لـ «الآن») ─────────────────────────

const ID = {
  adminUser: randomUUID(),
  staffUser: randomUUID(),
  s1: randomUUID(),
  s2: randomUUID(),
  c1: randomUUID(),
  past: randomUUID(),
  pastActive: randomUUID(),
  today: randomUUID(),
  todayDone: randomUUID(),
  future: randomUUID(),
}

const cutoff = historyCutoff(new Date(), TZ) // بداية اليوم بتوقيت دمشق
const at = (hours: number) => new Date(cutoff.getTime() + hours * HOUR)
const today = toDateString(new Date(), TZ)
const yesterday = addDays(today, -1)

const passwordHash = bcrypt.hashSync(PASSWORD, 4)
const user = (id: string, email: string, roleName: string, keys: string[]) => ({
  id,
  name: roleName,
  email,
  phone: null,
  passwordHash,
  isActive: true,
  roleId: 1,
  role: { id: 1, name: roleName, label: roleName, permissions: keys.map((key) => ({ key })) },
})

function booking(over: Record<string, unknown>) {
  const startAt = over.startAt as Date
  return {
    customerId: ID.c1,
    serviceId: ID.s1,
    serviceName: 'شعر',
    price: 25000,
    paidAmount: null,
    durationMinutes: 30,
    endAt: new Date(startAt.getTime() + 0.5 * HOUR),
    status: 'ACTIVE',
    notes: null,
    cancelReason: null,
    completedAt: null,
    cancelledAt: null,
    createdById: null,
    recurringId: null,
    occurrenceDate: null,
    recurringEdited: false,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...over,
  }
}

function freshDb() {
  return {
    users: [
      user(
        ID.adminUser,
        'admin@e2e.test',
        'admin',
        PERMISSIONS.map(([key]) => key),
      ),
      user(ID.staffUser, 'staff@e2e.test', 'staff', STAFF_PERMISSIONS),
    ],
    settings: {
      id: 1,
      shopName: 'Golden Touch',
      openTime: '10:00',
      closeTime: '22:00',
      slotMinutes: 15,
      timezone: TZ,
      daysOff: [] as number[],
      updatedAt: new Date(),
    },
    services: [
      {
        id: ID.s1,
        name: 'شعر',
        price: 25000,
        durationMinutes: 30,
        isActive: true,
        sortOrder: 1,
        archivedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: ID.s2,
        name: 'ذقن',
        price: 15000,
        durationMinutes: 20,
        isActive: true,
        sortOrder: 2,
        archivedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ] as any[],
    customers: [
      {
        id: ID.c1,
        name: 'زبون تجريبي',
        phone: '0991234567',
        notes: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ] as any[],
    bookings: [
      // أمس: مكتمل (25000) + قيد العمل لم يُغلق
      booking({
        id: ID.past,
        startAt: at(-20),
        status: 'COMPLETED',
        paidAmount: 25000,
        completedAt: at(-19),
      }),
      booking({ id: ID.pastActive, startAt: at(-18), price: 7000 }),
      // اليوم: قيد العمل بسعر خصّصه المدير (18000) + مكتمل
      booking({ id: ID.today, startAt: at(10), price: 18000 }),
      booking({
        id: ID.todayDone,
        startAt: at(12),
        status: 'COMPLETED',
        paidAmount: 25000,
        completedAt: at(12.5),
      }),
      // غداً
      booking({ id: ID.future, startAt: at(34) }),
    ] as any[],
    series: [] as any[],
  }
}

let db = freshDb()

// ───────────────────────── Prisma وهمي بالحد الأدنى المستعمل ─────────────────────────

const same = (a: unknown, b: unknown) =>
  a instanceof Date && b instanceof Date ? a.getTime() === b.getTime() : a === b
const num = (v: unknown) => (v instanceof Date ? v.getTime() : (v as number))

function matchValue(value: unknown, cond: unknown): boolean {
  if (cond === null || typeof cond !== 'object' || cond instanceof Date) return same(value, cond)
  return Object.entries(cond as Record<string, unknown>).every(([op, arg]) => {
    switch (op) {
      case 'gte':
        return num(value) >= num(arg)
      case 'gt':
        return num(value) > num(arg)
      case 'lte':
        return num(value) <= num(arg)
      case 'lt':
        return num(value) < num(arg)
      case 'in':
        return (arg as unknown[]).includes(value)
      case 'not':
        return !same(value, arg)
      default:
        throw new Error(`fake prisma: عامل غير مدعوم ${op}`)
    }
  })
}

function matches(row: any, where: Record<string, unknown> = {}): boolean {
  return Object.entries(where).every(([key, cond]) => {
    if (key === 'OR' || key === 'AND') throw new Error('fake prisma: OR/AND غير مدعومين')
    return matchValue(row[key], cond)
  })
}

function page<T extends Record<string, any>>(rows: T[], args: any = {}): T[] {
  let out = [...rows]
  const orderBy = Array.isArray(args.orderBy) ? args.orderBy[0] : args.orderBy
  if (orderBy) {
    const [field, dir] = Object.entries(orderBy)[0] as [string, 'asc' | 'desc']
    out.sort((a, b) => (num(a[field]) - num(b[field])) * (dir === 'desc' ? -1 : 1))
  }
  if (args.skip) out = out.slice(args.skip)
  if (args.take) out = out.slice(0, args.take)
  return out
}

const withRelations = (b: any) => ({
  ...b,
  customer: db.customers.find((c) => c.id === b.customerId)
    ? {
        id: b.customerId,
        name: db.customers.find((c) => c.id === b.customerId).name,
        phone: db.customers.find((c) => c.id === b.customerId).phone,
      }
    : null,
  createdBy: null,
  recurring: b.recurringId
    ? (() => {
        const r = db.series.find((x) => x.id === b.recurringId)
        return r ? { stoppedAt: r.stoppedAt, endDate: r.endDate } : null
      })()
    : null,
})

const withSeries = (r: any) => ({
  ...r,
  customer: (() => {
    const c = db.customers.find((x) => x.id === r.customerId)
    return { id: c.id, name: c.name, phone: c.phone }
  })(),
  services: [...r.services].sort((a: any, b: any) => a.position - b.position),
})

const fakePrisma: any = {
  user: {
    findUnique: async ({ where }: any) =>
      db.users.find((u) => (where.id ? u.id === where.id : u.email === where.email)) ?? null,
    update: async () => ({}),
  },
  shopSettings: {
    findUnique: async () => db.settings,
    create: async () => db.settings,
  },
  service: {
    findMany: async (args: any) =>
      page(
        db.services.filter((s) => matches(s, args.where)),
        args,
      ),
    findFirst: async ({ where }: any) => db.services.find((s) => matches(s, where)) ?? null,
    findUnique: async ({ where }: any) => db.services.find((s) => s.id === where.id) ?? null,
    aggregate: async () => ({ _max: { sortOrder: 2 } }),
    count: async () => 0,
    create: async ({ data }: any) => {
      const row = {
        id: randomUUID(),
        isActive: true,
        archivedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        ...data,
      }
      db.services.push(row)
      return row
    },
    update: async ({ where, data }: any) =>
      Object.assign(
        db.services.find((s) => s.id === where.id),
        data,
      ),
  },
  customer: {
    findUnique: async ({ where }: any) =>
      db.customers.find((c) => (where.id ? c.id === where.id : c.phone === where.phone)) ?? null,
    findMany: async (args: any) =>
      page(
        db.customers.filter(
          (c) =>
            (!args?.where?.phone?.in || args.where.phone.in.includes(c.phone)) &&
            (!args?.where?.id?.not || c.id !== args.where.id.not),
        ),
        args,
      ).map((c) => ({
        ...c,
        _count: {
          bookings: db.bookings.filter((b) => b.customerId === c.id && b.status === 'COMPLETED')
            .length,
        },
      })),
    count: async ({ where }: any = {}) => db.customers.filter((c) => matches(c, where)).length,
    create: async ({ data }: any) => {
      const row = {
        id: randomUUID(),
        notes: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        ...data,
      }
      db.customers.push(row)
      return row
    },
    update: async ({ where, data }: any) => {
      const row = db.customers.find((c) => c.id === where.id)
      Object.assign(row, Object.fromEntries(Object.entries(data).filter(([, v]) => v !== undefined)))
      return row
    },
  },
  booking: {
    findMany: async (args: any) =>
      page(
        db.bookings.filter((b) => matches(b, args.where)),
        args,
      ).map(withRelations),
    findFirst: async (args: any) => {
      const row = db.bookings.find((b) => matches(b, args.where))
      return row ? withRelations(row) : null
    },
    findUnique: async ({ where }: any) => {
      const row = db.bookings.find((b) => b.id === where.id)
      return row ? withRelations(row) : null
    },
    count: async ({ where }: any = {}) => db.bookings.filter((b) => matches(b, where)).length,
    aggregate: async ({ where }: any) => {
      const rows = db.bookings.filter((b) => matches(b, where))
      return {
        _count: rows.length,
        _sum: { paidAmount: rows.reduce((s, b) => s + (b.paidAmount ?? 0), 0) },
        _max: {
          startAt: rows.length ? new Date(Math.max(...rows.map((b) => b.startAt.getTime()))) : null,
        },
      }
    },
    groupBy: async ({ where }: any) => {
      const rows = db.bookings.filter(
        (b) => b.status === where.status && where.customerId.in.includes(b.customerId),
      )
      return [...new Set(rows.map((b) => b.customerId))].map((customerId) => ({
        customerId,
        _max: {
          startAt: new Date(
            Math.max(
              ...rows.filter((b) => b.customerId === customerId).map((b) => b.startAt.getTime()),
            ),
          ),
        },
      }))
    },
    create: async ({ data }: any) => {
      const row = booking({ id: randomUUID(), status: 'ACTIVE', ...data })
      db.bookings.push(row)
      return withRelations(row)
    },
    update: async ({ where, data }: any) =>
      withRelations(
        Object.assign(
          db.bookings.find((b) => b.id === where.id),
          data,
        ),
      ),
    delete: async ({ where }: any) => {
      db.bookings = db.bookings.filter((b) => b.id !== where.id)
    },
    createMany: async ({ data, skipDuplicates }: any) => {
      let count = 0
      for (const d of data) {
        const dup = db.bookings.some(
          (b) =>
            b.recurringId &&
            b.recurringId === d.recurringId &&
            same(b.occurrenceDate, d.occurrenceDate),
        )
        if (dup) {
          if (!skipDuplicates) throw new Error('unique violation')
          continue
        }
        db.bookings.push(booking({ id: randomUUID(), status: 'ACTIVE', ...d }))
        count++
      }
      return { count }
    },
    deleteMany: async ({ where }: any) => {
      const doomed = db.bookings.filter((b) => matches(b, where))
      db.bookings = db.bookings.filter((b) => !doomed.includes(b))
      return { count: doomed.length }
    },
  },
  recurringBooking: {
    findMany: async (args: any) =>
      page(
        db.series.filter((r) => matches(r, args.where)),
        args,
      ).map(withSeries),
    findUnique: async ({ where }: any) => {
      const row = db.series.find((r) => r.id === where.id)
      return row ? withSeries(row) : null
    },
    count: async ({ where }: any = {}) => db.series.filter((r) => matches(r, where)).length,
    create: async ({ data }: any) => {
      const id = randomUUID()
      const { services, ...rest } = data
      const row = {
        id,
        stoppedAt: null,
        notes: null,
        endDate: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        ...rest,
        services: services.create.map((s: any) => ({ recurringId: id, ...s })),
      }
      db.series.push(row)
      return row
    },
    update: async ({ where, data }: any) => {
      const clean = Object.fromEntries(Object.entries(data).filter(([, v]) => v !== undefined))
      return Object.assign(
        db.series.find((r) => r.id === where.id),
        clean,
      )
    },
  },
  recurringBookingService: {
    deleteMany: async ({ where }: any) => {
      const r = db.series.find((x) => x.id === where.recurringId)
      const count = r.services.length
      r.services = []
      return { count }
    },
    createMany: async ({ data }: any) => {
      const r = db.series.find((x) => x.id === data[0].recurringId)
      r.services.push(...data)
      return { count: data.length }
    },
  },
  $transaction: async (arg: any) => (Array.isArray(arg) ? Promise.all(arg) : arg(fakePrisma)),
}

// ───────────────────────── الاختبار ─────────────────────────

/** لا مال ولا إحصائيات مالية في أي مكان من الاستجابة */
function expectNoMoney(body: unknown) {
  const json = JSON.stringify(body)
  for (const key of ['price', 'paidAmount', 'revenue', 'expected', 'totalSpent']) {
    expect(json).not.toContain(`"${key}"`)
  }
}

describe('مشرف الحجوزات مقابل المدير (e2e بلا قاعدة بيانات)', () => {
  let app: INestApplication
  let staff: ReturnType<typeof request.agent>
  let admin: ReturnType<typeof request.agent>

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(PrismaService)
      .useValue(fakePrisma)
      .compile()
    app = moduleRef.createNestApplication()
    setupApp(app)
    await app.init()

    staff = request.agent(app.getHttpServer())
    admin = request.agent(app.getHttpServer())
    await staff
      .post('/api/auth/login')
      .send({ email: 'staff@e2e.test', password: PASSWORD })
      .expect(200)
    await admin
      .post('/api/auth/login')
      .send({ email: 'admin@e2e.test', password: PASSWORD })
      .expect(200)
  })

  afterAll(async () => {
    await app?.close()
  })

  beforeEach(() => {
    db = freshDb()
  })

  describe('الصلاحيات (403)', () => {
    it('me: لا stats.read ولا finance.read ولا bookings.history', async () => {
      const me = await staff.get('/api/auth/me').expect(200)
      for (const p of [
        'stats.read',
        'finance.read',
        'bookings.history',
        'bookings.delete',
        'services.update',
        'users.read',
      ]) {
        expect(me.body.permissions).not.toContain(p)
      }
      expect(me.body.permissions).toContain('bookings.complete')
    })

    it.each([
      ['get', '/api/stats'],
      ['get', '/api/users'],
      ['get', '/api/roles'],
      ['patch', '/api/settings'],
      ['post', '/api/services'],
    ])('%s %s → 403 بالعربية', async (method, url) => {
      const res = await (staff as any)[method](url).send({}).expect(403)
      expect(res.body).toEqual({ statusCode: 403, message: 'ليس لديك صلاحية للقيام بهذا الإجراء' })
    })

    it('الحذف النهائي للحجز والزبون ممنوع', async () => {
      await staff.delete(`/api/bookings/${ID.today}`).expect(403)
      await staff.delete(`/api/customers/${ID.c1}`).expect(403)
      expect(db.bookings.some((b) => b.id === ID.today)).toBe(true)
    })
  })

  describe('الخدمات', () => {
    it('المشرف: الاسم والمدة بلا سعر', async () => {
      const res = await staff.get('/api/services?includeInactive=true').expect(200)
      expect(res.body.map((s: any) => s.name)).toEqual(['شعر', 'ذقن'])
      expect(res.body[0].durationMinutes).toBe(30)
      expectNoMoney(res.body)
    })

    it('المدير: مع السعر', async () => {
      const res = await admin.get('/api/services').expect(200)
      expect(res.body[0].price).toBe(25000)
    })
  })

  describe('الحجوزات: الماضي', () => {
    it('يوم سابق → 403، واليوم → 200 بلا مال', async () => {
      const denied = await staff.get(`/api/bookings/day?date=${yesterday}`).expect(403)
      expect(denied.body.message).toBe('ليس لديك صلاحية لعرض الحجوزات السابقة')

      const res = await staff.get(`/api/bookings/day?date=${today}`).expect(200)
      expect(res.body.bookings.map((b: any) => b.id).sort()).toEqual(
        [ID.today, ID.todayDone].sort(),
      )
      expect(res.body.summary).toEqual({ total: 2, active: 1, completed: 1, cancelled: 0 })
      expectNoMoney(res.body)
    })

    it('القائمة: لا شيء قبل اليوم مهما كانت الفلاتر', async () => {
      for (const qs of [
        '',
        '?from=2020-01-01',
        '?from=2020-01-01&to=2030-01-01',
        `?customerId=${ID.c1}&to=${yesterday}`,
        '?status=COMPLETED&order=desc',
      ]) {
        const res = await staff.get(`/api/bookings${qs}`).expect(200)
        const ids = res.body.items.map((b: any) => b.id)
        expect(ids).not.toContain(ID.past)
        expect(ids).not.toContain(ID.pastActive)
        expectNoMoney(res.body)
      }
      const all = await staff.get('/api/bookings?from=2020-01-01').expect(200)
      expect(all.body.items.map((b: any) => b.id).sort()).toEqual(
        [ID.today, ID.todayDone, ID.future].sort(),
      )
    })

    it('حجز سابق بالمعرّف → 404 (لا يكشف وجوده)، وحجز اليوم → 200', async () => {
      await staff.get(`/api/bookings/${ID.past}`).expect(404)
      const res = await staff.get(`/api/bookings/${ID.today}`).expect(200)
      expectNoMoney(res.body)
    })

    it('المنتهية: المشرف لا يرى منتهيات الأمس، والمدير يراها', async () => {
      const s = await staff.get('/api/bookings/overdue').expect(200)
      expect(s.body.map((b: any) => b.id)).not.toContain(ID.pastActive)
      expectNoMoney(s.body)
      const a = await admin.get('/api/bookings/overdue').expect(200)
      expect(a.body.map((b: any) => b.id)).toContain(ID.pastActive)
    })

    it('المدير يرى الماضي والمال', async () => {
      const day = await admin.get(`/api/bookings/day?date=${yesterday}`).expect(200)
      expect(day.body.summary.revenue).toBe(25000)
      expect(day.body.bookings.find((b: any) => b.id === ID.past).paidAmount).toBe(25000)
      const one = await admin.get(`/api/bookings/${ID.past}`).expect(200)
      expect(one.body.price).toBe(25000)
    })

    it('لا إلغاء ولا تأكيد ولا تعديل لحجز سابق (404) ولا بقاء أثر', async () => {
      await staff.post(`/api/bookings/${ID.pastActive}/cancel`).send({}).expect(404)
      await staff.post(`/api/bookings/${ID.pastActive}/complete`).send({}).expect(404)
      await staff.patch(`/api/bookings/${ID.pastActive}`).send({ notes: 'x' }).expect(404)
      expect(db.bookings.find((b) => b.id === ID.pastActive).status).toBe('ACTIVE')
    })
  })

  describe('الحجوزات: المال عند الإنشاء والتعديل', () => {
    const body = (over: Record<string, unknown> = {}) => ({
      serviceId: ID.s1,
      startAt: at(14).toISOString(),
      customerName: 'زبون جديد',
      ...over,
    })

    it('إنشاء بسعر مخصص أو بتاريخ سابق → 403 ولا كتابة', async () => {
      const before = db.bookings.length
      await staff
        .post('/api/bookings')
        .send(body({ price: 1 }))
        .expect(403)
      await staff
        .post('/api/bookings')
        .send(body({ startAt: at(-5).toISOString() }))
        .expect(403)
      expect(db.bookings.length).toBe(before)
    })

    it('إنشاء عادي: يُحفظ سعر الخدمة ولا يعود للمشرف', async () => {
      const res = await staff.post('/api/bookings').send(body()).expect(201)
      expectNoMoney(res.body)
      expect(db.bookings.find((b) => b.id === res.body.id).price).toBe(25000)
    })

    it('المدير يحدّد سعراً مخصصاً فيراه', async () => {
      const res = await admin
        .post('/api/bookings')
        .send(body({ price: 18000 }))
        .expect(201)
      expect(res.body.price).toBe(18000)
    })

    it('تعديل السعر أو المبلغ من المشرف → 403', async () => {
      await staff.patch(`/api/bookings/${ID.today}`).send({ price: 1 }).expect(403)
      await staff.patch(`/api/bookings/${ID.todayDone}`).send({ paidAmount: 1 }).expect(403)
      expect(db.bookings.find((b) => b.id === ID.today).price).toBe(18000)
    })

    it('تعديل الملاحظات يُبقي سعر المدير المخصص', async () => {
      const res = await staff
        .patch(`/api/bookings/${ID.today}`)
        .send({ notes: 'ملاحظة' })
        .expect(200)
      expectNoMoney(res.body)
      expect(db.bookings.find((b) => b.id === ID.today).price).toBe(18000)
    })
  })

  describe('تأكيد الحجز (D11)', () => {
    it('المشرف بلا جسم: يُسجَّل السعر الذي حدّده المدير (18000) ولا يظهر له', async () => {
      const res = await staff.post(`/api/bookings/${ID.today}/complete`).send({}).expect(200)
      expect(res.body.status).toBe('COMPLETED')
      expectNoMoney(res.body)
      const stored = db.bookings.find((b) => b.id === ID.today)
      expect(stored.paidAmount).toBe(18000)
      expect(stored.price).toBe(18000)
    })

    it('أي مبلغ صريح من المشرف → 403 ولا تغيير', async () => {
      for (const paidAmount of [0, 18000, 99999]) {
        await staff.post(`/api/bookings/${ID.today}/complete`).send({ paidAmount }).expect(403)
      }
      expect(db.bookings.find((b) => b.id === ID.today).status).toBe('ACTIVE')
    })

    it('سعر الحجز 0: يُستعمل سعر الخدمة الحالي', async () => {
      db.bookings.find((b) => b.id === ID.today).price = 0
      await staff.post(`/api/bookings/${ID.today}/complete`).send({}).expect(200)
      expect(db.bookings.find((b) => b.id === ID.today).paidAmount).toBe(25000)
    })

    it('المدير: مبلغ صريح يُسجَّل ويراه', async () => {
      const res = await admin
        .post(`/api/bookings/${ID.today}/complete`)
        .send({ paidAmount: 15000 })
        .expect(200)
      expect(res.body.paidAmount).toBe(15000)
    })

    it('تراجع المشرف عن تأكيده ممكن، لكن ليس بعد أن عدّل المدير المبلغ', async () => {
      await staff.post(`/api/bookings/${ID.today}/complete`).send({}).expect(200)
      await staff.post(`/api/bookings/${ID.today}/reopen`).expect(200)
      expect(db.bookings.find((b) => b.id === ID.today).status).toBe('ACTIVE')

      await admin.post(`/api/bookings/${ID.today}/complete`).send({ paidAmount: 15000 }).expect(200)
      const denied = await staff.post(`/api/bookings/${ID.today}/reopen`).expect(403)
      expect(denied.body.message).toBe('لا يمكن إعادة فتح هذا الحجز، راجع المدير')
      expect(db.bookings.find((b) => b.id === ID.today).paidAmount).toBe(15000)
    })

    it('الإلغاء لحجز اليوم مسموح ولا مال في الاستجابة', async () => {
      const res = await staff
        .post(`/api/bookings/${ID.future}/cancel`)
        .send({ reason: 'اعتذر' })
        .expect(200)
      expect(res.body.status).toBe('CANCELLED')
      expectNoMoney(res.body)
    })
  })

  describe('الزبائن', () => {
    it('ملف الزبون للمشرف: القادم من اليوم فقط، إحصائية القادمة وحدها، بلا مال', async () => {
      const res = await staff.get(`/api/customers/${ID.c1}`).expect(200)
      expect(Object.keys(res.body.stats)).toEqual(['upcoming'])
      expect(res.body.bookings.map((b: any) => b.id).sort()).toEqual(
        [ID.today, ID.todayDone, ID.future].sort(),
      )
      expectNoMoney(res.body)
    })

    it('ملف الزبون للمدير: السجل كاملاً مع المجموع والزيارات', async () => {
      const res = await admin.get(`/api/customers/${ID.c1}`).expect(200)
      expect(res.body.stats).toMatchObject({ visits: 2, totalSpent: 50000 })
      expect(res.body.bookings).toHaveLength(5)
    })

    it('قائمة الزبائن: المشرف بلا زيارات، والمدير معها', async () => {
      const s = await staff.get('/api/customers').expect(200)
      expect(s.body.items[0]).not.toHaveProperty('visits')
      expect(s.body.items[0]).not.toHaveProperty('lastVisitAt')
      const a = await admin.get('/api/customers').expect(200)
      expect(a.body.items[0].visits).toBe(2)
    })

    it('تعديل بيانات الزبون للمدير وحده: المشرف 403 والمدير 200', async () => {
      const before = db.customers.find((c) => c.id === ID.c1).name
      await staff.patch(`/api/customers/${ID.c1}`).send({ name: 'اسم جديد' }).expect(403)
      expect(db.customers.find((c) => c.id === ID.c1).name).toBe(before)
      await admin.patch(`/api/customers/${ID.c1}`).send({ name: 'اسم جديد' }).expect(200)
      db.customers.find((c) => c.id === ID.c1).name = before
    })

    it('الإضافة للمشرف: هاتف مكرر (بصيغة +963) ← 409 PHONE_DUPLICATE باسم الزبون، ثم يُقبل بالتأكيد', async () => {
      const body = { name: 'زبون ثانٍ', phone: '+963 991 234 567' }
      const res = await staff.post('/api/customers').send(body).expect(409)
      expect(res.body).toMatchObject({
        statusCode: 409,
        code: 'PHONE_DUPLICATE',
        data: { customers: [{ id: ID.c1, name: 'زبون تجريبي' }] },
      })
      expect(res.body.message).toContain('زبون تجريبي')
      expect(db.customers).toHaveLength(1)

      await staff
        .post('/api/customers')
        .send({ ...body, confirmDuplicatePhone: true })
        .expect(201)
      expect(db.customers).toHaveLength(2)
      db.customers.pop()
    })
  })

  describe('الحجوزات الدورية', () => {
    const tomorrow = addDays(today, 1)
    const body = (over: Record<string, unknown> = {}) => ({
      customerId: ID.c1,
      startDate: tomorrow,
      startTime: '12:00',
      intervalWeeks: 1,
      serviceIds: [ID.s1],
      ...over,
    })
    const generated = () => db.bookings.filter((b) => b.recurringId)

    it('المشرف ينشئ سلسلة أسبوعية: 8 مواعيد بسعر الخدمة المحفوظ، وبلا مال في الاستجابة', async () => {
      const res = await staff.post('/api/recurring-bookings').send(body()).expect(201)
      expect(res.body.created).toBe(8)
      expect(res.body.series.status).toBe('ACTIVE')
      expect(res.body.series.upcoming).toHaveLength(8)
      expectNoMoney(res.body)
      expect(generated()).toHaveLength(8)
      expect(generated().every((b) => b.price === 25000 && b.serviceName === 'شعر')).toBe(true)
      expect(generated().every((b) => b.createdById === ID.staffUser)).toBe(true)
    })

    it('price في الجسم لا يؤثر (يُحذف بالتحقق ولا حقل مالي في القالب)', async () => {
      await staff
        .post('/api/recurring-bookings')
        .send(body({ price: 1, paidAmount: 1 }))
        .expect(201)
      expect(generated().every((b) => b.price === 25000)).toBe(true)
    })

    it('أسبوع نعم وأسبوع لا: 4 مواعيد في الأفق', async () => {
      const res = await staff
        .post('/api/recurring-bookings')
        .send(body({ intervalWeeks: 2 }))
        .expect(201)
      expect(res.body.created).toBe(4)
    })

    it('تناوب خدمتين: تتبدّل الخدمة موعداً بعد موعد', async () => {
      await staff
        .post('/api/recurring-bookings')
        .send(body({ serviceIds: [ID.s1, ID.s2] }))
        .expect(201)
      const names = generated()
        .sort((a, b) => a.startAt.getTime() - b.startAt.getTime())
        .map((b) => b.serviceName)
      expect(names.slice(0, 4)).toEqual(['شعر', 'ذقن', 'شعر', 'ذقن'])
    })

    it('تاريخ سابق → 400 بالعربية على startDate ولا كتابة', async () => {
      const res = await staff
        .post('/api/recurring-bookings')
        .send(body({ startDate: yesterday }))
        .expect(400)
      expect(res.body.errors.startDate).toBeDefined()
      expect(db.series).toHaveLength(0)
    })

    it('تعارض الموعد الأول → 409 ولا سلسلة', async () => {
      // حجز الغد 10:00 (ID.future) — نطلب 10:15 فيتداخل
      const res = await staff
        .post('/api/recurring-bookings')
        .send(body({ startTime: '10:15' }))
        .expect(409)
      expect(res.body.errors.startTime).toBeDefined()
      expect(db.series).toHaveLength(0)
    })

    it('المعاينة: بلا كتابة ولا مال', async () => {
      const res = await staff
        .post('/api/recurring-bookings/preview')
        .send(body({ intervalWeeks: 2 }))
        .expect(200)
      expect(res.body.occurrences).toHaveLength(4)
      expectNoMoney(res.body)
      expect(db.series).toHaveLength(0)
      expect(generated()).toHaveLength(0)
    })

    it('القائمة والتفاصيل: المشرف بلا مال، والمدير يرى أسعار الحجوزات المرفقة فقط', async () => {
      const created = await staff.post('/api/recurring-bookings').send(body()).expect(201)
      const id = created.body.series.id

      const list = await staff.get('/api/recurring-bookings').expect(200)
      expect(list.body).toHaveLength(1)
      expect(list.body[0].next).not.toBeNull()
      expectNoMoney(list.body)

      expectNoMoney((await staff.get(`/api/recurring-bookings/${id}`).expect(200)).body)

      const asAdmin = await admin.get(`/api/recurring-bookings/${id}`).expect(200)
      expect(asAdmin.body.upcoming[0].price).toBe(25000)
      expect(Object.keys(asAdmin.body)).not.toContain('price')
    })

    it('سلسلة غير موجودة → 404', async () => {
      await staff.get(`/api/recurring-bookings/${randomUUID()}`).expect(404)
      await staff.post(`/api/recurring-bookings/${randomUUID()}/stop`).expect(404)
    })

    it('تعديل القالب: يعيد كتابة المواعيد غير المعدّلة ويبقي المعدّل يدوياً', async () => {
      const created = await staff.post('/api/recurring-bookings').send(body()).expect(201)
      const id = created.body.series.id
      const first = created.body.series.upcoming[0].id
      await staff.patch(`/api/bookings/${first}`).send({ notes: 'خاص' }).expect(200)
      expect(db.bookings.find((b) => b.id === first).recurringEdited).toBe(true)

      const res = await staff
        .patch(`/api/recurring-bookings/${id}`)
        .send({ startTime: '13:00' })
        .expect(200)
      expect(res.body).toMatchObject({ removed: 7, created: 7, keptEdited: 1 })
      expect(generated()).toHaveLength(8)
      expect(db.bookings.find((b) => b.id === first).notes).toBe('خاص') // لم يُمسّ
      expectNoMoney(res.body)
    })

    it('الإيقاف: يحذف غير المعدّل ويبقي المعدّل؛ والتعديل بعده 409', async () => {
      const created = await staff.post('/api/recurring-bookings').send(body()).expect(201)
      const id = created.body.series.id
      const first = created.body.series.upcoming[0].id
      await staff.patch(`/api/bookings/${first}`).send({ notes: 'خاص' }).expect(200)

      const res = await staff.post(`/api/recurring-bookings/${id}/stop`).expect(200)
      expect(res.body).toMatchObject({ removed: 7, keptEdited: 1 })
      expect(res.body.series.status).toBe('STOPPED')
      expect(generated().map((b) => b.id)).toEqual([first])

      await staff.patch(`/api/recurring-bookings/${id}`).send({ startTime: '14:00' }).expect(409)
    })

    it('حذف موعد دوري قادم نهائياً (المدير) ← 409 حتى يُوقف الحجز الدوري (D8)', async () => {
      const created = await staff.post('/api/recurring-bookings').send(body()).expect(201)
      const id = created.body.series.id
      const target = created.body.series.upcoming[1].id

      const denied = await admin.delete(`/api/bookings/${target}`).expect(409)
      expect(denied.body.message).toContain('حجز دوري')
      expect(db.bookings.some((b) => b.id === target)).toBe(true)

      await admin.post(`/api/recurring-bookings/${id}/stop`).expect(200)
      // بعد الإيقاف حُذف غير المعدّل أصلاً فلا شيء متبقٍ من السلسلة
      expect(generated()).toHaveLength(0)
    })

    it('المشرف لا يحذف الحجز نهائياً أصلاً (403)', async () => {
      const created = await staff.post('/api/recurring-bookings').send(body()).expect(201)
      await staff.delete(`/api/bookings/${created.body.series.upcoming[0].id}`).expect(403)
    })
  })
})
