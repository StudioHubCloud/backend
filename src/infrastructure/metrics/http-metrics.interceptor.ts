import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common'
import { Request, Response } from 'express'
import { Observable } from 'rxjs'
import { MetricsService } from './metrics.service'

@Injectable()
export class HttpMetricsInterceptor implements NestInterceptor {
  constructor(private readonly metricsService: MetricsService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (context.getType() !== 'http') {
      return next.handle()
    }

    const request = context.switchToHttp().getRequest<Request>()
    const response = context.switchToHttp().getResponse<Response>()

    if (request.path === '/metrics') {
      return next.handle()
    }

    const start = process.hrtime.bigint()
    const method = request.method
    const route = request.route?.path ? (request.baseUrl || '') + request.route.path : request.path

    // Read the status code from the 'finish' event, not the interceptor's success/error branch:
    // exception filters set the final status code AFTER the observable errors, so reading
    // response.statusCode inside a tap(error) handler would still see the pre-filter default.
    response.once('finish', () => {
      const durationSeconds = Number(process.hrtime.bigint() - start) / 1e9
      const statusClass = `${Math.floor(response.statusCode / 100)}xx`
      this.metricsService.recordHttpRequest(method, route, statusClass, durationSeconds)
    })

    return next.handle()
  }
}
