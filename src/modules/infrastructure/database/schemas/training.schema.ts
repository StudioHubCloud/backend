import { boolean, pgTable as table, timestamp, uuid, index } from 'drizzle-orm/pg-core'
import { relations, sql } from 'drizzle-orm'
import { Group } from './group.schema'
import { StaffMember } from './staff-member.schema'
import { TrainingSchedule } from './training-schedule.schema'

export const Training = table(
  'training',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    date: timestamp('date', { mode: 'string' }).notNull(),
    isCancelled: boolean('is_cancelled').notNull().default(false),
    groupId: uuid('group_id')
      .references(() => Group.id, { onDelete: 'cascade' })
      .notNull(),
    trainerId: uuid('trainer_id').references(() => StaffMember.id, { onDelete: 'set null' }),
  },
  (table) => [
    index('[training]groupId_index').on(table.groupId),
    index('[training]trainerId_index').on(table.trainerId),
    index('[training]date-isCancelled_index').on(table.date, table.isCancelled),
    index('[training]isCancelled(true)_index')
      .using('btree', table.isCancelled)
      .where(sql`${table.isCancelled} = true`),
  ],
)

export const training_relations = relations(Training, ({ one, many }) => ({
  group: one(Group, { fields: [Training.groupId], references: [Group.id] }),
  trainer: one(StaffMember, { fields: [Training.trainerId], references: [StaffMember.id] }),
  trainingSchedules: many(TrainingSchedule),
}))
