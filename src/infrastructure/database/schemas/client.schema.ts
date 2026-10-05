import { timestamp, pgTable as table, uuid, AnyPgColumn } from 'drizzle-orm/pg-core'
import { relations } from 'drizzle-orm'
import { userProfile } from './user-profile.schema'
import { pass } from './pass.schema'
import { payment } from './payment.schema'
import { passActivationRequest } from './pass-activation-request.schema'
import { personalTrainingSignup } from './personal-training-signup.schema'

export const client = table('client', {
  id: uuid('id').primaryKey().defaultRandom(),
  userProfileId: uuid('user_profile_id')
    .references(() => userProfile.id, { onDelete: 'cascade' })
    .notNull(),
  // Pass the client works with (switcher in "Мій абонемент"); null or not active → oldest valid active pass
  currentPassId: uuid('current_pass_id').references((): AnyPgColumn => pass.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at').notNull().defaultNow(),
})

export const client_relations = relations(client, ({ one, many }) => ({
  userProfile: one(userProfile, { fields: [client.userProfileId], references: [userProfile.id] }),
  pass: many(pass),
  payments: many(payment),
  passActivationRequests: many(passActivationRequest),
  personalTrainingSignups: many(personalTrainingSignup),
}))
