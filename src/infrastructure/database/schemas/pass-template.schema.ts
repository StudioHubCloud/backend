import { uuid, pgTable as table, uniqueIndex, varchar, integer, smallint, timestamp } from 'drizzle-orm/pg-core'
import { PASS_CONFIG } from '@app/bot/libs/constants'
import { relations } from 'drizzle-orm'
import { PassTemplateTypePgEnum, PassTemplateStatusPgEnum, PassGroupModePgEnum } from '../database.enums'
import { studio } from './studio.schema'
import { pass } from './pass.schema'
import { passTemplateAgeRestriction } from './pass-template-age-restriction.schema'
import { passTemplateAgeRestrictionException } from './pass-template-age-restriction-exeption.schema'
import { PassGroupModeEnum, PassTemplateStatusEnum } from '@app/libs/constants/enums'

export const passTemplate = table(
  'pass_template',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    name: varchar('name').notNull(),
    price: integer('price').notNull(),
    length: smallint('length').notNull(),
    durationDays: smallint('duration_days').notNull().default(PASS_CONFIG.DEFAULT_DURATION_IN_DAYS),
    type: PassTemplateTypePgEnum().notNull(),
    status: PassTemplateStatusPgEnum().notNull().default(PassTemplateStatusEnum.INACTIVE),
    // Group templates only: what a sold pass gets (copied to pass.group_mode)
    groupMode: PassGroupModePgEnum('group_mode').notNull().default(PassGroupModeEnum.FIXED),
    studioId: uuid('studio_id')
      .references(() => studio.id, { onDelete: 'cascade' })
      .notNull(),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (table) => [uniqueIndex().on(table.studioId, table.name)],
)

export const pass_template_relations = relations(passTemplate, ({ many, one }) => ({
  passes: many(pass),
  passTemplateAgeRestriction: one(passTemplateAgeRestriction),
  passTemplateAgeRestrictionExceptions: many(passTemplateAgeRestrictionException),
  studio: one(studio, { fields: [passTemplate.studioId], references: [studio.id] }),
}))
