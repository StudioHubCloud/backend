import { pgTable as table, uuid, varchar, boolean } from 'drizzle-orm/pg-core'
import { relations } from 'drizzle-orm'
import { group } from './group.schema'
import { groupStyle } from './group-style.schema'

export const studio = table(
  'studio',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    title: varchar('title'),
    streetAddress1: varchar('street_address_1').notNull(),
    streetAddress2: varchar('street_address_2'),
    city: varchar('city'),
    state: varchar('state'),
    timeZone: varchar('time_zone').notNull().default('Europe/Kyiv'),
    allowTrainingInsertCron: boolean('allow_training_insert_cron').default(false),
    country: varchar('country'),
  },
)
export const studio_relations = relations(studio, ({ one, many }) => ({
  groups: many(group),
  groupStyles: many(groupStyle),
}))
