import { decimal, varchar, pgTable as table, uuid, index, timestamp, integer, boolean } from 'drizzle-orm/pg-core'
import { relations } from 'drizzle-orm'
import { studio } from './studio.schema'
import { staffMember } from './staff-member.schema'
import { StudioPayoutRuleTypePgEnum } from '../database.enums'

export const studioPayoutRule = table(
  'studio_payout_rule',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    name: varchar('name', { length: 255 }).notNull(),
    description: varchar('description', { length: 500 }),
    minSignups: integer('min_signups').notNull().default(0),
    maxSignups: integer('max_signups'),
    type: StudioPayoutRuleTypePgEnum().notNull(),
    amount: decimal('amount', { precision: 10, scale: 2 }),
    isActive: boolean('is_active').notNull().default(true),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
    studioId: uuid('studio_id')
      .references(() => studio.id, { onDelete: 'cascade' })
      .notNull(),
    staffMemberId: uuid('staff_member_id').references(() => staffMember.id, { onDelete: 'cascade' }), // null = applies to all staff
  },
  (table) => [index().on(table.studioId, table.isActive), index().on(table.studioId, table.staffMemberId, table.isActive)],
)

export const studio_payout_rule_relations = relations(studioPayoutRule, ({ one }) => ({
  studio: one(studio, { fields: [studioPayoutRule.studioId], references: [studio.id] }),
  staffMember: one(staffMember, { fields: [studioPayoutRule.staffMemberId], references: [staffMember.id] }),
}))
