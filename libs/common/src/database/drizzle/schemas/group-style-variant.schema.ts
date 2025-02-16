import { index, integer, pgTable as table, uniqueIndex, uuid, varchar } from 'drizzle-orm/pg-core'
import { relations } from 'drizzle-orm'
import { Studio } from './studio.schema'
import { GroupStyle } from './group-style.schema'

export const GroupStyleVariant = table(
  'group_style_variant',
  {
    id: uuid('id').primaryKey(),
    title: varchar('title').notNull(),
    description: varchar('description'),
    studioId: uuid('studio_id')
      .references(() => Studio.id, { onDelete: 'cascade' })
      .notNull(),
    groupStyleId: integer('group_style_id')
      .references(() => GroupStyle.id, { onDelete: 'cascade' })
      .notNull(),
  },
  (table) => [
    index('title_index').on(table.title),
    uniqueIndex('[group_style_variant]groupStyleId-title_uindex').on(table.groupStyleId, table.title),
    uniqueIndex('[group_style_variant]studioId-groupStyleId_uindex').on(table.studioId, table.groupStyleId),
  ],
)

export const grpup_style_variant_relations = relations(GroupStyleVariant, ({ one }) => ({
  studio: one(Studio, { fields: [GroupStyleVariant.studioId], references: [Studio.id] }),
  groupStyle: one(GroupStyle, { fields: [GroupStyleVariant.groupStyleId], references: [GroupStyle.id] }),
}))
