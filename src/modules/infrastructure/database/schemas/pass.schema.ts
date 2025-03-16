import { smallint, pgTable as table, timestamp, uuid, index } from 'drizzle-orm/pg-core'
import { relations } from 'drizzle-orm'
import { group } from './group.schema'
import { client } from './client.schema'
import { trainingSchedule } from './training-schedule.schema'
import { PassStatusPgEnum } from '../database.enums'

export const pass = table(
  'pass',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    price: smallint('price').notNull(),
    length: smallint('length').notNull(),
    startDate: timestamp('start_date', { mode: 'string' }).notNull(),
    endDate: timestamp('end_date', { mode: 'string' }).notNull(),
    pausedFromDate: timestamp('paused_from_date', { mode: 'string' }),
    pausedToDate: timestamp('paused_to_date', { mode: 'string' }),
    expiredFromDate: timestamp('expired_from_date', { mode: 'string' }),
    status: PassStatusPgEnum().notNull(),
    groupId: uuid('group_id').references(() => group.id, { onDelete: 'set null' }),
    clientId: uuid('client_id')
      .references(() => client.id, { onDelete: 'cascade' })
      .notNull(),
  },
  (table) => [
    index('[pass]groupId_index').on(table.groupId),
    index('[pass]clientId_index').on(table.clientId),
    index('[pass]groupId-status_index').on(table.groupId, table.status),
    index('[pass]clientId-status_index').on(table.clientId, table.status),
  ],
)

export const pass_relations = relations(pass, ({ many, one }) => ({
  trainingSchedules: many(trainingSchedule),
  group: one(group, { fields: [pass.groupId], references: [group.id] }),
  client: one(client, { fields: [pass.clientId], references: [client.id] }),
}))
