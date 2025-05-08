import { index, serial, smallserial, pgTable as table, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core'
import { relations } from 'drizzle-orm'
import { customer } from './customer.schema'
import { SubscribtionStatusPgEnum } from '../database.enums'
import { subscribtionPlan } from './subscribtion-plan.schema'

export const subscribtion = table(
  'subscribtion',
  {
    id: serial('id').primaryKey(),
    pausedFromDate: timestamp('paused_from_date', { mode: 'string' }),
    pausedToDate: timestamp('paused_to_date', { mode: 'string' }),
    expiredFromDate: timestamp('expired_from_date', { mode: 'string' }),
    status: SubscribtionStatusPgEnum().notNull(),
    subscribtionPlanId: smallserial('subscribtion_plan_id')
      .references(() => subscribtionPlan.id, { onDelete: 'restrict' })
      .notNull(),
    customerId: uuid('customer_id')
      .references(() => customer.id, { onDelete: 'cascade' })
      .notNull(),
  },
  (table) => [
    uniqueIndex().on(table.customerId),
    index().on(table.subscribtionPlanId),
    index().on(table.customerId, table.status),
  ],
)

export const subscribtion_relations = relations(subscribtion, ({ one }) => ({
  customer: one(customer, { fields: [subscribtion.customerId], references: [customer.id] }),
  subscribtionPlan: one(subscribtionPlan, { fields: [subscribtion.subscribtionPlanId], references: [subscribtionPlan.id] }),
}))
