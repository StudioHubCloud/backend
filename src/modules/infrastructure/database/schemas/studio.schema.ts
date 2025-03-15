import { pgTable as table, uuid, varchar, index } from 'drizzle-orm/pg-core'
import { relations } from 'drizzle-orm'
import { Business } from './business.schema'
import { Group } from './group.schema'
import { GroupStyle } from './group-style.schema'

export const Studio = table(
  'studio',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    title: varchar('title'),
    streetAddress1: varchar('street_address_1').notNull(),
    streetAddress2: varchar('street_address_2'),
    city: varchar('city'),
    state: varchar('state'),
    country: varchar('country'),
    businessId: uuid('business_id').references(() => Business.id),
  },
  (table) => [index('[studio]businessId_index').on(table.businessId)],
)
export const studio_relations = relations(Studio, ({ one, many }) => ({
  business: one(Business, { fields: [Studio.businessId], references: [Business.id] }),
  groups: many(Group),
  groupStyles: many(GroupStyle),
}))
