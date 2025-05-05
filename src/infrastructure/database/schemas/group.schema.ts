import { index, smallint, integer, pgTable as table, uuid, varchar } from 'drizzle-orm/pg-core'
import { relations } from 'drizzle-orm'
import { training } from './training.schema'
import { pass } from './pass.schema'
import { groupSchedule } from './group-schedule.schema'
import { studio } from './studio.schema'
import { groupStyle } from './group-style.schema'
import { staffMember } from './staff-member.schema'
import { GroupStatusPgEnum } from '../database.enums'
import { GroupStatusEnum } from '@app/libs/constants/enums'
import { groupAgeRestriction } from './group-age-restriction'

export const group = table(
  'group',
  {
    id: uuid('id').primaryKey().defaultRandom(),
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
    index('[group]studioId-status_index').on(table.studioId, table.status),
    index('[group]staffMemberId-status_index').on(table.staffMemberId, table.status),
    index('[group]studioId-groupStyleId_uindex').on(table.studioId, table.groupStyleId),
    index('[group]studioId-staffMemberId_uindex').on(table.studioId, table.staffMemberId),
  ],
)

export const group_relations = relations(group, ({ one, many }) => ({
  studio: one(studio, { fields: [group.studioId], references: [studio.id] }),
  groupStyle: one(groupStyle, { fields: [group.groupStyleId], references: [groupStyle.id] }),
  trainer: one(staffMember, { fields: [group.staffMemberId], references: [staffMember.id] }),
  trainings: many(training),
  passes: many(pass),
  groupSchedules: many(groupSchedule),
  groupAgeRestrictions: many(groupAgeRestriction),
}))
