import { index, smallint, pgTable as table, uniqueIndex, uuid, varchar } from 'drizzle-orm/pg-core'
import { relations } from 'drizzle-orm'
import { business } from './business.schema'
import { staffMember } from './staff-member.schema'
import { client } from './client.schema'
import { UserProfileRolePgEnum, UserProfileStatusPgEnum } from '../database.enums'

export const userProfile = table(
  'user_profile',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    fullName: varchar('full_name'),
    phoneNumber: varchar('phone_number'),
    telegramId: varchar('telegram_id').notNull(),
    role: UserProfileRolePgEnum().notNull().notNull(),
    status: UserProfileStatusPgEnum().notNull(),
    businessId: uuid('business_id')
      .references(() => business.id, { onDelete: 'cascade' })
      .notNull(),
  },
  (table) => [
    index('[user_profile]businessId-role-status_index').on(table.businessId, table.role, table.status),
    uniqueIndex('[user_profile]telegramId-role-businessId_uindex').on(table.telegramId, table.role, table.businessId),
    uniqueIndex('[user_profile]phoneNumber-role-businessId_uindex').on(table.phoneNumber, table.role, table.businessId),
  ],
)

export const user_profile_relations = relations(userProfile, ({ one }) => ({
  business: one(business, { fields: [userProfile.businessId], references: [business.id] }),
  staffMember: one(staffMember),
  client: one(client),
}))
