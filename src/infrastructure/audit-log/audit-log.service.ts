import { InjectQueue } from '@nestjs/bullmq'
import { Injectable } from '@nestjs/common'
import { PinoLogger } from 'nestjs-pino'
import { Queue } from 'bullmq'
import { AuditLogPayload } from '@app/libs'
import { AUDIT_LOG_QUEUE } from './audit-log.queue'
import { IAuditLogTelegramContext } from '@app/bot/libs'

@Injectable()
export class AuditLogService {
  constructor(
    @InjectQueue(AUDIT_LOG_QUEUE) private readonly auditQueue: Queue,
    private readonly logger: PinoLogger,
  ) {
    this.logger.setContext(AuditLogService.name)
  }

  /**
   * Log telegram action with multiple operations
   * Called from audit middleware
   */
  async logAction(auditData: IAuditLogTelegramContext): Promise<void> {
    try {
      for (const operation of auditData.operations) {
        await this.log({
          telegramId: auditData.telegramId ?? null,
          action: auditData.action,
          actionResponseTimeMs: auditData.actionResponseTimeMs ?? null,
          entity: operation.entity,
          actionId: auditData.actionId,
          entityId: operation.entityId,
          operation: operation.operation,
          trigger: auditData.trigger,
          timestamp: operation.timestamp ?? new Date().toISOString(),
          payload: operation.payload,
          metadata: {
            ...(auditData.command ? { command: auditData.command } : {}),
            ...operation.metadata,
          },
        })
      }

      this.logger.debug(
        'Queued %d operations for action %s [%s]',
        auditData.operations.length,
        auditData.action,
        auditData.actionId,
      )
    } catch (error) {
      this.logger.error('Failed to queue telegram action %s [%s]: %o', auditData.action, auditData.actionId, error)
      throw error
    }
  }

  /**
   * Main logging method - fire and forget
   */
  async log(payload: AuditLogPayload): Promise<void> {
    try {
      await this.auditQueue.add(AUDIT_LOG_QUEUE, payload)
      this.logger.debug('Queued audit log: %s.%s [%s]', payload.entity, payload.entityId, payload.action)
    } catch (error) {
      this.logger.error('Failed to queue audit log for %s.%s: %o', payload.entity, payload.entityId, error)
    }
  }
}
