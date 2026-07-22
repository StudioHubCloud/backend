import { Module } from '@nestjs/common'
import { GroupModule, TrainingModule } from '@app/domain'
import { AiClientProvider } from './ai-client.provider'
import { AiRateLimiterService } from './ai-rate-limiter.service'
import { AiAssistantService } from './ai-assistant.service'

@Module({
  imports: [GroupModule, TrainingModule],
  providers: [AiClientProvider, AiRateLimiterService, AiAssistantService],
  exports: [AiAssistantService],
})
export class AiModule {}
