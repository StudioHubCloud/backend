import { uuid, pgTable as table, varchar, date } from 'drizzle-orm/pg-core'
import { relations } from 'drizzle-orm'
import { studio } from './studio.schema'
import { userProfile } from './user-profile.schema'
import { FileTypePgEnum } from '../database.enums'

export const userRegisterRequest = table('user_register_request', {
  id: uuid('id').primaryKey().defaultRandom(),
  fileId: varchar('file_id').notNull(),
  fileType: FileTypePgEnum().notNull(),
  userProfileId: uuid('user_profile_id')
    .references(() => userProfile.id, { onDelete: 'cascade' })
    .notNull(),
  studioId: uuid('studio_id')
    .references(() => studio.id, { onDelete: 'cascade' })
    .notNull(),
  createdAt: date('created_at').notNull().defaultNow(),
})

export const user_register_request_relations = relations(userRegisterRequest, ({ one }) => ({
  studio: one(studio, { fields: [userRegisterRequest.studioId], references: [studio.id] }),
  userProfile: one(userProfile, {
    fields: [userRegisterRequest.userProfileId],
    references: [userProfile.id],
  }),
}))
