import { Global, Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { AppConfig } from './app-config'
import { envValidationSchema } from './env.validation'

@Global()
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      // .env الخاص بالـ API أولاً، ثم .env الجذر إن وُجد
      envFilePath: ['.env', '../../.env'],
      validationSchema: envValidationSchema,
      validationOptions: { allowUnknown: true, abortEarly: false },
    }),
  ],
  providers: [AppConfig],
  exports: [AppConfig],
})
export class AppConfigModule {}
