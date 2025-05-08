import { index, smallint, smallserial, pgTable as table, uniqueIndex, varchar } from 'drizzle-orm/pg-core'
import { relations, sql } from 'drizzle-orm'
import { subscribtion } from './subscribtion.schema'
import { SubscribtionTierPgEnum } from '../database.enums'

export const subscribtionPlan = table(
  'subscribtion_plan',
  {
    id: smallserial('id').primaryKey(),
    tier: SubscribtionTierPgEnum().notNull(),
    description: varchar('description').notNull(),
    price: smallint('price').notNull(),
    currencyCode3: varchar('currency_code_3', { length: 3 }).notNull(),
  },
  (table) => [
    index().on(table.tier),
    uniqueIndex('subscribtionPlan_currencyCode3').on(sql`UPPER(${table.currencyCode3})`),
  ],
)

export const subscribtion_plan_relations = relations(subscribtionPlan, ({ many }) => ({
  subscribtions: many(subscribtion),
}))
