import { Injectable, Logger } from '@nestjs/common'
import { randomUUID } from 'crypto'
import Anthropic from '@anthropic-ai/sdk'
import { RedisCacheService } from '@app/infrastructure/redis'
import { TypedConfigService } from '@app/infrastructure/config'
import { GroupService } from '@app/domain/group'
import { TrainingService } from '@app/domain/training'
import { TrainingSignupService } from '@app/domain/training-signup'
import { UserProfileService } from '@app/domain/user-profile'
import { AuditLogActions } from '@app/libs'
import { AiClientProvider } from './ai-client.provider'
import { AiRateLimiterService } from './ai-rate-limiter.service'
import { buildAdminTools } from './ai-admin-tools'
import { AI_RISK_TIER, AiActor, AiAssistantResult, AiPendingAction, AiToolDefinition } from './ai.types'

const MAX_TOOL_LOOP_ITERATIONS = 4
const HISTORY_TTL_SECONDS = 60 * 15
const PENDING_ACTION_TTL_SECONDS = 60 * 10

const SYSTEM_PROMPT = `You are the admin assistant inside a fitness studio's Telegram bot.
Admins ask you things like "cancel Tuesday's 6pm training" or "how many people signed up for the yoga group this week" instead of using the menu buttons.

Rules:
- Never invent an id, a name, or a number. If you need a trainingId or a fact you don't have, call a list_*/get_* tool first.
- If a request is ambiguous (e.g. multiple trainings could match), ask a short clarifying question instead of guessing.
- Keep replies short and in plain text suitable for a Telegram message — no markdown headers, no long preambles. Telegraph messages are limited to 4096 characters, so if you need to send a long list, break it into multiple messages.
- Format your reply properly and answer in a friendly, helpful tone. Use emojis where appropriate. Target audience is a fitness studio admin, not a developer. Its okay to say "I don't know" or "I can't do that" if you don't have enough information or if the request is outside your capabilities.
- You never execute a mutating action directly; the system handles confirmation for those automatically.`

// This service is transport-agnostic on purpose: it knows nothing about Telegram (see AiActor
// and the plain string conversationId below) so a future non-Telegram consumer of this backend
// could drive the same "Ask AI" behavior through a thin adapter of its own.
@Injectable()
export class AiAssistantService {
  private readonly logger = new Logger(AiAssistantService.name)
  private readonly tools: AiToolDefinition[]

  constructor(
    private readonly aiClientProvider: AiClientProvider,
    private readonly aiRateLimiterService: AiRateLimiterService,
    private readonly redisCacheService: RedisCacheService,
    private readonly configService: TypedConfigService,
    groupService: GroupService,
    trainingService: TrainingService,
    trainingSignupService: TrainingSignupService,
    userProfileService: UserProfileService,
  ) {
    // Only the admin tool set exists today. If/when a client/guest-scoped tool set is added,
    // this is the seam: pick a tool set here based on actor.role instead of always building admin tools.
    this.tools = buildAdminTools({ groupService, trainingService, trainingSignupService, userProfileService })
  }

  async handleMessage(actor: AiActor, text: string, conversationId: string): Promise<AiAssistantResult> {
    const allowed = await this.aiRateLimiterService.tryConsume()
    if (!allowed) {
      return { replyText: '🚫 Daily AI limit reached for today. Please try again tomorrow, or use the regular menus.' }
    }

    const history = await this.getHistory(conversationId)
    let currentMessages: Anthropic.MessageParam[] = [...history, { role: 'user', content: text }]

    const standardModel = this.configService.get('AI_MODEL_STANDARD')
    const criticalModel = this.configService.get('AI_MODEL_CRITICAL')
    const anthropicTools = this.toAnthropicTools(this.tools)

    for (let iteration = 0; iteration < MAX_TOOL_LOOP_ITERATIONS; iteration++) {
      let response = await this.aiClientProvider.createMessage({
        model: standardModel,
        system: SYSTEM_PROMPT,
        tools: anthropicTools,
        messages: currentMessages,
      })

      const initialToolUseBlocks = this.getToolUseBlocks(response)
      const shouldEscalate = initialToolUseBlocks.some((block) => this.getTool(block.name)?.riskTier === AI_RISK_TIER.CRITICAL)

      if (shouldEscalate) {
        // Re-issue the same conversation to the critical-tier model rather than trusting the
        // cheap model's tool call for a mutating/destructive action — see plan's "Model choice & cost".
        response = await this.aiClientProvider.createMessage({
          model: criticalModel,
          system: SYSTEM_PROMPT,
          tools: anthropicTools,
          messages: currentMessages,
        })
      }

      const toolUseBlocks = this.getToolUseBlocks(response)

      if (response.stop_reason !== 'tool_use' || toolUseBlocks.length === 0) {
        const replyText = this.extractText(response)
        await this.saveHistory(conversationId, [...currentMessages, { role: 'assistant', content: response.content }])
        return { replyText }
      }

      const criticalBlock = toolUseBlocks.find((block) => this.getTool(block.name)?.riskTier === AI_RISK_TIER.CRITICAL)
      if (criticalBlock) {
        const result = await this.handleCriticalToolUse(conversationId, criticalBlock)
        // Deliberately not persisted to conversation history: an unresolved tool_use with no
        // matching tool_result would break every future turn, and the pending action itself
        // already carries everything needed to execute on confirmation.
        return result
      }

      const toolResults = await this.executeStandardTools(actor, toolUseBlocks)
      currentMessages = [
        ...currentMessages,
        { role: 'assistant', content: response.content },
        { role: 'user', content: toolResults },
      ]
    }

    return { replyText: "I couldn't finish that in a reasonable number of steps — please try rephrasing your question." }
  }

