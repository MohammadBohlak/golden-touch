import { Body, Controller, Get, HttpCode, Patch, Post, Res } from '@nestjs/common'
import {
  ApiCookieAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiTooManyRequestsResponse,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger'
import { Throttle } from '@nestjs/throttler'
import type { Response } from 'express'
import { CurrentUser } from '../../common/decorators/current-user.decorator'
import { Public } from '../../common/decorators/public.decorator'
import type { AuthUser } from '../../common/types/auth-user'
import { AppConfig } from '../../config/app-config'
import { AuthService } from './auth.service'
import { ChangePasswordDto } from './dto/change-password.dto'
import { LoginDto } from './dto/login.dto'

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly config: AppConfig,
  ) {}

  @Public()
  @Post('login')
  @HttpCode(200)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @ApiOperation({ summary: 'تسجيل الدخول — يضع التوكن في كوكي httpOnly' })
  @ApiUnauthorizedResponse({ description: 'بيانات الدخول غير صحيحة' })
  @ApiTooManyRequestsResponse({ description: 'محاولات كثيرة' })
  async login(@Body() dto: LoginDto, @Res({ passthrough: true }) res: Response) {
    const { token, user } = await this.auth.login(dto.email, dto.password)
    res.cookie(this.config.cookieName, token, {
      httpOnly: true,
      sameSite: 'lax',
      secure: this.config.isProduction,
      path: '/',
      maxAge: this.config.jwtExpiresInSeconds * 1000,
    })
    return { user, accessToken: token }
  }

  @Public()
  @Post('logout')
  @HttpCode(200)
  @ApiOperation({ summary: 'تسجيل الخروج — يحذف الكوكي' })
  logout(@Res({ passthrough: true }) res: Response) {
    res.clearCookie(this.config.cookieName, {
      httpOnly: true,
      sameSite: 'lax',
      secure: this.config.isProduction,
      path: '/',
    })
    return { success: true }
  }

  @Get('me')
  @ApiCookieAuth()
  @ApiOperation({ summary: 'المستخدم الحالي مع صلاحياته' })
  @ApiOkResponse({ description: '{ id, name, email, phone, role, permissions }' })
  me(@CurrentUser() user: AuthUser): AuthUser {
    return user
  }

  @Patch('me/password')
  @ApiCookieAuth()
  @ApiOperation({ summary: 'تغيير كلمة مرور المستخدم الحالي' })
  async changePassword(@CurrentUser() user: AuthUser, @Body() dto: ChangePasswordDto) {
    await this.auth.changePassword(user.id, dto.currentPassword, dto.newPassword)
    return { success: true }
  }
}
