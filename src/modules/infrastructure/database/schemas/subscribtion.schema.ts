import { index, pgEnum, serial, smallserial, pgTable as table, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core'
import { relations } from 'drizzle-orm'
import { Customer } from './customer.schema'
import { SubscribtionPlan } from './subscribtion-plan.schema'

export const SubscribtionStatusEnum = pgEnum('status', ['active', 'paused', 'expired', 'canceled'])

export const Subscribtion = table(
  'subscribtion',
  {
    id: serial('id').primaryKey(),
    pausedFromDate: timestamp('paused_from_date', { mode: 'string' }),
    pausedToDate: timestamp('paused_to_date', { mode: 'string' }),
    expiredFromDate: timestamp('expired_from_date', { mode: 'string' }),
    status: SubscribtionStatusEnum().notNull(),
    subscribtionPlanId: smallserial('subscribtion_plan_id')
      .references(() => SubscribtionPlan.id, { onDelete: 'restrict' })
      .notNull(),
    customerId: uuid('customer_id')
      .references(() => Customer.id, { onDelete: 'cascade' })
      .notNull(),
  },
  (table) => [
    uniqueIndex('[subscribtion]customerId_uindex').on(table.customerId),
    index('[subscribtion]subscribtionPlanId_index').on(table.subscribtionPlanId),
    index('[subscribtion]customerId-status_index').on(table.customerId, table.status),
  ],
)

export const subscribtion_relations = relations(Subscribtion, ({ one }) => ({
  customer: one(Customer, { fields: [Subscribtion.customerId], references: [Customer.id] }),
  subscribtionPlan: one(SubscribtionPlan, { fields: [Subscribtion.subscribtionPlanId], references: [SubscribtionPlan.id] }),
}))
