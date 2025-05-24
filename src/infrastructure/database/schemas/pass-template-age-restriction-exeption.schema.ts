import { uuid, pgTable as table, serial, uniqueIndex } from 'drizzle-orm/pg-core'
import { relations } from 'drizzle-orm'
import { userProfile } from './user-profile.schema'
import { passTemplate } from './pass-template.schema'

export const passTemplateAgeRestrictionException = table(
  'pass_template_age_restriction_exception',
  {
    id: serial('id').primaryKey(),
    userProfileId: uuid('user_profile_id')
      .references(() => userProfile.id, { onDelete: 'cascade' })
      .notNull(),
    passTemplateId: uuid('pass_template_id')
      .references(() => passTemplate.id, { onDelete: 'cascade' })
      .notNull(),
  },
  (table) => [uniqueIndex().on(table.userProfileId, table.passTemplateId)],
)


export const pass_template_age_restriction_exception_relations = relations(passTemplateAgeRestrictionException, ({ one }) => ({
  userProfile: one(userProfile, { fields: [passTemplateAgeRestrictionException.userProfileId], references: [userProfile.id] }),
  passTemplate: one(passTemplate, { fields: [passTemplateAgeRestrictionException.passTemplateId], references: [passTemplate.id] }),
}))
