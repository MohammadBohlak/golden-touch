import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common'
import type { Response } from 'express'
import { Observable, tap } from 'rxjs'

/** يضيف ترويسة X-Response-Time لكل استجابة — مفيد لمراقبة بطء الاتصال بقاعدة البيانات */
@Injectable()
export class ResponseTimeInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const started = performance.now()
    const response = context.switchToHttp().getResponse<Response>()
    return next.handle().pipe(
      tap(() => {
        if (!response.headersSent) {
          response.setHeader('X-Response-Time', `${(performance.now() - started).toFixed(1)}ms`)
        }
      }),
    )
  }
}
