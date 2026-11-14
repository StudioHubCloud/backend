import { index, integer, pgTable as table, primaryKey, timestamp, uuid } from 'drizzle-orm/pg-core'
import { relations } from 'drizzle-orm'
import { pass } from './pass.schema'
import { group } from './group.schema'

/**
 * Groups a FIXED group pass covers (pass ↔ group, many-to-many). One row for an ordinary pass, any number for a
 * `pass_template.multi_group` one (PRO); none for FLEX (any group) and individual passes. Studio: through the pass.
 */
export const passGroup = table(
  'pass_group',
  {
    passId: uuid('pass_id')
      .references(() => pass.id, { onDelete: 'cascade' })
      .notNull(),
    groupId: integer('group_id')
      .references(() => group.id, { onDelete: 'cascade' })
      .notNull(),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (table) => [primaryKey({ columns: [table.passId, table.groupId] }), index().on(table.groupId)],
)

export const pass_group_relations = relations(passGroup, ({ one }) => ({
  pass: one(pass, { fields: [passGroup.passId], references: [pass.id] }),
  group: one(group, { fields: [passGroup.groupId], references: [group.id] }),
}))
