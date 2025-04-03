import { index, integer, pgTable as table, uniqueIndex, uuid, varchar } from 'drizzle-orm/pg-core'
import { relations } from 'drizzle-orm'
import { studio } from './studio.schema'
import { groupStyle } from './group-style.schema'
import { groupSchedule } from './group-schedule.schema'

export const groupStyleVariant = table(
  'group_style_variant',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    title: varchar('title').notNull(),
    description: varchar('description'),
    studioId: uuid('studio_id')
      .references(() => studio.id, { onDelete: 'cascade' })
      .notNull(),
    groupStyleId: integer('group_style_id')
      .references(() => groupStyle.id, { onDelete: 'cascade' })
      .notNull(),
  },
  (table) => [
    index('title_index').on(table.title),
    index('[group_style_variant]studioId-groupStyleId_index').on(table.studioId, table.groupStyleId),
    uniqueIndex('[group_style_variant]groupStyleId-title_uindex').on(table.groupStyleId, table.title),
  ],
)

export const grpup_style_variant_relations = relations(groupStyleVariant, ({ one, many }) => ({
  studio: one(studio, { fields: [groupStyleVariant.studioId], references: [studio.id] }),
  groupStyle: one(groupStyle, { fields: [groupStyleVariant.groupStyleId], references: [groupStyle.id] }),
  groupSchedules: many(groupSchedule),
}))
