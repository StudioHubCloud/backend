import { pgTable as table, uuid } from 'drizzle-orm/pg-core'
import { relations } from 'drizzle-orm'
import { userProfile } from './user-profile.schema'
import { group } from './group.schema'

export const staffMember = table('staff_member', {
  id: uuid('id').primaryKey().defaultRandom(),
  userProfileId: uuid('user_profile_id').references(() => userProfile.id),
})

export const staff_member_relations = relations(staffMember, ({ one, many }) => ({
  user_profile: one(userProfile),
  groups: many(group),
}))
