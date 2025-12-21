import { pgTable as table, uuid, varchar, boolean, timestamp } from 'drizzle-orm/pg-core'
import { relations } from 'drizzle-orm'
import { group } from './group.schema'
import { groupStyle } from './group-style.schema'
import { customer } from './customer.schema'
import { pass } from './pass.schema'
import { studioPrice } from './studio-price.schema'
import { payment } from './payment.schema'

export const studio = table('studio', {
  id: uuid('id').primaryKey().defaultRandom(),
  title: varchar('title'),
  streetAddress1: varchar('street_address_1').notNull(),
  streetAddress2: varchar('street_address_2'),
  city: varchar('city'),
  state: varchar('state'),
  timeZone: varchar('time_zone').notNull().default('Europe/Kyiv'),
  allowTrainingInsertCron: boolean('allow_training_insert_cron').default(false),
  country: varchar('country'),
  customerId: uuid('customer_id')
    .references(() => customer.id, { onDelete: 'cascade' })
    .notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
})
export const studio_relations = relations(studio, ({ one, many }) => ({
  customer: one(customer, { fields: [studio.customerId], references: [customer.id] }),
  groups: many(group),
  passes: many(pass),
  groupStyles: many(groupStyle),
  studioPrices: many(studioPrice),
  payments: many(payment),
}))
