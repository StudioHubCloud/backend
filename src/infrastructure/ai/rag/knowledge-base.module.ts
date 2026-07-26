import { Module } from '@nestjs/common'
import { KnowledgeBaseService } from './knowledge-base.service'
import { EmbeddingsService } from './embeddings.service'

@Module({
  providers: [KnowledgeBaseService, EmbeddingsService],
  exports: [KnowledgeBaseService],
})
export class KnowledgeBaseModule {}
