import { index, smallint, integer, pgTable as table, uuid, varchar, serial } from 'drizzle-orm/pg-core'
import { relations } from 'drizzle-orm'
import { training } from './training.schema'
import { pass } from './pass.schema'
import { groupSchedule } from './group-schedule.schema'
import { studio } from './studio.schema'
import { groupStyle } from './group-style.schema'
import { staffMember } from './staff-member.schema'
import { GroupStatusPgEnum } from '../database.enums'
import { GroupStatusEnum } from '@app/libs/constants/enums'
import { groupAgeRestriction } from './group-age-restriction.schema'
import { trainingSignup } from './training-signup.schema'
import { groupAgeRestrictionException } from './group-age-restriction-exeption.schema'

export const group = table(
  'group',
  {
    id: serial('id').primaryKey(),
    name: varchar('title').notNull(),
    capacity: smallint('capacity').notNull(),
    status: GroupStatusPgEnum('status').notNull().default(GroupStatusEnum.INACTIVE),
    studioId: uuid('studio_id')
      .references(() => studio.id, { onDelete: 'cascade' })
      .notNull(),
    groupStyleId: integer('group_style_id')
      .references(() => groupStyle.id, { onDelete: 'restrict' })
      .notNull(),
    staffMemberId: uuid('staff_member_id').references(() => staffMember.id, { onDelete: 'set null' }),
  },
  (table) => [
    index().on(table.studioId, table.status),
    index().on(table.staffMemberId, table.status),
    index().on(table.studioId, table.groupStyleId),
    index().on(table.studioId, table.staffMemberId),
  ],
)

export const group_relations = relations(group, ({ one, many }) => ({
  studio: one(studio, { fields: [group.studioId], references: [studio.id] }),
  groupStyle: one(groupStyle, { fields: [group.groupStyleId], references: [groupStyle.id] }),
  trainer: one(staffMember, { fields: [group.staffMemberId], references: [staffMember.id] }),
  groupAgeRestrictions: one(groupAgeRestriction),
  trainings: many(training),
  trainingSignups: many(trainingSignup),
  passes: many(pass),
  groupSchedules: many(groupSchedule),
  groupAgeRestrictionExeptions: many(groupAgeRestrictionException)
}))
