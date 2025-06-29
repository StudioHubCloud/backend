import { boolean, pgTable as table, timestamp, uuid, index, unique, uniqueIndex } from 'drizzle-orm/pg-core'
import { relations, sql } from 'drizzle-orm'
import { group } from './group.schema'
import { staffMember } from './staff-member.schema'
import { trainingSignup } from './training-signup.schema'
import { groupSchedule } from './group-schedule.schema'

export const training = table(
  'training',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    date: timestamp('date', { mode: 'string', withTimezone: true }).notNull(),
    isCancelled: boolean('is_cancelled').notNull().default(false),
    groupId: uuid('group_id')
      .references(() => group.id, { onDelete: 'cascade' })
      .notNull(),
    trainerId: uuid('trainer_id').references(() => staffMember.id, { onDelete: 'set null' }),
    groupScheduleId: uuid('group_schedule_id').references(() => groupSchedule.id, { onDelete: 'set null' }),
    reminderSent: boolean('reminder_sent').notNull().default(false),
  },
  (table) => [
    uniqueIndex().on(table.date, table.groupId),
    index().on(table.groupId),
    index().on(table.trainerId),
    index().on(table.date, table.isCancelled),
    index().on(table.isCancelled).where(sql`${table.isCancelled} = true`),
  ],
)

export const training_relations = relations(training, ({ one, many }) => ({
  group: one(group, { fields: [training.groupId], references: [group.id] }),
  trainer: one(staffMember, { fields: [training.trainerId], references: [staffMember.id] }),
  groupSchedule: one(groupSchedule, { fields: [training.groupScheduleId], references: [groupSchedule.id] }),
  trainingSignups: many(trainingSignup),
}))
