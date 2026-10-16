import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common'
import { Prisma } from '@prisma/client'
import type { Response } from 'express'

export interface ErrorBody {
  statusCode: number
  message: string
  errors?: Record<string, string[]>
}

const DEFAULT_MESSAGES: Record<number, string> = {
  400: 'الطلب غير صالح',
  401: 'يجب تسجيل الدخول أولاً',
  403: 'ليس لديك صلاحية للقيام بهذا الإجراء',
  404: 'العنصر المطلوب غير موجود',
  409: 'تعارض مع بيانات موجودة',
  413: 'حجم الطلب كبير جداً',
  429: 'محاولات كثيرة، يرجى الانتظار قليلاً ثم المحاولة مجدداً',
  500: 'حدث خطأ غير متوقع في الخادم',
}

const ARABIC = /[؀-ۿ]/

/** أي خطأ من قيد منع تداخل الحجوزات على مستوى قاعدة البيانات */
export function isBookingOverlapError(error: unknown): boolean {
  const text = error instanceof Error ? error.message : String(error)
  return text.includes('bookings_no_overlap') || text.includes('23P01')
}

/**
 * شكل موحّد لكل الأخطاء: { statusCode, message, errors? }
 * رسائل NestJS الإنجليزية الافتراضية تُستبدل برسائل عربية.
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name)

  catch(exception: unknown, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse<Response>()
    const body = this.toBody(exception)
    if (body.statusCode >= 500) {
      this.logger.error(exception instanceof Error ? exception.stack : String(exception))
    }
    response.status(body.statusCode).json(body)
  }

  private toBody(exception: unknown): ErrorBody {
    if (exception instanceof HttpException) {
      const statusCode = exception.getStatus()
      const raw = exception.getResponse()
      const payload = typeof raw === 'string' ? { message: raw } : (raw as Record<string, unknown>)
      const rawMessage = Array.isArray(payload.message) ? payload.message[0] : payload.message
      const message =
        typeof rawMessage === 'string' && ARABIC.test(rawMessage)
          ? rawMessage
          : (DEFAULT_MESSAGES[statusCode] ?? DEFAULT_MESSAGES[500])
      const errors = payload.errors as Record<string, string[]> | undefined
      return errors ? { statusCode, message, errors } : { statusCode, message }
    }

    if (isBookingOverlapError(exception)) {
      return { statusCode: HttpStatus.CONFLICT, message: 'هذا الموعد يتداخل مع حجز آخر' }
    }

    if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      switch (exception.code) {
        case 'P2002': {
          const fields = (exception.meta?.target as string[] | undefined) ?? []
          const message = 'هذه القيمة مستخدمة مسبقاً'
          return {
            statusCode: HttpStatus.CONFLICT,
            message,
            errors: fields.length
              ? Object.fromEntries(fields.map((f) => [f, [message]]))
              : undefined,
          }
        }
        case 'P2025':
          return { statusCode: HttpStatus.NOT_FOUND, message: DEFAULT_MESSAGES[404] }
        case 'P2003':
          return {
            statusCode: HttpStatus.CONFLICT,
            message: 'لا يمكن تنفيذ العملية لوجود بيانات مرتبطة بهذا العنصر',
          }
      }
    }

    return { statusCode: HttpStatus.INTERNAL_SERVER_ERROR, message: DEFAULT_MESSAGES[500] }
  }
}
