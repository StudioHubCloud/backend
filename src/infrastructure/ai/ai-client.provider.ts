import { Injectable } from '@nestjs/common'
import Anthropic from '@anthropic-ai/sdk'
import { TypedConfigService } from '@app/infrastructure/config'

// Infra-only wrapper around the Anthropic SDK — no business logic, no knowledge of
// trainings/clients/passes. AiAssistantService owns the tool-calling loop and business rules.
@Injectable()
export class AiClientProvider {
  private readonly client: Anthropic

  constructor(private readonly configService: TypedConfigService) {
    this.client = new Anthropic({ apiKey: this.configService.get('AI_API_KEY') })
  }

  async createMessage(params: {
    model: string
    system: string
    tools: Anthropic.Tool[]
    messages: Anthropic.MessageParam[]
  }): Promise<Anthropic.Message> {
    const { model, system, tools, messages } = params

    return this.client.messages.create({
      model,
      max_tokens: 2048,
      system: [
        {
          type: 'text',
          text: system,
          cache_control: { type: 'ephemeral' },
        },
      ],
      tools,
      messages,
    })
  }
}
