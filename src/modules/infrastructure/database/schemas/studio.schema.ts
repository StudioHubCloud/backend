import { pgTable as table, uuid, varchar, index } from 'drizzle-orm/pg-core'
import { relations } from 'drizzle-orm'
import { business } from './business.schema'
import { group } from './group.schema'
import { groupStyle } from './group-style.schema'

export const studio = table(
  'studio',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    title: varchar('title'),
    streetAddress1: varchar('street_address_1').notNull(),
    streetAddress2: varchar('street_address_2'),
    city: varchar('city'),
    state: varchar('state'),
    country: varchar('country'),
    businessId: uuid('business_id').references(() => business.id),
  },
  (table) => [index('[studio]businessId_index').on(table.businessId)],
)
export const studio_relations = relations(studio, ({ one, many }) => ({
  business: one(business, { fields: [studio.businessId], references: [business.id] }),
  groups: many(group),
  groupStyles: many(groupStyle),
}))
