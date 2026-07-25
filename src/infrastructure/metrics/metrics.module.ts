import { Global, Module } from '@nestjs/common'
import { APP_INTERCEPTOR } from '@nestjs/core'
import { MetricsService } from './metrics.service'
import { MetricsController } from './metrics.controller'
import { MetricsTokenGuard } from './metrics-token.guard'
import { HttpMetricsInterceptor } from './http-metrics.interceptor'

@Global()
@Module({
  controllers: [MetricsController],
  providers: [
    MetricsService,
    MetricsTokenGuard,
    {
      provide: APP_INTERCEPTOR,
      useClass: HttpMetricsInterceptor,
    },
  ],
  exports: [MetricsService],
})
export class MetricsModule {}
