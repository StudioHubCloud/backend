import { index, smallint, integer, pgTable as table, uuid, varchar } from 'drizzle-orm/pg-core'
import { relations } from 'drizzle-orm'
import { Training } from './training.schema'
import { Pass } from './pass.schema'
import { GroupSchedule } from './group-schedule.schema'
import { Studio } from './studio.schema'
import { GroupStyle } from './group-style.schema'
import { StaffMember } from './staff-member.schema'

export const Group = table(
  'group',
  {
    id: uuid('id').primaryKey(),
    name: varchar('title').notNull(),
    capacity: smallint('capacity').notNull(),
    minAgeRequirement: smallint('min_age_requirement'),
    studioId: uuid('studio_id')
      .references(() => Studio.id, { onDelete: 'cascade' })
      .notNull(),
    groupStyleId: integer('group_style_id')
      .references(() => GroupStyle.id, { onDelete: 'restrict' })
      .notNull(),
    staffMemberId: uuid('staff_member_id').references(() => StaffMember.id, { onDelete: 'set null' }),
  },
  (table) => [
    index('[group]studioId_index').on(table.studioId),
    index('[group]staffMemberId_index').on(table.staffMemberId),
    index('[group]studioId-groupStyleId_uindex').on(table.studioId, table.groupStyleId),
    index('[group]studioId-staffMemberId_uindex').on(table.studioId, table.staffMemberId),
  ],
)

export const group_relations = relations(Group, ({ one, many }) => ({
  studio: one(Studio, { fields: [Group.studioId], references: [Studio.id] }),
  groupStyle: one(GroupStyle, { fields: [Group.groupStyleId], references: [GroupStyle.id] }),
  trainer: one(StaffMember, { fields: [Group.staffMemberId], references: [StaffMember.id] }),
  trainings: many(Training),
  passes: many(Pass),
  groupSchedules: many(GroupSchedule),
}))
