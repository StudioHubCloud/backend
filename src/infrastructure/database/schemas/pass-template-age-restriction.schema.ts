import { timestamp, index, serial, smallint, pgTable as table, uuid } from 'drizzle-orm/pg-core'
import { relations } from 'drizzle-orm'
import { passTemplate } from './pass-template.schema'

export const passTemplateAgeRestriction = table(
  'pass_template_age_restriction',
  {
    id: serial('id').primaryKey(),
    minAge: smallint('min_age'),
    maxAge: smallint('max_age'),
    allowedThreshold: smallint('allowed_threshold'),
    passTemplateId: uuid('pass_template_id')
      .references(() => passTemplate.id, { onDelete: 'cascade' })
      .notNull(),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (table) => [index().on(table.passTemplateId)],
)

export const pass_template_age_restriction_relations = relations(passTemplateAgeRestriction, ({ one }) => ({
  passTemplate: one(passTemplate, { fields: [passTemplateAgeRestriction.passTemplateId], references: [passTemplate.id] }),
}))
