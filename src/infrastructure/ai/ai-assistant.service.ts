import { Inject, Injectable, Logger } from '@nestjs/common'
import { randomUUID } from 'crypto'
import Anthropic from '@anthropic-ai/sdk'
import { Pool } from 'pg'
import { RedisCacheService } from '@app/infrastructure/redis'
import { TypedConfigService } from '@app/infrastructure/config'
import { DATABASE_POOL_READONLY } from '@app/infrastructure/database'
import { GroupService } from '@app/domain/group'
import { TrainingService } from '@app/domain/training'
import { AuditLogActions } from '@app/libs'
import { AiClientProvider } from './ai-client.provider'
import { AiRateLimiterService } from './ai-rate-limiter.service'
import { buildAdminTools, getSchemaSummary } from './tools'
import { AI_RISK_TIER, AiActor, AiAssistantResult, AiPendingAction, AiToolDefinition } from './ai.types'

const RUN_READONLY_QUERY_TOOL_NAME = 'run_readonly_query'

const MAX_TOOL_LOOP_ITERATIONS = 4
const HISTORY_TTL_SECONDS = 60 * 15
const PENDING_ACTION_TTL_SECONDS = 60 * 10

const SYSTEM_PROMPT = `You are the admin assistant inside a fitness studio's Telegram bot.
Admins ask you things like "cancel Tuesday's 6pm training" or "how many people signed up for the yoga group this week" instead of using the menu buttons.

Rules:
- Never invent an id, a name, or a number. If you need a trainingId or a fact you don't have, call run_readonly_query first.
- If a request is ambiguous (e.g. multiple trainings could match), ask a short clarifying question instead of guessing.
- Keep replies short — no long preambles, no tables, no markdown headers. Telegram messages are limited to 4096 characters, so if you need to send a long list, break it into multiple messages.
- Your reply is sent using Telegram's HTML parse mode. For highlights, use only the plain tags <b>bold</b>, <i>italic</i>, and <u>underline</u> — nothing else (no links, no code blocks, no nested tags). Write ordinary punctuation (periods, exclamation marks, hyphens, dates like 20.07.2026) exactly as normal text, with no escaping. You are allowed to combine <b>, <i>, and <u> tags, but do not use any other HTML tags or attributes.
- Format your reply properly and answer in a friendly, helpful tone. Use emojis where appropriate. Target audience is a fitness studio admin, not a developer, girls in age 16 to 24. Its okay to say "I don't know" or "I can't do that" if you don't have enough information or if the request is outside your capabilities.
- You never execute a mutating action directly; the system handles confirmation for those automatically.
- You only help with studio-management topics: trainings, schedules, clients, groups, passes, and sign-ups. If asked anything unrelated (general chit-chat, coding help, trivia, world affairs, or any other off-topic request), politely decline and steer the conversation back to studio management — do not answer the off-topic question, even if you know the answer.
- Respond in Ukrainian by default — that's the language the studio's admins use. If the admin writes to you in a different language, reply in that language instead.`

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
    @Inject(DATABASE_POOL_READONLY) private readonly readonlyPool: Pool,
    groupService: GroupService,
    trainingService: TrainingService,
  ) {
    // Only the admin tool set exists today. If/when a client/guest-scoped tool set is added,
    // this is the seam: pick a tool set here based on actor.role instead of always building admin tools.
    this.tools = buildAdminTools({ groupService, trainingService, readonlyPool: this.readonlyPool })
  }

  async handleMessage(actor: AiActor, text: string, conversationId: string): Promise<AiAssistantResult> {
    const allowed = await this.aiRateLimiterService.tryConsume()
    if (!allowed) {
      return { replyText: '🚫 На сьогодні ліміт запитів вичерпано. Спробуй завтра або скористайся меню.' }
    }

    const history = await this.getHistory(conversationId)
    let currentMessages: Anthropic.MessageParam[] = [...history, { role: 'user', content: text }]

    const model = this.configService.get('AI_MODEL_STANDARD')
    const anthropicTools = await this.buildAnthropicToolsForRequest()

    try {
      for (let iteration = 0; iteration < MAX_TOOL_LOOP_ITERATIONS; iteration++) {
        const response = await this.aiClientProvider.createMessage({
          model,
          system: SYSTEM_PROMPT,
          tools: anthropicTools,
          messages: currentMessages,
        })

        // The model itself can refuse to engage with a request (safety classifiers), separate
        // from any tool logic — treat it the same as an off-topic redirect, not an error.
        if (response.stop_reason === 'refusal') {
          return { replyText: '⚠️ Я не можу допомогти з цим запитом — запитай щось про студію 🙏' }
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
    } catch (error) {
      const mappedReply = this.mapApiError(error)
      if (!mappedReply) {
        throw error
      }
      return mappedReply
    }

    return { replyText: '⚠️ Не вийшло обробити запит, спробуй переформулювати 🙏' }
  }

  // Anthropic's error.type reflects the API response body (billing_error, overloaded_error, ...),
  // which is far more reliable than guessing from the HTTP status code or error message text.
  // Returns null for anything that isn't a recognized Anthropic API error, so genuine bugs still
  // bubble up to the scene's generic error handler (which alerts the maintainer) instead of being
  // silently swallowed here.
  private mapApiError(error: unknown): AiAssistantResult | null {
    if (!(error instanceof Anthropic.APIError)) {
      return null
    }

    this.logger.error(`Anthropic API error [${error.type ?? error.status}]: ${error.message}`)

    switch (error.type) {
      case 'billing_error':
        return { replyText: '💳 Вичерпано ліміт користування' }
      case 'rate_limit_error':
        return { replyText: '⏳ Забагато запитів одночасно, вибач 🙏' }
      case 'overloaded_error':
        return { replyText: '🔧 Зараз трішки перевантажено, вибач 🙏' }
      case 'authentication_error':
      case 'permission_error':
        return { replyText: '🚫 Проблема з доступом — звернись до адміністратора бота.' }
      case 'timeout_error':
        return { replyText: '⌛ Відповідь зайняла задовго, вибач.' }
      case 'not_found_error':
      case 'invalid_request_error':
      case 'api_error':
      default:
        return { replyText: '⚠️ Щось пішло не так, вибач 🙏' }
    }
  }

  async confirmPendingAction(actor: AiActor, conversationId: string, actionId: string): Promise<AiAssistantResult> {
    const pending = await this.getPendingAction(conversationId, actionId)
    await this.clearPendingAction(conversationId, actionId)

    if (!pending) {
      return { replyText: '⚠️ Ця дія вже неактуальна — виконана раніше або замінена новішою. Запитай ще раз.' }
    }

    const tool = this.getTool(pending.toolName)
    if (!tool) {
      this.logger.error(`Pending action referenced unknown tool "${pending.toolName}"`)
      return { replyText: '❌ Щось пішло не так під час виконання дії.' }
    }

    try {
      const { logOperations } = await tool.execute(actor, pending.input)
      return {
        replyText: tool.successMessage ?? '✅ Готово.',
        logOperations,
        auditAction: AuditLogActions.AI_ASSISTANT_ACTION,
      }
    } catch (error) {
      return { replyText: `❌ Не вдалося виконати дію: ${this.getErrorMessage(error)}` }
    }
  }

  async cancelPendingAction(conversationId: string, actionId: string): Promise<void> {
    await this.clearPendingAction(conversationId, actionId)
  }

  private async handleCriticalToolUse(conversationId: string, block: Anthropic.ToolUseBlock): Promise<AiAssistantResult> {
    const tool = this.getTool(block.name)
    if (!tool || !tool.describeConfirmation) {
      this.logger.error(`Critical tool "${block.name}" is missing describeConfirmation`)
      return { replyText: '❌ Щось пішло не так' }
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

  // run_readonly_query's description carries a static part (baked into this.tools once, in the
  // constructor) plus the current DB schema, fetched fresh (cache hit = one Redis GET in the
  // common case) on every call so a same-day migration doesn't leave the model working from a
  // stale schema for the lifetime of the process.
  private async buildAnthropicToolsForRequest(): Promise<Anthropic.Tool[]> {
    const schemaSummary = await getSchemaSummary(this.redisCacheService, this.readonlyPool)

    const toolsForRequest = this.tools.map((tool) =>
      tool.name === RUN_READONLY_QUERY_TOOL_NAME ? { ...tool, description: `${tool.description}\n\n${schemaSummary}` } : tool,
    )

    return this.toAnthropicTools(toolsForRequest)
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

    return text || '🤔 У мене немає відповіді на це.'
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
