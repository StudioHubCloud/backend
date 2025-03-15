import { smallint, pgTable as table, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core'
import { relations } from 'drizzle-orm'
import { Group } from './group.schema'
import { GroupScheduleDay } from './group-schedule-day.schema'

export const GroupSchedule = table(
  'group_schedule',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    time: timestamp('time', { mode: 'string' }).notNull(),
    groupId: uuid('group_id')
      .references(() => Group.id, { onDelete: 'cascade' })
      .notNull(),
    groupScheduleDayId: smallint('group_schedule_day_id')
      .references(() => GroupScheduleDay.id, { onDelete: 'restrict' })
      .notNull(),
  },
  (table) => [uniqueIndex('[group_schedule_time]groupId_uindex').on(table.time, table.groupId)],
)

export const group_schedule_relations = relations(GroupSchedule, ({ one }) => ({
  groupScheduleDays: one(GroupScheduleDay, {
    fields: [GroupSchedule.groupScheduleDayId],
    references: [GroupScheduleDay.id],
  }),
}))
