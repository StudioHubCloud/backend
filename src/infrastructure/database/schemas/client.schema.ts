import { pgTable as table, uuid } from 'drizzle-orm/pg-core'
import { relations } from 'drizzle-orm'
import { userProfile } from './user-profile.schema'

export const client = table('client', {
  id: uuid('id').primaryKey().defaultRandom(),
  userProfileId: uuid('user_profile_id')
    .references(() => userProfile.id, { onDelete: 'cascade' })
    .notNull(),
})

export const client_relations = relations(client, ({ one }) => ({
  user_profile: one(userProfile, { fields: [client.userProfileId], references: [userProfile.id] }),
}))
