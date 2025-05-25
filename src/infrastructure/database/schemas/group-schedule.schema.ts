import { smallint, pgTable as table, varchar, uniqueIndex, uuid } from 'drizzle-orm/pg-core'
import { relations } from 'drizzle-orm'
import { group } from './group.schema'
import { groupScheduleDay } from './group-schedule-day.schema'
import { groupStyleVariant } from './group-style-variant.schema'

export const groupSchedule = table(
  'group_schedule',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    time: varchar('time').notNull(),
    groupId: uuid('group_id')
      .references(() => group.id, { onDelete: 'cascade' })
      .notNull(),
    groupScheduleDayId: smallint('group_schedule_day_id')
      .references(() => groupScheduleDay.id, { onDelete: 'restrict' })
      .notNull(),
    groupStyleVariantId: uuid('group_style_variant_id').references(() => groupStyleVariant.id, { onDelete: 'set null' }),
  },
  (table) => [uniqueIndex().on(table.groupId, table.time, table.groupScheduleDayId)],
)

export const group_schedule_relations = relations(groupSchedule, ({ one }) => ({
  group: one(group, { fields: [groupSchedule.groupId], references: [group.id] }),
  groupScheduleDays: one(groupScheduleDay, {
    fields: [groupSchedule.groupScheduleDayId],
    references: [groupScheduleDay.id],
  }),
  groupStyleVariant: one(groupStyleVariant, {
    fields: [groupSchedule.groupStyleVariantId],
    references: [groupStyleVariant.id],
  }),
}))
