import { Global, Module } from '@nestjs/common'
import { BullModule } from '@nestjs/bullmq'
import { AuditLogService } from './audit-log.service'
import { AuditLogProcessor } from './audit-log.processor'
import { AUDIT_LOG_QUEUE } from './audit-log.queue'
import { TypedConfigService } from '../config'

@Global()
@Module({
  imports: [
    BullModule.forRootAsync({
      inject: [TypedConfigService],
      useFactory: (config: TypedConfigService) => ({
        connection: {
          url: config.get('REDIS_URL'),
          family: 6,
          tls: undefined,
        },
      }),
    }),
    BullModule.registerQueue({
      name: AUDIT_LOG_QUEUE,
      defaultJobOptions: {
        removeOnComplete: {
          age: 3600,
          count: 100,
        },
        removeOnFail: 100,
        attempts: 2,
        backoff: {
          type: 'exponential',
          delay: 2000,
        },
      },
    }),
  ],
  providers: [AuditLogService, AuditLogProcessor],
  exports: [AuditLogService],
})
export class AuditLogModule {}
