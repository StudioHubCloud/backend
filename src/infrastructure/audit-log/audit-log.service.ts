import { InjectQueue } from '@nestjs/bullmq'
import { Injectable } from '@nestjs/common'
import { PinoLogger } from 'nestjs-pino'
import { Queue } from 'bullmq'
import { AuditLogOperation, AuditLogPayload, AuditLogTrigger } from '@app/libs'
import { Transaction } from '../database'
import { AUDIT_LOG_QUEUE } from './audit-log.queue'

@Injectable()
export class AuditLogService {
  private entityContext: string | null = null
  private defaultTriggerSource: AuditLogTrigger = AuditLogTrigger.SYSTEM

  constructor(
    @InjectQueue('audit-logs') private auditQueue: Queue,
    private readonly logger: PinoLogger,
  ) {
    this.logger.setContext(AuditLogService.name)
  }

  /**
   * Set entity context for the service (called in service constructor)
   */
  setEntityContext(entityName: string) {
    this.entityContext = entityName
  }

  /**
   * Set default trigger source (e.g., from bot context or cron)
   */
  setTriggerSource(source: AuditLogTrigger) {
    this.defaultTriggerSource = source
  }

  /**
   * Main logging method - fire and forget
   */
  async log(payload: AuditLogPayload, tx?: Transaction): Promise<void> {
    try {
      const enrichedPayload = this.enrichPayload(payload)

      // If we're in a transaction, we need to be careful
      // For now, we'll just queue it immediately
      // In future, we might want to collect logs and send after commit

      await this.auditQueue.add(AUDIT_LOG_QUEUE, enrichedPayload, {
        priority: payload.operation === AuditLogOperation.DELETE ? 1 : 2,
      })

      this.logger.debug('Queued audit log: %s.%s [%s]', payload.entityName, payload.entityId, payload.action)
    } catch (error) {
      // Never fail the main operation due to logging issues
      this.logger.error('Failed to queue audit log for %s.%s: %o', payload.entityName, payload.entityId, error)
    }
  }

  /**
   * Helper to detect changed fields between old and new values
   */
  getChangedFields(oldValue: any, newValue: any): string[] {
    if (!oldValue || !newValue) return []

    const changed: string[] = []
    const allKeys = new Set([...Object.keys(oldValue), ...Object.keys(newValue)])

    for (const key of allKeys) {
      if (JSON.stringify(oldValue[key]) !== JSON.stringify(newValue[key])) {
        changed.push(key)
      }
    }

    return changed
  }

  /**
   * Mask sensitive fields in the data
   */
  maskSensitive(data: any, sensitiveFields: string[]): any {
    if (!data || !sensitiveFields.length) return data

    const masked = { ...data }
    for (const field of sensitiveFields) {
      if (masked[field]) {
        masked[field] = '[REDACTED]'
      }
    }
    return masked
  }

  private enrichPayload(payload: AuditLogPayload): AuditLogPayload {
    const enriched = { ...payload }

    // Add entity context if set
    if (this.entityContext && !enriched.entityName) {
      enriched.entityName = this.entityContext
    }

    // Add trigger source if not specified
    if (!enriched.trigger) {
      enriched.trigger = this.defaultTriggerSource
    }

    // Calculate execution time if start time provided
    if (enriched.executionStartTime) {
      enriched.metadata = {
        ...enriched.metadata,
        executionTimeMs: Date.now() - enriched.executionStartTime,
      }
      delete enriched.executionStartTime
    }

    // Auto-detect changed fields for UPDATE operations
    if (enriched.operation === AuditLogOperation.UPDATE && enriched.oldValue && enriched.newValue) {
      const changedFields = this.getChangedFields(enriched.oldValue, enriched.newValue)
      enriched.metadata = {
        ...enriched.metadata,
        changedFields,
      }
    }

    return enriched
  }
}
