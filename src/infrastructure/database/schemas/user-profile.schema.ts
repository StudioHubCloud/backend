import { index, date, pgTable as table, uniqueIndex, uuid, varchar, boolean } from 'drizzle-orm/pg-core'
import { relations } from 'drizzle-orm'
import { staffMember } from './staff-member.schema'
import { client } from './client.schema'
import { UserProfileRolePgEnum, UserProfileStatusPgEnum } from '../database.enums'
import { studio } from './studio.schema'

export const userProfile = table(
  'user_profile',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    firstName: varchar('first_name').notNull().default('unspecified'),
    lastName: varchar('last_name'),
    fullName: varchar('full_name').notNull(),
    phoneNumber: varchar('phone_number'),
    telegramId: varchar('telegram_id').notNull(),
    dateOfBirth: date('date_of_birth', { mode: 'string' }),
    consentToRules: boolean('consent_to_rules').notNull().default(false),
    role: UserProfileRolePgEnum().notNull().notNull(),
    status: UserProfileStatusPgEnum().notNull(),
    trial_discount: boolean('trial_discount').notNull().default(true),
    studioId: uuid('studio_id')
      .references(() => studio.id, { onDelete: 'cascade' })
      .notNull(),
  },
  (table) => [
    uniqueIndex().on(table.telegramId, table.role, table.studioId),
    uniqueIndex().on(table.phoneNumber, table.role, table.studioId),
  ],
)

export const user_profile_relations = relations(userProfile, ({ one }) => ({
  studio: one(studio, { fields: [userProfile.studioId], references: [studio.id] }),
  staffMember: one(staffMember),
  client: one(client),
}))
