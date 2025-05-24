import { smallint, pgTable as table, timestamp, uuid, index, integer } from 'drizzle-orm/pg-core'
import { relations } from 'drizzle-orm'
import { group } from './group.schema'
import { client } from './client.schema'
import { trainingSignup } from './training-signup.schema'
import { PassStatusPgEnum } from '../database.enums'
import { studio } from './studio.schema'
import { passTemplate } from './pass-template.schema'

export const pass = table(
  'pass',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    availableSlots: smallint('available_slots').notNull().default(0),
    startDate: timestamp('start_date', { mode: 'string' }).notNull(),
    endDate: timestamp('end_date', { mode: 'string' }).notNull(),
    pausedFromDate: timestamp('paused_from_date', { mode: 'string' }),
    pausedToDate: timestamp('paused_to_date', { mode: 'string' }),
    expiredFromDate: timestamp('expired_from_date', { mode: 'string' }),
    status: PassStatusPgEnum().notNull(),
    passTemplateid: uuid('pass_template_id')
      .references(() => passTemplate.id, { onDelete: 'cascade' })
      .notNull(),
    clientId: uuid('client_id')
      .references(() => client.id, { onDelete: 'cascade' })
      .notNull(),
    studioId: uuid('studio_id')
      .references(() => studio.id, { onDelete: 'cascade' })
      .notNull(),
    groupId: uuid('group_id').references(() => group.id, { onDelete: 'set null' }),
  },
  (table) => [
    index().on(table.groupId),
    index().on(table.clientId),
    index().on(table.studioId),
    index().on(table.groupId, table.status),
    index().on(table.clientId, table.status),
  ],
)

export const pass_relations = relations(pass, ({ many, one }) => ({
  trainingSignups: many(trainingSignup),
  group: one(group, { fields: [pass.groupId], references: [group.id] }),
  studio: one(studio, { fields: [pass.studioId], references: [studio.id] }),
  client: one(client, { fields: [pass.clientId], references: [client.id] }),
  passTemplate: one(passTemplate, { fields: [pass.passTemplateid], references: [passTemplate.id] }),
}))
