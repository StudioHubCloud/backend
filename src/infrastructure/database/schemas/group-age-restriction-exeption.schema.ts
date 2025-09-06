import { uuid, pgTable as table, serial, uniqueIndex, integer } from 'drizzle-orm/pg-core'
import { relations } from 'drizzle-orm'
import { group } from './group.schema'
import { userProfile } from './user-profile.schema'

export const groupAgeRestrictionException = table(
  'group_age_restriction_exception',
  {
    id: serial('id').primaryKey(),
    userProfileId: uuid('user_profile_id')
      .references(() => userProfile.id, { onDelete: 'cascade' })
      .notNull(),
    groupId: integer('group_id')
      .references(() => group.id, { onDelete: 'cascade' })
      .notNull(),
  },
  (table) => [uniqueIndex().on(table.userProfileId, table.groupId)],
)


export const group_age_restriction_exception_relations = relations(groupAgeRestrictionException, ({ one }) => ({
  userProfile: one(userProfile, { fields: [groupAgeRestrictionException.userProfileId], references: [userProfile.id] }),
  group: one(group, { fields: [groupAgeRestrictionException.groupId], references: [group.id] }),
}))
