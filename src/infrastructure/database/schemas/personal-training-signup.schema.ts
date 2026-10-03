import { pgTable as table, uuid, timestamp, index, uniqueIndex } from 'drizzle-orm/pg-core'
import { relations, sql } from 'drizzle-orm'
import { pass } from './pass.schema'
import { client } from './client.schema'
import { staffMember } from './staff-member.schema'
import { studio } from './studio.schema'
import { PersonalTrainingSignupStatusPgEnum } from '../database.enums'
import { PersonalTrainingSignupStatusEnum } from '@app/libs/constants/enums'

export const personalTrainingSignup = table(
  'personal_training_signup',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    status: PersonalTrainingSignupStatusPgEnum().notNull().default(PersonalTrainingSignupStatusEnum.SCHEDULED),
    scheduledAt: timestamp('scheduled_at', { mode: 'string', withTimezone: true }).notNull(),
    passId: uuid('pass_id').references(() => pass.id, { onDelete: 'set null' }),
    clientId: uuid('client_id')
      .references(() => client.id, { onDelete: 'cascade' })
      .notNull(),
    staffMemberId: uuid('staff_member_id').references(() => staffMember.id, { onDelete: 'set null' }),
    studioId: uuid('studio_id')
      .references(() => studio.id, { onDelete: 'cascade' })
      .notNull(),
    cancelledAt: timestamp('cancelled_at', { mode: 'string', withTimezone: true }),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (table) => [
    index().on(table.clientId, table.status),
    index().on(table.staffMemberId, table.status),
    index().on(table.studioId, table.status, table.scheduledAt),
    index().on(table.passId),
    uniqueIndex('unique_open_personal_training_slot')
      .on(table.clientId, table.scheduledAt)
      .where(sql`${table.status} = 'scheduled'`),
  ],
)

export const personal_training_signup_relations = relations(personalTrainingSignup, ({ one }) => ({
  pass: one(pass, { fields: [personalTrainingSignup.passId], references: [pass.id] }),
  client: one(client, { fields: [personalTrainingSignup.clientId], references: [client.id] }),
  staffMember: one(staffMember, { fields: [personalTrainingSignup.staffMemberId], references: [staffMember.id] }),
  studio: one(studio, { fields: [personalTrainingSignup.studioId], references: [studio.id] }),
}))
