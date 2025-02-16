import { smallint, pgEnum, pgTable as table, timestamp, uuid, index } from 'drizzle-orm/pg-core'
import { relations } from 'drizzle-orm'
import { Group } from './group.schema'
import { Client } from './client.schema'
import { TrainingSchedule } from './training-schedule.schema'

export const StatusEnum = pgEnum('status', ['active', 'paused', 'expired'])

type Status = (typeof StatusEnum.enumValues)[number]

export const Pass = table(
  'pass',
  {
    id: uuid('id').primaryKey(),
    price: smallint('price').notNull(),
    length: smallint('length').notNull(),
    startDate: timestamp('start_date', { mode: 'string' }).notNull(),
    endDate: timestamp('end_date', { mode: 'string' }).notNull(),
    pausedFromDate: timestamp('paused_from_date', { mode: 'string' }),
    pausedToDate: timestamp('paused_to_date', { mode: 'string' }),
    expiredFromDate: timestamp('expired_from_date', { mode: 'string' }),
    status: StatusEnum().notNull(),
    groupId: uuid('group_id').references(() => Group.id, { onDelete: 'set null' }),
    clientId: uuid('client_id')
      .references(() => Client.id, { onDelete: 'cascade' })
      .notNull(),
  },
  (table) => [
    index('[pass]groupId_index').on(table.groupId),
    index('[pass]clientId_index').on(table.clientId),
    index('[pass]groupId-status_index').on(table.groupId, table.status),
    index('[pass]clientId-status_index').on(table.clientId, table.status),
  ],
)

export const pass_relations = relations(Pass, ({ many, one }) => ({
  trainingSchedules: many(TrainingSchedule),
  group: one(Group, { fields: [Pass.groupId], references: [Group.id] }),
  client: one(Client, { fields: [Pass.clientId], references: [Client.id] }),
}))
