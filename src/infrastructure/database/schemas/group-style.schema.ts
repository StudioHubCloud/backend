import { index, serial, pgTable as table, uniqueIndex, uuid, varchar } from 'drizzle-orm/pg-core'
import { relations } from 'drizzle-orm'
import { studio } from './studio.schema'
import { group } from './group.schema'
import { groupStyleVariant } from './group-style-variant.schema'

export const groupStyle = table(
  'group_style',
  {
    id: serial('id').primaryKey(),
    title: varchar('title').notNull(),
    studioId: uuid('studio_id')
      .references(() => studio.id, { onDelete: 'cascade' })
      .notNull(),
  },
  (table) => [
    index('studioId_index').on(table.studioId),
    uniqueIndex('[group_style]studioId-title_uindex').on(table.studioId, table.title),
  ],
)

export const grpup_style_relations = relations(groupStyle, ({ one, many }) => ({
  studio: one(studio, { fields: [groupStyle.studioId], references: [studio.id] }),
  groupStyleVariantss: many(groupStyleVariant),
  groups: many(group),
}))
