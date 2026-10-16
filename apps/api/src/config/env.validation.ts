import Joi from 'joi'

/** صيغة المدة: رقم ثوانٍ أو رقم مع لاحقة s | m | h | d (مثل 30d أو 12h) */
export const DURATION_PATTERN = /^\d+[smhd]?$/

export const envValidationSchema = Joi.object({
  NODE_ENV: Joi.string().valid('development', 'production', 'test').default('development'),
  PORT: Joi.number().port().default(4000),
  DATABASE_URL: Joi.string()
    .uri({ scheme: ['postgres', 'postgresql'] })
    .required(),
  DIRECT_URL: Joi.string().uri({ scheme: ['postgres', 'postgresql'] }),
  JWT_SECRET: Joi.string().min(32).required(),
  JWT_EXPIRES_IN: Joi.string().pattern(DURATION_PATTERN).default('30d'),
  CORS_ORIGIN: Joi.string().default('http://localhost:3000'),
  COOKIE_NAME: Joi.string().default('token'),
  // Render يضبط RENDER_EXTERNAL_URL تلقائياً (رابط الموقع العام)
  RENDER_EXTERNAL_URL: Joi.string().uri({ scheme: ['http', 'https'] }),
  // إبقاء الخادم مستيقظاً على الخطة المجانية: طلب دوري لـ /api/health عبر الرابط العام
  KEEP_ALIVE_URL: Joi.string().uri({ scheme: ['http', 'https'] }),
  KEEP_ALIVE_INTERVAL_MINUTES: Joi.number().integer().min(1).max(14).default(10),
})
