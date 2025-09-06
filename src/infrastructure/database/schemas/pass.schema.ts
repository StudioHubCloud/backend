import { smallint, pgTable as table, uuid, index, date, boolean, uniqueIndex, integer } from 'drizzle-orm/pg-core'
import { relations, sql } from 'drizzle-orm'
import { group } from './group.schema'
import { client } from './client.schema'
import { trainingSignup } from './training-signup.schema'
import { PassStatusPgEnum } from '../database.enums'
import { studio } from './studio.schema'
import { passTemplate } from './pass-template.schema'
import { payment } from './payment.schema'

export const pass = table(
  'pass',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    availableSlots: smallint('available_slots').notNull().default(0),
    saleDate: date('sale_date', { mode: 'string' }).notNull(),
    startDate: date('start_date', { mode: 'string' }),
    endDate: date('end_date', { mode: 'string' }),
    reminderSent: boolean('reminder_sent').notNull().default(false),
    status: PassStatusPgEnum().notNull(),
    passTemplateId: uuid('pass_template_id')
      .references(() => passTemplate.id, { onDelete: 'cascade' })
      .notNull(),
    clientId: uuid('client_id')
      .references(() => client.id, { onDelete: 'cascade' })
      .notNull(),
    studioId: uuid('studio_id')
      .references(() => studio.id, { onDelete: 'cascade' })
      .notNull(),
    groupId: integer('group_id').references(() => group.id, { onDelete: 'set null' }),
  },
  (table) => [
    index().on(table.groupId),
    index().on(table.clientId),
    index().on(table.studioId),
    index().on(table.groupId, table.status),
    index().on(table.clientId, table.status),
    uniqueIndex('unique_active_pass_per_client')
      .on(table.clientId)
      .where(sql`${table.status} = 'active'`),
  ],
)

export const pass_relations = relations(pass, ({ many, one }) => ({
  trainingSignups: many(trainingSignup),
  group: one(group, { fields: [pass.groupId], references: [group.id] }),
  studio: one(studio, { fields: [pass.studioId], references: [studio.id] }),
  client: one(client, { fields: [pass.clientId], references: [client.id] }),
  passTemplate: one(passTemplate, { fields: [pass.passTemplateId], references: [passTemplate.id] }),
  payment: one(payment, { fields: [pass.id], references: [payment.passId] }),
}))
