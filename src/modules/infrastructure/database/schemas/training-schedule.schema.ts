import { pgTable as table, uuid, index, uniqueIndex } from 'drizzle-orm/pg-core'
import { relations } from 'drizzle-orm'
import { TrainingStatusPgEnum, TrainingTypePgEnum } from '../database.enums'
import { UserProfile } from './user-profile.schema'
import { Training } from './training.schema'
import { Pass } from './pass.schema'

export const TrainingSchedule = table(
  'training_schedule',
  {
    id: uuid('id').primaryKey(),
    status: TrainingStatusPgEnum().notNull(),
    type: TrainingTypePgEnum().notNull(),
    userProfileId: uuid('user_profile_id').references(() => UserProfile.id, { onDelete: 'set null' }),
    passId: uuid('pass_id').references(() => Pass.id, { onDelete: 'set null' }),
    trainingId: uuid('training_id')
      .references(() => Training.id, { onDelete: 'cascade' })
      .notNull(),
  },
  (table) => [
    index('[training_schedule]userProfileId_index').on(table.userProfileId),
    index('[training_schedule]passId_index').on(table.passId),
    index('[training_schedule]trainingId_index').on(table.trainingId),
    index('[training_schedule]trainingId-status-type_index').on(table.trainingId, table.status, table.type),
    index('[training_schedule]userProfileId-status-type_index').on(table.userProfileId, table.status, table.type),
    index('[training_schedule]passId-status-type_index').on(table.passId, table.status, table.type),
    uniqueIndex('[training_schedule]trainingId-userProfileId_uindex').on(table.trainingId, table.userProfileId),
    uniqueIndex('[training_schedule]trainingId-passId_uindex').on(table.trainingId, table.passId),
  ],
)

export const training_schedule_relations = relations(TrainingSchedule, ({ one }) => ({
  user_profile: one(UserProfile, { fields: [TrainingSchedule.userProfileId], references: [UserProfile.id] }),
  training: one(Training, { fields: [TrainingSchedule.trainingId], references: [Training.id] }),
  pass: one(Pass, { fields: [TrainingSchedule.trainingId], references: [Pass.id] }),
}))
