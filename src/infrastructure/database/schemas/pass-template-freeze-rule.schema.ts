import { timestamp, serial, smallint, pgTable as table, uniqueIndex, uuid } from 'drizzle-orm/pg-core'
import { relations } from 'drizzle-orm'
import { passTemplate } from './pass-template.schema'

/** A row means a pass of this template can be frozen, once per validity period, for up to `maxDays` days. No row: it can't. */
export const passTemplateFreezeRule = table(
  'pass_template_freeze_rule',
  {
    id: serial('id').primaryKey(),
    maxDays: smallint('max_days').notNull(),
    passTemplateId: uuid('pass_template_id')
      .references(() => passTemplate.id, { onDelete: 'cascade' })
      .notNull(),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (table) => [uniqueIndex().on(table.passTemplateId)],
)

export const pass_template_freeze_rule_relations = relations(passTemplateFreezeRule, ({ one }) => ({
  passTemplate: one(passTemplate, { fields: [passTemplateFreezeRule.passTemplateId], references: [passTemplate.id] }),
}))
