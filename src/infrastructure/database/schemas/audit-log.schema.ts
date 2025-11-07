import { pgTable, uuid, timestamp, varchar, jsonb, index, integer } from 'drizzle-orm/pg-core'
import { AuditLogOperationPgEnum, AuditLogTriggerPgEnum, AuditLogActionsPgEnum } from '../database.enums'

export const auditLog = pgTable(
  'audit_log',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    timestamp: timestamp('timestamp', { withTimezone: true }).notNull().defaultNow(),

    // Context from decorators
    serviceName: varchar('service_name').notNull(), // 'PassService'
    methodName: varchar('method_name').notNull(), // 'activatePass'
    action: AuditLogActionsPgEnum('action').notNull(), // 'pass_activation'

    // Entity info
    entityName: varchar('entity_name').notNull(), // 'pass'
    entityId: varchar('entity_id').notNull(), // polymorphic ID
    operation: AuditLogOperationPgEnum('operation').notNull(),

    // User context
    telegramId: varchar('telegram_id'),
    userRole: varchar('user_role'),

    // Trigger info
    trigger: AuditLogTriggerPgEnum('trigger').notNull(),

    // Data changes
    oldValue: jsonb('old_value'),
    newValue: jsonb('new_value'),
    changedFields: jsonb('changed_fields'), // array of field names

    // Metadata
    metadata: jsonb('metadata'),

    // Multi-tenant
    studioId: uuid('studio_id').notNull(),

    // Performance tracking
    executionTimeMs: integer('execution_time_ms'),
  },
  (table) => [
    index('audit_log_entity_idx').on(table.entityName, table.entityId),
    index('audit_log_timestamp_idx').on(table.timestamp),
    index('audit_log_action_idx').on(table.action),
    index('audit_log_studio_idx').on(table.studioId),
  ],
)
