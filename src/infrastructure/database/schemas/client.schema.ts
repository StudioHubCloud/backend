import { timestamp, pgTable as table, uuid } from 'drizzle-orm/pg-core'
import { relations } from 'drizzle-orm'
import { userProfile } from './user-profile.schema'
import { pass } from './pass.schema'
import { payment } from './payment.schema'
import { passActivationRequest } from './pass-activation-request.schema'

export const client = table('client', {
  id: uuid('id').primaryKey().defaultRandom(),
  userProfileId: uuid('user_profile_id')
    .references(() => userProfile.id, { onDelete: 'cascade' })
    .notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
})

export const client_relations = relations(client, ({ one, many }) => ({
  userProfile: one(userProfile, { fields: [client.userProfileId], references: [userProfile.id] }),
  pass: many(pass),
  payments: many(payment),
  passActivationRequests: many(passActivationRequest),
}))
