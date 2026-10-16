import { Module } from '@nestjs/common'
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core'
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler'
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter'
import { JwtAuthGuard } from './common/guards/jwt-auth.guard'
import { PermissionsGuard } from './common/guards/permissions.guard'
import { ResponseTimeInterceptor } from './common/interceptors/response-time.interceptor'
import { AppConfigModule } from './config/config.module'
import { AuthModule } from './modules/auth/auth.module'
import { BookingsModule } from './modules/bookings/bookings.module'
import { CustomersModule } from './modules/customers/customers.module'
import { HealthModule } from './modules/health/health.module'
import { RolesModule } from './modules/roles/roles.module'
import { ServicesModule } from './modules/services/services.module'
import { SettingsModule } from './modules/settings/settings.module'
import { StatsModule } from './modules/stats/stats.module'
import { UsersModule } from './modules/users/users.module'
import { PrismaModule } from './prisma/prisma.module'

@Module({
  imports: [
    AppConfigModule,
    PrismaModule,
    // حد عام سخي؛ مسار الدخول له حد أشد عبر @Throttle
    ThrottlerModule.forRoot([{ name: 'default', ttl: 60_000, limit: 300 }]),
    HealthModule,
    AuthModule,
    UsersModule,
    RolesModule,
    SettingsModule,
    ServicesModule,
    CustomersModule,
    BookingsModule,
    StatsModule,
  ],
  providers: [
    // الترتيب مهم: التحديد ← المصادقة ← الصلاحيات
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: PermissionsGuard },
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
    { provide: APP_INTERCEPTOR, useClass: ResponseTimeInterceptor },
  ],
})
export class AppModule {}
