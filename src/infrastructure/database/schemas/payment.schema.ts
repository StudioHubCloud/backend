import { decimal, varchar, pgTable as table, uuid, index, timestamp, text, uniqueIndex } from 'drizzle-orm/pg-core'
import { relations, sql } from 'drizzle-orm'
import { client } from './client.schema'
import { studio } from './studio.schema'
import { pass } from './pass.schema'
import { PaymentStatusPgEnum, PaymentMethodPgEnum } from '../database.enums'

export const payment = table(
  'payment',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    amount: decimal('amount', { precision: 10, scale: 2 }).notNull(),
    currency: varchar('currency', { length: 3 }).notNull().default('UAH'), // ISO 4217 currency code
    status: PaymentStatusPgEnum().notNull(),
    method: PaymentMethodPgEnum().notNull(),
    paidAt: timestamp('paid_at', { mode: 'string' }),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    studioId: uuid('studio_id')
      .references(() => studio.id, { onDelete: 'cascade' })
      .notNull(),
    clientId: uuid('client_id').references(() => client.id, { onDelete: 'set null' }),
    passId: uuid('pass_id').references(() => pass.id, { onDelete: 'set null' }),
    description: text('description'), // "Monthly pass", "Salary March 2024", "Equipment purchase"
    externalTransactionId: varchar('external_transaction_id', { length: 255 }), // Payment gateway ID
  },
  (table) => [
    index().on(table.studioId, table.status),
    index()
      .on(table.clientId, table.status)
      .where(sql`${table.clientId} IS NOT NULL`),
    uniqueIndex('unique_external_transaction_per_studio')
      .on(table.studioId, table.externalTransactionId)
      .where(sql`${table.externalTransactionId} IS NOT NULL`),
  ],
)

export const payment_relations = relations(payment, ({ one }) => ({
  pass: one(pass),
  studio: one(studio, { fields: [payment.studioId], references: [studio.id] }),
  client: one(client, { fields: [payment.clientId], references: [client.id] }),
}))
