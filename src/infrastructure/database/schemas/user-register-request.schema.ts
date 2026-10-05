import { uuid, pgTable as table, varchar, date, integer } from 'drizzle-orm/pg-core'
import { relations } from 'drizzle-orm'
import { studio } from './studio.schema'
import { userProfile } from './user-profile.schema'
import { FileTypePgEnum } from '../database.enums'
import { group } from './group.schema'

export const userRegisterRequest = table('user_register_request', {
  id: uuid('id').primaryKey().defaultRandom(),
  // Null for cash payment
  fileId: varchar('file_id'),
  fileType: FileTypePgEnum(),
  // Group the client picked at registration; the admin opens the pass for it on verification
  groupId: integer('group_id').references(() => group.id, { onDelete: 'set null' }),
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
