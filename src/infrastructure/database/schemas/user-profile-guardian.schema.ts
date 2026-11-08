import { index, pgTable as table, primaryKey, timestamp, uuid } from 'drizzle-orm/pg-core'
import { relations } from 'drizzle-orm'
import { userProfile } from './user-profile.schema'
import { studio } from './studio.schema'

/**
 * Parent ↔ child (many-to-many): a parent may have several children, a child several parents.
 * The child is a CLIENT profile without Telegram. A parent with children can't be deleted (no action);
 * deleting a child removes its links.
 */
export const userProfileGuardian = table(
  'user_profile_guardian',
  {
    guardianProfileId: uuid('guardian_profile_id')
      .references(() => userProfile.id)
      .notNull(),
    childProfileId: uuid('child_profile_id')
      .references(() => userProfile.id, { onDelete: 'cascade' })
      .notNull(),
    studioId: uuid('studio_id')
      .references(() => studio.id, { onDelete: 'cascade' })
      .notNull(),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (table) => [primaryKey({ columns: [table.guardianProfileId, table.childProfileId] }), index().on(table.childProfileId)],
)

export const user_profile_guardian_relations = relations(userProfileGuardian, ({ one }) => ({
  guardian: one(userProfile, {
    fields: [userProfileGuardian.guardianProfileId],
    references: [userProfile.id],
    relationName: 'guardian',
  }),
  child: one(userProfile, {
    fields: [userProfileGuardian.childProfileId],
    references: [userProfile.id],
    relationName: 'child',
  }),
  studio: one(studio, { fields: [userProfileGuardian.studioId], references: [studio.id] }),
}))
