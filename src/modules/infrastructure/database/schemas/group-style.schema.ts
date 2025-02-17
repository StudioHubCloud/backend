import { index, serial, pgTable as table, uniqueIndex, uuid, varchar } from 'drizzle-orm/pg-core'
import { relations } from 'drizzle-orm'
import { Studio } from './studio.schema'
import { Group } from './group.schema'
import { GroupStyleVariant } from './group-style-variant.schema'

export const GroupStyle = table(
  'group_style',
  {
    id: serial('id').primaryKey(),
    title: varchar('title').notNull(),
    studioId: uuid('studio_id')
      .references(() => Studio.id, { onDelete: 'cascade' })
      .notNull(),
  },
  (table) => [
    index('studioId_index').on(table.studioId),
    uniqueIndex('[group_style]studioId-title_uindex').on(table.studioId, table.title),
  ],
)

export const grpup_style_relations = relations(GroupStyle, ({ one, many }) => ({
  studio: one(Studio, { fields: [GroupStyle.studioId], references: [Studio.id] }),
  groupStyleVariants: many(GroupStyleVariant),
  groups: many(Group),
}))
