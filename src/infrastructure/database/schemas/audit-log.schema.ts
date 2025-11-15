import { pgTable, uuid, timestamp, varchar, jsonb, index, integer } from 'drizzle-orm/pg-core'
import { AuditLogOperationPgEnum, AuditLogTriggerPgEnum, AuditLogActionsPgEnum, AuditLogEntityPgEnum } from '../database.enums'

export const auditLog = pgTable(
  'audit_log',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    telegramId: varchar('telegram_id'),
    action: AuditLogActionsPgEnum('action').notNull(),
    entity: AuditLogEntityPgEnum('entity').notNull(),
    timestamp: timestamp('timestamp', { withTimezone: true, mode: 'string' }).notNull().defaultNow(),
    actionId: uuid('action_id').notNull(),
    entityId: varchar('entity_id'),
    operation: AuditLogOperationPgEnum('operation'),
    trigger: AuditLogTriggerPgEnum('trigger'),
    payload: jsonb('payload'),
    metadata: jsonb('metadata'),
    actionResponseTimeMs: integer('action_response_time_ms'),
    studioId: uuid('studio_id').notNull(),
  },
  (table) => [
    index('audit_log_entity_idx').on(table.entity, table.entityId),
    index('audit_log_timestamp_idx').on(table.timestamp),
    index('audit_log_action_id_idx').on(table.actionId),
    index('audit_log_action_idx').on(table.action),
    index('audit_log_studio_idx').on(table.studioId),
  ],
)
