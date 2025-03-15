import { pgTable as table, uuid } from 'drizzle-orm/pg-core'
import { relations } from 'drizzle-orm'
import { UserProfile } from './user-profile.schema'

export const Client = table('client', {
  id: uuid('id').primaryKey().defaultRandom(),
  userProfileId: uuid('user_profile_id')
    .references(() => UserProfile.id, { onDelete: 'cascade' })
    .notNull(),
})

export const client_relations = relations(Client, ({ one }) => ({
  user_profile: one(UserProfile, { fields: [Client.userProfileId], references: [UserProfile.id] }),
}))
