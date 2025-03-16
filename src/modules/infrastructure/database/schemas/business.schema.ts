import { pgTable as table, uniqueIndex, uuid, varchar } from 'drizzle-orm/pg-core'
import { relations } from 'drizzle-orm'
import { customer } from './customer.schema'
import { studio } from './studio.schema'
import { userProfile } from './user-profile.schema'

export const business = table(
  'business',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    displayName: varchar('display_name').notNull(),
    publicEmail: varchar('public_email').notNull(),
    phoneNumber: varchar('phone_number').notNull(),
    websiteUrl: varchar('website_url'),
    customerId: uuid('customer_id')
      .notNull()
      .references(() => customer.id, { onDelete: 'cascade' }),
  },
  (table) => [
    uniqueIndex('[business]displayName-customerId_uindex').on(table.customerId, table.displayName),
    uniqueIndex('[business]publicEmail-customerId_uindex').on(table.customerId, table.publicEmail),
    uniqueIndex('[business]phoneNumber-customerId_uindex').on(table.customerId, table.phoneNumber),
  ],
)

export const business_relations = relations(business, ({ one, many }) => ({
  customer: one(customer, { fields: [business.customerId], references: [customer.id] }),
  studios: many(studio),
  userProfiles: many(userProfile),
}))
