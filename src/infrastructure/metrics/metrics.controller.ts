import { Controller, Get, Header, Res, UseGuards } from '@nestjs/common'
import { Response } from 'express'
import { MetricsService } from './metrics.service'
import { MetricsTokenGuard } from './metrics-token.guard'

@Controller('metrics')
@UseGuards(MetricsTokenGuard)
export class MetricsController {
  constructor(private readonly metricsService: MetricsService) {}

  @Get()
  @Header('Cache-Control', 'no-store')
  async getMetrics(@Res({ passthrough: true }) response: Response): Promise<string> {
    response.set('Content-Type', this.metricsService.getContentType())
    return this.metricsService.getMetrics()
  }
}
