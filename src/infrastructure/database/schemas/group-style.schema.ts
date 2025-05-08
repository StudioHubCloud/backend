import { index, serial, pgTable as table, uniqueIndex, uuid, varchar, integer } from 'drizzle-orm/pg-core'
import { relations } from 'drizzle-orm'
import { studio } from './studio.schema'
import { group } from './group.schema'
import { groupStyleVariant } from './group-style-variant.schema'

export const groupStyle = table(
  'group_style',
  {
    id: serial('id').primaryKey(),
    title: varchar('title').notNull(),
    emoji: varchar('emoji').notNull().default('🔘'),
    sortGroupPriority: integer('sort_group_priority').notNull().default(0),
    studioId: uuid('studio_id')
      .references(() => studio.id, { onDelete: 'cascade' })
      .notNull(),
  },
  (table) => [
    index().on(table.studioId),
    uniqueIndex().on(table.studioId, table.title),
  ],
)

export const group_style_relations = relations(groupStyle, ({ one, many }) => ({
  studio: one(studio, { fields: [groupStyle.studioId], references: [studio.id] }),
  groupStyleVariantss: many(groupStyleVariant),
  groups: many(group),
}))
