import { pgTable, uuid, integer, text, vector, timestamp, index } from 'drizzle-orm/pg-core'
import { knowledgeBaseDocument } from './knowledge_base_document.schema'

// Must match the output dimensionality of EMBEDDINGS_MODEL — changing it requires a new migration.
const EMBEDDING_DIMENSIONS = 1024

export const knowledgeBaseChunk = pgTable(
  'knowledge_base_chunk',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    documentId: uuid('document_id')
      .references(() => knowledgeBaseDocument.id, { onDelete: 'cascade' })
      .notNull(),
    // Denormalized from the parent document to avoid a join on the hot search path.
    studioId: uuid('studio_id').notNull(),
    chunkIndex: integer('chunk_index').notNull(),
    content: text('content').notNull(),
    embedding: vector('embedding', { dimensions: EMBEDDING_DIMENSIONS }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' }).notNull().defaultNow(),
  },
  (table) => [
    index('knowledge_base_chunk_document_idx').on(table.documentId),
    index('knowledge_base_chunk_studio_idx').on(table.studioId),
    index('knowledge_base_chunk_embedding_hnsw_idx').using('hnsw', table.embedding.op('vector_cosine_ops')),
  ],
)
