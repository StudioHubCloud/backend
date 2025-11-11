import { Processor, WorkerHost } from '@nestjs/bullmq'
import { Injectable, OnModuleDestroy } from '@nestjs/common'
import { Job } from 'bullmq'
import { DatabaseService } from '../database/database.service'
import { PinoLogger } from 'nestjs-pino'
import { AuditLogPayload } from '@app/libs'
import { AUDIT_LOG_QUEUE } from './audit-log.queue'
import { auditLog } from '../database'
import { TypedConfigService } from '../config'

@Processor(AUDIT_LOG_QUEUE)
@Injectable()
export class AuditLogProcessor extends WorkerHost implements OnModuleDestroy {
  private studioId: string
  private batchBuffer: any[] = []
  private batchTimer: NodeJS.Timeout | null = null
  private readonly BATCH_SIZE = 10
  private readonly BATCH_TIMEOUT = 5000

  constructor(
    private readonly databaseService: DatabaseService,
    private readonly configService: TypedConfigService,
    private readonly logger: PinoLogger,
  ) {
    super()
    this.logger.setContext(AuditLogProcessor.name)
    this.studioId = this.configService.get('STUDIO_ID')
  }

  async process(job: Job<AuditLogPayload>): Promise<void> {
    try {
      const logData = this.transformPayloadForDb(job.data)
      await this.addToBatch(logData)
    } catch (error) {
      this.logger.error('Failed to process audit log job %s: %o', job.id, error)
      throw error
    }
  }

  private transformPayloadForDb(payload: AuditLogPayload) {
    return {
      ...payload,
      studioId: payload.studioId || this.studioId,
    }
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
      throw error
    }
  }

  async onModuleDestroy() {
    await this.flushBatch()
  }
}
