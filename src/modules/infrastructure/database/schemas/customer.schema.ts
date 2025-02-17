import { pgTable as table, uniqueIndex, uuid, varchar } from 'drizzle-orm/pg-core'
import { relations, sql } from 'drizzle-orm'
import { Subscribtion } from './subscribtion.schema'
import { Business } from './business.schema'

export const Customer = table(
  'customer',
  {
    id: uuid('id').primaryKey(),
    fullName: varchar('full_name').notNull(),
    emailAddress: varchar('email_address').notNull(),
    phone_number: varchar('phone_number').unique(),
    telegramId: varchar('telegram_id').unique(),
    countryCode: varchar('country_code').default('UA'),
  },
  (table) => [
    uniqueIndex('[customer]emailAddress_uindex').on(sql`LOWER(${table.emailAddress})`),
    uniqueIndex('[customer]telegramId_uindex').on(table.telegramId),
  ],
)

export const customer_relations = relations(Customer, ({ one, many }) => ({
  subscribtion: one(Subscribtion),
  businesess: many(Business),
}))
