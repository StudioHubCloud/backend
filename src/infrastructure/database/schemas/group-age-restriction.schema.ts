import { index, serial, smallint, pgTable as table, integer, timestamp } from 'drizzle-orm/pg-core'
import { relations } from 'drizzle-orm'
import { group } from './group.schema'

export const groupAgeRestriction = table(
  'group_age_restriction',
  {
    id: serial('id').primaryKey(),
    minAge: smallint('min_age'),
    maxAge: smallint('max_age'),
    allowedThreshold: smallint('allowed_threshold'),
    groupId: integer('group_id')
      .references(() => group.id, { onDelete: 'cascade' })
      .notNull(),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (table) => [index().on(table.groupId)],
)

export const group_age_restriction_relations = relations(groupAgeRestriction, ({ one }) => ({
  group: one(group, { fields: [groupAgeRestriction.groupId], references: [group.id] }),
}))