  async confirmPendingAction(actor: AiActor, conversationId: string, actionId: string): Promise<AiAssistantResult> {
    const pending = await this.getPendingAction(conversationId, actionId)
    await this.clearPendingAction(conversationId, actionId)

    if (!pending) {
      return { replyText: 'This action has expired, was already handled, or was replaced by a newer request. Please ask again.' }
    }

    const tool = this.getTool(pending.toolName)
    if (!tool) {
      this.logger.error(`Pending action referenced unknown tool "${pending.toolName}"`)
      return { replyText: 'Something went wrong completing that action.' }
    }

    try {
      const { logOperations } = await tool.execute(actor, pending.input)
      return {
        replyText: tool.successMessage ?? '✅ Done.',
        logOperations,
        auditAction: AuditLogActions.AI_ASSISTANT_ACTION,
      }
    } catch (error) {
      return { replyText: `❌ Couldn't complete that action: ${this.getErrorMessage(error)}` }
    }
  }

  async cancelPendingAction(conversationId: string, actionId: string): Promise<void> {
    await this.clearPendingAction(conversationId, actionId)
  }

  private async handleCriticalToolUse(conversationId: string, block: Anthropic.ToolUseBlock): Promise<AiAssistantResult> {
    const tool = this.getTool(block.name)
    if (!tool || !tool.describeConfirmation) {
      this.logger.error(`Critical tool "${block.name}" is missing describeConfirmation`)
      return { replyText: 'Something went wrong preparing that action. Please try again.' }
    }

    // Each pending action gets its own id/key rather than sharing one slot per conversation —
    // otherwise a second question asked before the first is confirmed would silently overwrite
    // it, and tapping the older (still-visible) confirm button would act on the wrong action.
    const actionId = randomUUID()
    await this.savePendingAction(conversationId, actionId, { toolName: tool.name, input: block.input })
    const confirmationText = await tool.describeConfirmation(block.input)
    return { replyText: confirmationText, pendingConfirmation: true, pendingActionId: actionId }
  }

  private async executeStandardTools(
    actor: AiActor,
    toolUseBlocks: Anthropic.ToolUseBlock[],
  ): Promise<Anthropic.ToolResultBlockParam[]> {
    const results: Anthropic.ToolResultBlockParam[] = []

    for (const block of toolUseBlocks) {
      const tool = this.getTool(block.name)
      if (!tool) {
        results.push({ type: 'tool_result', tool_use_id: block.id, content: `Unknown tool: ${block.name}`, is_error: true })
        continue
      }

      try {
        const { result } = await tool.execute(actor, block.input)
        results.push({ type: 'tool_result', tool_use_id: block.id, content: JSON.stringify(result) })
      } catch (error) {
        results.push({ type: 'tool_result', tool_use_id: block.id, content: this.getErrorMessage(error), is_error: true })
      }
    }

    return results
  }

  private getTool(name: string): AiToolDefinition | undefined {
    return this.tools.find((tool) => tool.name === name)
  }

  private getToolUseBlocks(message: Anthropic.Message): Anthropic.ToolUseBlock[] {
    return message.content.filter((block): block is Anthropic.ToolUseBlock => block.type === 'tool_use')
  }

  private toAnthropicTools(tools: AiToolDefinition[]): Anthropic.Tool[] {
    return tools.map((tool) => ({
      name: tool.name,
      description: tool.description,
      input_schema: tool.inputSchema as unknown as Anthropic.Tool['input_schema'],
    }))
  }

  private extractText(message: Anthropic.Message): string {
    const text = message.content
      .filter((block): block is Anthropic.TextBlock => block.type === 'text')
      .map((block) => block.text)
      .join('\n')
      .trim()

    return text || "I don't have a response for that."
  }

  private getErrorMessage(error: unknown): string {
    return error instanceof Error ? error.message : 'Unknown error'
  }

  private historyKey(conversationId: string): string {
    return `ai:history:${conversationId}`
  }

  private pendingActionKey(conversationId: string, actionId: string): string {
    return `ai:pending-action:${conversationId}:${actionId}`
  }

  private async getHistory(conversationId: string): Promise<Anthropic.MessageParam[]> {
    return (await this.redisCacheService.get<Anthropic.MessageParam[]>(this.historyKey(conversationId))) ?? []
  }

  private async saveHistory(conversationId: string, messages: Anthropic.MessageParam[]): Promise<void> {
    await this.redisCacheService.set(this.historyKey(conversationId), messages, HISTORY_TTL_SECONDS)
  }

  private async getPendingAction(conversationId: string, actionId: string): Promise<AiPendingAction | null> {
    return this.redisCacheService.get<AiPendingAction>(this.pendingActionKey(conversationId, actionId))
  }

  private async savePendingAction(conversationId: string, actionId: string, action: AiPendingAction): Promise<void> {
    await this.redisCacheService.set(this.pendingActionKey(conversationId, actionId), action, PENDING_ACTION_TTL_SECONDS)
  }

  private async clearPendingAction(conversationId: string, actionId: string): Promise<void> {
    await this.redisCacheService.delete(this.pendingActionKey(conversationId, actionId))
  }
}
