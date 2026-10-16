import { Logger } from '@nestjs/common'
import { NestFactory } from '@nestjs/core'
import type { NestExpressApplication } from '@nestjs/platform-express'
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger'
import { AppModule } from './app.module'
import { AppConfig } from './config/app-config'
import { setupApp } from './setup-app'

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule)
  setupApp(app)
  const config = app.get(AppConfig)

  const swagger = new DocumentBuilder()
    .setTitle('Golden Touch API')
    .setDescription('واجهة برمجية لإدارة مواعيد صالون Golden Touch — العقد بين الواجهة والخادم')
    .setVersion('1.0.0')
    .addCookieAuth(config.cookieName)
    .addBearerAuth()
    .build()
  SwaggerModule.setup('api/docs', app, SwaggerModule.createDocument(app, swagger), {
    swaggerOptions: { persistAuthorization: true, withCredentials: true },
  })

  await app.listen(config.port)
  Logger.log(`API ready on http://localhost:${config.port}/api (docs: /api/docs)`, 'Bootstrap')
}

void bootstrap()
