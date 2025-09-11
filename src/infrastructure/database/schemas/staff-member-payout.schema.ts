import { decimal, varchar, pgTable as table, uuid, timestamp, text, index } from 'drizzle-orm/pg-core'
import { relations } from 'drizzle-orm'
import { studio } from './studio.schema'
import { staffMember } from './staff-member.schema'
import { training } from './training.schema'

export const staffMemberPayout = table(
  'staff_member_payout',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    amount: decimal('amount', { precision: 10, scale: 2 }).notNull(),
    currency: varchar('currency', { length: 3 }).notNull().default('UAH'), // ISO 4217 currency code
    paidAt: timestamp('paid_at', { mode: 'string' }),
    studioId: uuid('studio_id')
      .references(() => studio.id, { onDelete: 'cascade' })
      .notNull(),
    staffMemberId: uuid('staff_member_id').references(() => staffMember.id, { onDelete: 'cascade' }),
    description: text('description'), // "Monthly pass", "Salary March 2024", "Equipment purchase"
  },
  (table) => [
    index().on(table.studioId, table.staffMemberId),
    index().on(table.studioId, table.staffMemberId, table.paidAt)
  ],
)

export const staff_member_payout_relations = relations(staffMemberPayout, ({ one, many }) => ({
  studio: one(studio, { fields: [staffMemberPayout.studioId], references: [studio.id] }),
  staffMember: one(staffMember, { fields: [staffMemberPayout.staffMemberId], references: [staffMember.id] }),
  trainings: many(training),
}))
