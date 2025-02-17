import { index, pgEnum, smallint, smallserial, pgTable as table, uniqueIndex, varchar } from 'drizzle-orm/pg-core'
import { relations, sql } from 'drizzle-orm'
import { Subscribtion } from './subscribtion.schema'

export const SubscribtionTierEnum = pgEnum('tier', ['basic', 'professional', 'elite'])

export const SubscribtionPlan = table(
  'subscribtion_plan',
  {
    id: smallserial('id').primaryKey(),
    tier: SubscribtionTierEnum().notNull(),
    description: varchar('description').notNull(),
    price: smallint('price').notNull(),
    currencyCode3: varchar('currency_code_3', { length: 3 }).notNull(),
  },
  (table) => [
    index('[subscribtion_plan]tier_uindex').on(table.tier),
    uniqueIndex('[subscribtion_plan]currencyCode3_uindex').on(sql`UPPER(${table.currencyCode3})`),
  ],
)

export const subscribtion_plan_relations = relations(SubscribtionPlan, ({ many }) => ({
  subscribtions: many(Subscribtion),
}))
