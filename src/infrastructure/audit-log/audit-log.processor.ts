import { Processor, WorkerHost } from '@nestjs/bullmq'
import { Injectable, OnModuleDestroy } from '@nestjs/common'
import { Job } from 'bullmq'
import { DatabaseService } from '../database/database.service'
import { PinoLogger } from 'nestjs-pino'
import { AuditLogActions, AuditLogPayload } from '@app/libs'
import { AUDIT_LOG_QUEUE } from './audit-log.queue'
import { auditLog } from '../database'

@Processor(AUDIT_LOG_QUEUE)
@Injectable()
export class AuditLogProcessor extends WorkerHost implements OnModuleDestroy {
  private batchBuffer: any[] = []
  private batchTimer: NodeJS.Timeout | null = null
  private readonly BATCH_SIZE = 10 // Small batches for your volume
  private readonly BATCH_TIMEOUT = 5000 // 5 seconds

  constructor(
    private readonly databaseService: DatabaseService,
    private readonly logger: PinoLogger,
  ) {
    super()
    this.logger.setContext(AuditLogProcessor.name)
  }

  async process(job: Job<AuditLogPayload>): Promise<void> {
    try {
      const logData = this.transformPayloadForDb(job.data)

      // For critical operations, insert immediately
      if (job.data.action === AuditLogActions.PAYMENT_RECEIVED || job.data.action === AuditLogActions.PAYMENT_REFUND) {
        await this.insertSingle(logData)
      } else {
        await this.addToBatch(logData)
      }
    } catch (error) {
      this.logger.error('Failed to process audit log job %s: %o', job.id, error)
      throw error // Let BullMQ handle retry
    }
  }

  private transformPayloadForDb(payload: AuditLogPayload) {
    return {
      action: payload.action,
      serviceName: payload.serviceName || 'UnknownService',
      methodName: payload.methodName || 'unknownMethod',
      entityName: payload.entityName,
      entityId: payload.entityId,
      operation: payload.operation,
      telegramId: payload.telegramId || null,
      userRole: payload.userRole || null,
      trigger: payload.trigger!,
      oldValue: payload.oldValue || null,
      newValue: payload.newValue || null,
      changedFields: payload.metadata?.changedFields || null,
      metadata: payload.metadata || null,
      studioId: payload.studioId || process.env.STUDIO_ID!,
      executionTimeMs: payload.metadata?.executionTimeMs || null,
    }
  }

  private async insertSingle(logData: any) {
    await this.databaseService.drizzle.insert(auditLog).values(logData).execute()

    this.logger.debug('Inserted audit log: %s.%s', logData.entityName, logData.entityId)
  }

  private async addToBatch(logData: any) {
    this.batchBuffer.push(logData)

    if (this.batchBuffer.length >= this.BATCH_SIZE) {
      await this.flushBatch()
    } else if (!this.batchTimer) {
      this.batchTimer = setTimeout(() => this.flushBatch(), this.BATCH_TIMEOUT)
    }
  }

  private async flushBatch() {
    if (this.batchBuffer.length === 0) return

    const batch = [...this.batchBuffer]
    this.batchBuffer = []

    if (this.batchTimer) {
      clearTimeout(this.batchTimer)
      this.batchTimer = null
    }

    try {
      await this.databaseService.drizzle.insert(auditLog).values(batch).execute()

      this.logger.debug('Batch inserted %d audit logs', batch.length)
    } catch (error) {
      this.logger.error('Failed to batch insert audit logs: %o', error)
      // You might want to retry individual inserts here
      throw error
    }
  }

  async onModuleDestroy() {
    // Flush any remaining logs when shutting down
    await this.flushBatch()
  }
}
