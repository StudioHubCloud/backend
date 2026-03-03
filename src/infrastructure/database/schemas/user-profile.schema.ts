import { date, pgTable as table, uniqueIndex, uuid, varchar, boolean, timestamp } from 'drizzle-orm/pg-core'
import { relations } from 'drizzle-orm'
import { staffMember } from './staff-member.schema'
import { client } from './client.schema'
import { FileTypePgEnum, UserProfileRolePgEnum, UserProfileStatusPgEnum } from '../database.enums'
import { studio } from './studio.schema'
import { trainingSignup } from './training-signup.schema'
import { feedbackNotification } from './feedback-notification.schema'
import { userRegisterRequest } from './user-register-request.schema'

export const userProfile = table(
  'user_profile',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    firstName: varchar('first_name').notNull().default('unspecified'),
    lastName: varchar('last_name'),
    fullName: varchar('full_name').notNull(),
    phoneNumber: varchar('phone_number'),
    telegramId: varchar('telegram_id').notNull(),
    telegramUsername: varchar('telegram_username'),
    dateOfBirth: date('date_of_birth', { mode: 'string' }),
    consentToRules: boolean('consent_to_rules').notNull().default(false),
    role: UserProfileRolePgEnum().notNull(),
    fileId: varchar('file_id'),
    fileType: FileTypePgEnum(),
    status: UserProfileStatusPgEnum().notNull(),
    trial_discount: boolean('trial_discount').notNull().default(true),
    studioId: uuid('studio_id')
      .references(() => studio.id, { onDelete: 'cascade' })
      .notNull(),
    createdAt: timestamp('created_at').defaultNow(),
  },
  (table) => [
    uniqueIndex().on(table.telegramId, table.role, table.studioId),
    uniqueIndex().on(table.phoneNumber, table.role, table.studioId),
  ],
)

export const user_profile_relations = relations(userProfile, ({ one, many }) => ({
  studio: one(studio, { fields: [userProfile.studioId], references: [studio.id] }),
  staffMember: one(staffMember),
  client: one(client),
  registerRequest: one(userRegisterRequest),
  feedbackNotification: one(feedbackNotification),
  trainingSignups: many(trainingSignup),
}))
