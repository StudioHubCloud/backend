import { uuid, pgTable as table, varchar, date } from 'drizzle-orm/pg-core'
import { relations } from 'drizzle-orm'
import { studio } from './studio.schema'
import { pass } from './pass.schema'
import { client } from './client.schema'
import { PassActivationFileTypePgEnum } from '../database.enums'

export const passActivationRequest = table('pass_activation_request', {
  id: uuid('id').primaryKey().defaultRandom(),
  fileId: varchar('file_id').notNull(),
  fileType: PassActivationFileTypePgEnum().notNull(),
  passId: uuid('pass_id')
    .references(() => pass.id, { onDelete: 'cascade' })
    .notNull()
    .unique(),
  clientId: uuid('client_id')
    .references(() => client.id, { onDelete: 'cascade' })
    .notNull()
    .unique(),
  studioId: uuid('studio_id')
    .references(() => studio.id, { onDelete: 'cascade' })
    .notNull(),
  createdAt: date('created_at').notNull().defaultNow(),
})

export const pass_activation_request_relations = relations(passActivationRequest, ({ one }) => ({
  studio: one(studio, { fields: [passActivationRequest.studioId], references: [studio.id] }),
  pass: one(pass, { fields: [passActivationRequest.passId], references: [pass.id] }),
  client: one(client, { fields: [passActivationRequest.clientId], references: [client.id] }),
}))
