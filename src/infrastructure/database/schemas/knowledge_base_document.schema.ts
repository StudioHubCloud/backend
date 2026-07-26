import { pgTable, uuid, varchar, text, boolean, timestamp, index, uniqueIndex } from 'drizzle-orm/pg-core'

export const knowledgeBaseDocument = pgTable(
  'knowledge_base_document',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    studioId: uuid('studio_id').notNull(),
    slug: varchar('slug').notNull(),
    title: varchar('title').notNull(),
    category: varchar('category'),
    sourceText: text('source_text').notNull(),
    // sha256 of sourceText — lets the ingest script skip re-embedding a doc whose content hasn't changed.
    contentHash: varchar('content_hash', { length: 64 }).notNull(),
    isActive: boolean('is_active').notNull().default(true),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('knowledge_base_document_studio_slug_idx').on(table.studioId, table.slug),
    index('knowledge_base_document_studio_idx').on(table.studioId),
  ],
)
