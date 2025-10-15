import { uuid, pgTable as table, uniqueIndex, varchar, integer, smallint, boolean } from 'drizzle-orm/pg-core'
import { relations } from 'drizzle-orm'
import { PassTemplateTypePgEnum, PassTemplateStatusPgEnum } from '../database.enums'
import { studio } from './studio.schema'
import { pass } from './pass.schema'
import { passTemplateAgeRestriction } from './pass-template-age-restriction.schema'
import { passTemplateAgeRestrictionException } from './pass-template-age-restriction-exeption.schema'
import { PassTemplateStatusEnum } from '@app/libs'

export const passTemplate = table(
  'pass_template',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    name: varchar('name').notNull(),
    price: integer('price').notNull(),
    length: smallint('length').notNull(),
    type: PassTemplateTypePgEnum().notNull(),
    status: PassTemplateStatusPgEnum().notNull().default(PassTemplateStatusEnum.INACTIVE),
    studioId: uuid('studio_id')
      .references(() => studio.id, { onDelete: 'cascade' })
      .notNull(),
  },
  (table) => [uniqueIndex().on(table.studioId, table.name)],
)

export const pass_template_relations = relations(passTemplate, ({ many, one }) => ({
  passes: many(pass),
  passTemplateAgeRestriction: one(passTemplateAgeRestriction),
  passTemplateAgeRestrictionExceptions: many(passTemplateAgeRestrictionException),
  studio: one(studio, { fields: [passTemplate.studioId], references: [studio.id] }),
}))
