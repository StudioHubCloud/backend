import { uniqueIndex, smallint, pgTable as table, uuid, varchar } from 'drizzle-orm/pg-core'
import { relations } from 'drizzle-orm'
import { studio } from './studio.schema'
import { StudioPriceTypePgEnum } from '../database.enums'

export const studioPrice = table(
  'studio_price',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    studioId: uuid('studio_id').references(() => studio.id, { onDelete: 'cascade' }),
    name: varchar('name').notNull(),
    price: smallint('price').notNull(),
    type: StudioPriceTypePgEnum().notNull(),
  },
  (table) => [uniqueIndex().on(table.studioId, table.name), uniqueIndex().on(table.studioId, table.type)],
)

export const studio_price_relations = relations(studioPrice, ({ one }) => ({
  studio: one(studio, { fields: [studioPrice.studioId], references: [studio.id] }),
}))
