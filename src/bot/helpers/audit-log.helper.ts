import { AuditLogActions, AuditLogServiceOperation, AuditLogTrigger } from '@app/libs'
import { BotContext } from '../bot.context'
import { IAuditLogTelegramContext } from '../libs'
import { UserHelper } from './user.helper'
import { BotHelper } from './bot.helper'

export class AuditLogHelper {
  private constructor() {}

  /**
   * Initialize audit context at the start of an action
   * Call this early in your handler (e.g., when user clicks a button)
   */
  static startAction(
    ctx: BotContext,
    action: AuditLogActions,
    trigger: AuditLogTrigger,
    operations: AuditLogServiceOperation[] = [],
  ) {
    const actionId = crypto.randomUUID()
    const user = UserHelper.getUser(ctx)
    const { textPayload } = BotHelper.getUpdatePayload(ctx)

    ctx.store.audit = {
      action,
      actionId,
      trigger,
      command: textPayload,
      actionResponseTimeMs: null,
      telegramId: user.telegramId,
      operations: [],
    }

    if (operations && operations.length > 0) {
      ctx.store.audit.operations.push(...operations)
    }
  }

  static startScheduledTaskAction(action: AuditLogActions, operations: AuditLogServiceOperation[] = []) {
    const actionId = crypto.randomUUID()
    return {
      action,
      actionId,
      trigger: AuditLogTrigger.SCHEDULED_TASK,
      actionResponseTimeMs: null,
      operations: operations || [],
    }
  }

  /**
   * Add an operation to the current action
   * Call this in your service methods when data is modified
   */
  static addOperation(ctx: BotContext, operation: AuditLogServiceOperation): void {
    const auditData = AuditLogHelper.getAuditData(ctx)
    if (!auditData) {
      throw new Error('Audit context not initialized. Call startAction first.')
    }

    auditData.operations.push(operation)
  }

  static trackResponseTime(ctx: BotContext, auditActionResponseTimeMs: number): void {
    const auditData = AuditLogHelper.getAuditData(ctx)
    if (!auditData) {
      return
    }
    auditData.actionResponseTimeMs = auditActionResponseTimeMs
  }

  /**
   * Get current audit context (for middleware to process)
   */
  static getAuditData(ctx: BotContext): IAuditLogTelegramContext | null {
    return ctx.store.audit || null
  }

  /**
   * Clear audit data after processing (called by middleware)
   */
  static clearAuditData(ctx: BotContext): void {
    ctx.store.audit = null
  }
}
