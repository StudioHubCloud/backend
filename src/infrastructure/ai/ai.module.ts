import { Module } from '@nestjs/common'
import { GroupModule, TrainingModule, TrainingSignupModule, UserProfileModule } from '@app/domain'
import { APP } from '@app/libs'
import { DateTimeProvider } from '@app/infrastructure/providers'
import { KnowledgeBaseModule } from './rag'
import { AiClientProvider } from './ai-client.provider'
import { AiRateLimiterService } from './ai-rate-limiter.service'
import { AiAssistantService } from './ai-assistant.service'

@Module({
  imports: [GroupModule, TrainingModule, TrainingSignupModule, UserProfileModule, KnowledgeBaseModule],
  providers: [
    AiClientProvider,
    AiRateLimiterService,
    AiAssistantService,
    { provide: APP.PROVIDERS.DATE_TIME_PROVIDER, useClass: DateTimeProvider },
  ],
  exports: [AiAssistantService],
})
export class AiModule {}
