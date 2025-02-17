import { pgTable as table, uniqueIndex, uuid, varchar } from 'drizzle-orm/pg-core'
import { relations } from 'drizzle-orm'
import { Customer } from './customer.schema'
import { Studio } from './studio.schema'
import { UserProfile } from './user-profile.schema'

export const Business = table(
  'business',
  {
    id: uuid('id').primaryKey(),
    displayName: varchar('display_name').notNull(),
    publicEmail: varchar('public_email').notNull(),
    phoneNumber: varchar('phone_number').notNull(),
    websiteUrl: varchar('website_url'),
    customerId: uuid('customer_id')
      .notNull()
      .references(() => Customer.id, { onDelete: 'cascade' }),
  },
  (table) => [
    uniqueIndex('[business]displayName-customerId_uindex').on(table.customerId, table.displayName),
    uniqueIndex('[business]publicEmail-customerId_uindex').on(table.customerId, table.publicEmail),
    uniqueIndex('[business]phoneNumber-customerId_uindex').on(table.customerId, table.phoneNumber),
  ],
)

export const business_relations = relations(Business, ({ one, many }) => ({
  customer: one(Customer, { fields: [Business.customerId], references: [Customer.id] }),
  studios: many(Studio),
  userProfiles: many(UserProfile),
}))
