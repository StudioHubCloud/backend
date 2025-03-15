import { index, pgTable as table, uniqueIndex, uuid, varchar } from 'drizzle-orm/pg-core'
import { relations } from 'drizzle-orm'
import { Business } from './business.schema'
import { StaffMember } from './staff-member.schema'
import { Client } from './client.schema'
import { UserProfileRolePgEnum, UserProfileStatusPgEnum } from '../database.enums'

export const UserProfile = table(
  'user_profile',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    fullName: varchar('full_name').notNull(),
    phoneNumber: varchar('phone_number').notNull(),
    telegramId: varchar('telegram_id').notNull(),
    role: UserProfileRolePgEnum().notNull().notNull(),
    status: UserProfileStatusPgEnum().notNull(),
    businessId: uuid('business_id')
      .references(() => Business.id, { onDelete: 'cascade' })
      .notNull(),
  },
  (table) => [
    index('[user_profile]businessId-role-status_index').on(table.businessId, table.role, table.status),
    uniqueIndex('[user_profile]telegramId-role-businessId_uindex').on(table.telegramId, table.role, table.businessId),
    uniqueIndex('[user_profile]phoneNumber-role-businessId_uindex').on(table.phoneNumber, table.role, table.businessId),
  ],
)

export const user_profile_relations = relations(UserProfile, ({ one }) => ({
  business: one(Business, { fields: [UserProfile.businessId], references: [Business.id] }),
  staffMember: one(StaffMember),
  client: one(Client),
}))
