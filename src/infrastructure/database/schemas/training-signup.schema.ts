import { pgTable as table, uuid, index, uniqueIndex, integer } from 'drizzle-orm/pg-core'
import { is, relations } from 'drizzle-orm'
import { TrainingSignupStatusPgEnum, TrainingSignupTypePgEnum } from '../database.enums'
import { userProfile } from './user-profile.schema'
import { training } from './training.schema'
import { pass } from './pass.schema'
import { group } from './group.schema'

export const trainingSignup = table(
  'training_signup',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    status: TrainingSignupStatusPgEnum().notNull(),
    type: TrainingSignupTypePgEnum().notNull(),
    userProfileId: uuid('user_profile_id').references(() => userProfile.id, { onDelete: 'set null' }),
    passId: uuid('pass_id').references(() => pass.id, { onDelete: 'set null' }),
    groupId: integer('group_id')
      .references(() => group.id, { onDelete: 'cascade' })
      .notNull(),
    trainingId: integer('training_id')
      .references(() => training.id, { onDelete: 'cascade' })
      .notNull(),
  },
  (table) => [
    index().on(table.userProfileId),
    index().on(table.passId),
    index().on(table.trainingId),
    index().on(table.trainingId, table.status, table.type),
    index().on(table.userProfileId, table.status, table.type),
    index().on(table.passId, table.status, table.type),
    uniqueIndex().on(table.trainingId, table.userProfileId),
    uniqueIndex().on(table.trainingId, table.passId),
  ],
)

export const training_signup_relations = relations(trainingSignup, ({ one }) => ({
  userProfile: one(userProfile, { fields: [trainingSignup.userProfileId], references: [userProfile.id] }),
  training: one(training, { fields: [trainingSignup.trainingId], references: [training.id] }),
  group: one(group, { fields: [trainingSignup.groupId], references: [group.id] }),
  pass: one(pass, { fields: [trainingSignup.passId], references: [pass.id] }),
}))
