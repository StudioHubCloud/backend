import { decimal, varchar, pgTable as table, uuid, index, timestamp, text, uniqueIndex } from 'drizzle-orm/pg-core'
import { relations, sql } from 'drizzle-orm'
import { client } from './client.schema'
import { studio } from './studio.schema'
import { pass } from './pass.schema'
import { userProfile } from './user-profile.schema'
import { staffMember } from './staff-member.schema'
import { PaymentTypePgEnum, PaymentStatusPgEnum, PaymentMethodPgEnum } from '../database.enums'

export const payment = table(
  'payment',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    amount: decimal('amount', { precision: 10, scale: 2 }).notNull(),
    currency: varchar('currency', { length: 3 }).notNull().default('UAH'), // ISO 4217 currency code
    type: PaymentTypePgEnum().notNull(),
    status: PaymentStatusPgEnum().notNull(),
    method: PaymentMethodPgEnum().notNull(),
    paidAt: timestamp('paid_at', { mode: 'string' }),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    studioId: uuid('studio_id')
      .references(() => studio.id, { onDelete: 'cascade' })
      .notNull(),
    clientId: uuid('client_id').references(() => client.id, { onDelete: 'set null' }),
    passId: uuid('pass_id').references(() => pass.id, { onDelete: 'set null' }),
    staffMemberId: uuid('staff_member_id').references(() => staffMember.id, { onDelete: 'set null' }),
    description: text('description'), // "Monthly pass", "Salary March 2024", "Equipment purchase"
    externalTransactionId: varchar('external_transaction_id', { length: 255 }), // Payment gateway ID
  },
  (table) => [
    index().on(table.studioId, table.type, table.status),
    index()
      .on(table.clientId, table.status)
      .where(sql`${table.clientId} IS NOT NULL`),
    index()
      .on(table.staffMemberId, table.status)
      .where(sql`${table.staffMemberId} IS NOT NULL`),
    index()
      .on(table.staffMemberId, table.paidAt)
      .where(sql`${table.staffMemberId} IS NOT NULL AND ${table.type} = 'outgoing' AND ${table.status} = 'completed'`),
    uniqueIndex('unique_external_transaction_per_studio')
      .on(table.studioId, table.externalTransactionId)
      .where(sql`${table.externalTransactionId} IS NOT NULL`),
    uniqueIndex('unique_outgoing_payout_per_trainer_per_day').on(table.staffMemberId, table.paidAt).where(
      sql`${table.staffMemberId} IS NOT NULL AND ${table.type} = 'outgoing' AND ${table.status} = 'completed'`,
    ),
  ],
)

export const payment_relations = relations(payment, ({ one }) => ({
  pass: one(pass),
  studio: one(studio, { fields: [payment.studioId], references: [studio.id] }),
  client: one(client, { fields: [payment.clientId], references: [client.id] }),
  staffMember: one(staffMember, { fields: [payment.staffMemberId], references: [staffMember.id] }),
}))
