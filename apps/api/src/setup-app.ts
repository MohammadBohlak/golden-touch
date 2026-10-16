import { INestApplication, ValidationPipe } from '@nestjs/common'
import type { NestExpressApplication } from '@nestjs/platform-express'
import cookieParser from 'cookie-parser'
import helmet from 'helmet'
import { validationExceptionFactory } from './common/filters/validation-exception.factory'
import { AppConfig } from './config/app-config'

/** إعدادات مشتركة بين التشغيل الفعلي واختبارات e2e */
export function setupApp(app: INestApplication): void {
  const config = app.get(AppConfig)
  const express = app as NestExpressApplication

  // الواجهة (Nuxt) تمرّر الطلبات كـ proxy محلي؛ نثق به لقراءة IP الحقيقي (مهم للـ throttling)
  express.set('trust proxy', 'loopback')
  app.setGlobalPrefix('api')
  app.use(helmet())
  app.use(cookieParser())
  app.enableCors({ origin: config.corsOrigins, credentials: true })
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidUnknownValues: true,
      exceptionFactory: validationExceptionFactory,
    }),
  )
  app.enableShutdownHooks()
}
