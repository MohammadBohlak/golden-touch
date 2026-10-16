/**
 * اختبار e2e على قاعدة البيانات الحقيقية (يتطلب .env صالحاً + migrate + seed):
 * login → me → users، مع التحقق من 401 العربي و GET /api/health.
 */
import { INestApplication } from '@nestjs/common'
import { Test } from '@nestjs/testing'
import request from 'supertest'
import { AppModule } from '../src/app.module'
import { setupApp } from '../src/setup-app'

describe('Auth flow (e2e)', () => {
  let app: INestApplication

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile()
    app = moduleRef.createNestApplication()
    setupApp(app)
    await app.init()
  })

  afterAll(async () => {
    await app?.close()
  })

  it('GET /api/health → 200', async () => {
    const res = await request(app.getHttpServer()).get('/api/health').expect(200)
    expect(res.body.status).toBe('ok')
  })

  it('rejects protected routes without a token (Arabic 401)', async () => {
    const res = await request(app.getHttpServer()).get('/api/users').expect(401)
    expect(res.body).toEqual({ statusCode: 401, message: 'يجب تسجيل الدخول أولاً' })
  })

  it('returns Arabic validation errors', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: 'not-an-email', password: '' })
      .expect(400)
    expect(res.body.errors.email).toContain('البريد الإلكتروني غير صالح')
  })

  it('login → me → users', async () => {
    // ConfigModule حمّل .env إلى process.env أثناء beforeAll
    const email = process.env.SEED_ADMIN_EMAIL ?? ''
    const password = process.env.SEED_ADMIN_PASSWORD ?? ''
    const agent = request.agent(app.getHttpServer())

    const login = await agent.post('/api/auth/login').send({ email, password }).expect(200)
    expect(login.headers['set-cookie']?.[0]).toMatch(/^token=.+HttpOnly/i)

    const me = await agent.get('/api/auth/me').expect(200)
    expect(me.body.email).toBe(email.toLowerCase())
    expect(me.body.permissions).toContain('users.read')

    const users = await agent.get('/api/users?page=1&limit=5').expect(200)
    expect(users.body).toMatchObject({ page: 1, limit: 5 })
    expect(users.body.items.length).toBeGreaterThan(0)
    expect(users.body.items[0]).not.toHaveProperty('passwordHash')
  })
})
