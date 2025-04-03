import { Injectable } from '@nestjs/common'
import { Cron, CronExpression } from '@nestjs/schedule'
import { PinoLogger } from 'nestjs-pino'

@Injectable()
export class CronService {
  constructor(private readonly logger: PinoLogger) {}

  // @Cron(CronExpression.EVERY_5_SECONDS)
  // handleCron() {
  //   this.logger.debug('Cron job executed every 5 seconds')
  // }
}
