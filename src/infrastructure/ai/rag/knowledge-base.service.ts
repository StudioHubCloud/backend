import { Injectable } from '@nestjs/common'
import { and, cosineDistance, eq, sql } from 'drizzle-orm'
import { DatabaseService, knowledgeBaseChunk, knowledgeBaseDocument } from '@app/infrastructure/database'
import { EmbeddingsService } from './embeddings.service'

export interface KnowledgeBaseMatch {
  title: string
  content: string
  similarity: number
}

@Injectable()
export class KnowledgeBaseService {
  constructor(
    private readonly databaseService: DatabaseService,
    private readonly embeddingsService: EmbeddingsService,
  ) {}

  async search(studioId: string, query: string, options: { topK: number }): Promise<KnowledgeBaseMatch[]> {
    const queryEmbedding = await this.embeddingsService.embedQuery(query)
    const distance = cosineDistance(knowledgeBaseChunk.embedding, queryEmbedding)
    const similarity = sql<number>`1 - (${distance})`

    return this.databaseService.drizzle
      .select({
        title: knowledgeBaseDocument.title,
        content: knowledgeBaseChunk.content,
        similarity,
      })
      .from(knowledgeBaseChunk)
      .innerJoin(knowledgeBaseDocument, eq(knowledgeBaseChunk.documentId, knowledgeBaseDocument.id))
      .where(and(eq(knowledgeBaseChunk.studioId, studioId), eq(knowledgeBaseDocument.isActive, true)))
      .orderBy(distance)
      .limit(options.topK)
  }
}
