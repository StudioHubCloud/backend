import { pgTable as table, uuid } from 'drizzle-orm/pg-core'
import { relations } from 'drizzle-orm'
import { UserProfile } from './user-profile.schema'
import { Group } from './group.schema'

export const StaffMember = table('staff_member', {
  id: uuid('id').primaryKey(),
  userProfileId: uuid('user_profile_id').references(() => UserProfile.id),
})

export const staff_member_relations = relations(StaffMember, ({ one, many }) => ({
  user_profile: one(UserProfile),
  groups: many(Group),
}))
