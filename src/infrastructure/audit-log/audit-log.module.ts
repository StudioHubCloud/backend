import { Global, Module } from '@nestjs/common'
import { BullModule } from '@nestjs/bullmq'
import { AuditLogService } from './audit-log.service'
import { AuditLogProcessor } from './audit-log.processor'
import { AUDIT_LOG_QUEUE } from './audit-log.queue'

@Global()
@Module({
  imports: [
    BullModule.registerQueue({
      name: AUDIT_LOG_QUEUE,
      defaultJobOptions: {
        removeOnComplete: 50,
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
