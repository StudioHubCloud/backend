import { pgTable as table, uniqueIndex, uuid, varchar } from 'drizzle-orm/pg-core'
import { relations, sql } from 'drizzle-orm'
import { subscribtion } from './subscribtion.schema'
import { business } from './business.schema'

export const customer = table(
  'customer',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    fullName: varchar('full_name').notNull(),
    emailAddress: varchar('email_address'),
    phoneNumber: varchar('phone_number').unique(),
    telegramId: varchar('telegram_id').unique(),
    countryCode: varchar('country_code').default('UA'),
  },
  (table) => [
    uniqueIndex('[customer]emailAddress_uindex').on(sql`LOWER(${table.emailAddress})`),
    uniqueIndex('[customer]telegramId_uindex').on(table.telegramId),
  ],
)

export const customer_relations = relations(customer, ({ one, many }) => ({
  subscribtion: one(subscribtion),
  businesess: many(business),
}))
