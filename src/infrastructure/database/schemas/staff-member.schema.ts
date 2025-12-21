import { timestamp, pgTable as table, uuid } from 'drizzle-orm/pg-core'
import { relations } from 'drizzle-orm'
import { userProfile } from './user-profile.schema'
import { group } from './group.schema'
import { payment } from './payment.schema'

export const staffMember = table('staff_member', {
  id: uuid('id').primaryKey().defaultRandom(),
  userProfileId: uuid('user_profile_id')
    .references(() => userProfile.id)
    .notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
})

export const staff_member_relations = relations(staffMember, ({ one, many }) => ({
  userProfile: one(userProfile, { fields: [staffMember.userProfileId], references: [userProfile.id] }),
  groups: many(group),
  payments: many(payment),
}))
