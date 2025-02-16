import { check, serial, smallint, pgTable as table, varchar } from 'drizzle-orm/pg-core'
import { relations, sql } from 'drizzle-orm'
import { GroupSchedule } from './group-schedule.schema'

export const GroupScheduleDay = table(
  'group_schedule_day',
  {
    id: serial('id').primaryKey(),
    dayIndex: smallint('day_index').unique().notNull(),
    dayTitleLong: varchar('day_title_long').unique().notNull(),
    dayTitleShort: varchar('day_title_short', { length: 3 }).unique().notNull(),
  },
  (table) => [check('[group_schedule_day]dayIndex_check', sql`${table.dayIndex} >= 0 AND ${table.dayIndex} <= 6`)],
)

export const group_schedule_day_relations = relations(GroupScheduleDay, ({ many }) => ({
  groupSchedules: many(GroupSchedule),
}))
