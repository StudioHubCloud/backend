import { Scenes } from 'telegraf'
import { Injectable } from '@nestjs/common'
import { BotContext } from '@app/bot/bot.context'
import { AiAssistantService } from '@app/infrastructure/ai'
import { AudioTranscribeService } from '@app/infrastructure/audio-transcribe'
import { AiHelper, AuditLogHelper, BotHelper, KeyboardHelper, RegexHelper, SceneHelper } from '@app/bot/helpers'
import { BUTTON_PATTERNS } from '@app/bot/static/button-patterns'
import { CALLBACK_PREFIX, SCENES, TEditEntitySceneMetaData, TReplyInlineKeyboard } from '@app/bot/libs'
import { CommonSceneKeyboards } from '@app/bot/keyboard/storage'
import { AuditLogTrigger } from '@app/libs'
import { TypedConfigService } from '@app/infrastructure/config'

const MAX_VOICE_DURATION_SECONDS = 60

export interface IAskAiSceneState extends TEditEntitySceneMetaData {}

// A single-step wizard scene on purpose: entering shows a brief welcome and the cursor never
// advances (ctx.wizard.next() is never called) — the one handler below runs on every message
// while the admin/maintainer stays in the scene, toggling on isInitialRun. Exit is explicit.
@Injectable()
export class AskAiScene extends Scenes.WizardScene<BotContext> {
  private readonly scene = new SceneHelper<IAskAiSceneState>()
  private mainTainerChatId: string

  constructor(
    private readonly aiAssistantService: AiAssistantService,
    private readonly audioTranscribeService: AudioTranscribeService,
    private readonly configService: TypedConfigService,
  ) {
    super(SCENES.ASK_AI, (ctx) => this.queryHandler(ctx))

    this.mainTainerChatId = this.configService.get('MAINTAINER_CHAT_ID')

    this.hears(BUTTON_PATTERNS.EXIT, async (ctx) => {
      const { promptMessageId } = this.scene.getState(ctx, ['promptMessageId'])
      return this.scene.handleAdminSceneExit(ctx, promptMessageId)
    })

    this.action(RegexHelper.createButtonActionRegex(CALLBACK_PREFIX.AI.CONFIRM), (ctx) => this.handleConfirm(ctx))
    this.action(RegexHelper.createButtonActionRegex(CALLBACK_PREFIX.AI.CANCEL), (ctx) => this.handleCancel(ctx))

    this.enter(async (ctx, next) => {
      this.scene.setState(ctx, { isInitialRun: true })
      return next()
    })
  }

  private queryHandler = async (ctx: BotContext) => {
    try {
      const { isInitialRun } = this.scene.getState(ctx, ['isInitialRun'])

      if (isInitialRun) {
        const result = await ctx.replyWithHTML(
          '🤖 Запитайте мене про щось, наприклад: "скільки людей записано на йогу цього тижня" або "скасуй тренування у вівторок о 18:00".\n\n' +
            'Щоб вийти — натисніть "Вийти".',
          CommonSceneKeyboards.exit(),
        )
        return this.scene.setState(ctx, { isInitialRun: false, promptMessageId: result.message_id })
      }

      const { textPayload, isVoiceUpdate } = BotHelper.getUpdatePayload(ctx)

      if (isVoiceUpdate) {
        return this.handleVoiceQuery(ctx)
      }

      if (!textPayload) {
        return
      }

      return this.processQuery(ctx, textPayload)
    } catch (error) {
      return this.scene.handleAdminSceneError(ctx, error, this.mainTainerChatId)
    }
  }

  // Only ever called from queryHandler, which already wraps every branch in the same
  // try/catch — no need to duplicate that here.
  private handleVoiceQuery = async (ctx: BotContext) => {
    const { voiceFileId, voiceDuration } = BotHelper.getUpdatePayload(ctx)
    if (!voiceFileId) {
      return
    }

    if ((voiceDuration ?? 0) > MAX_VOICE_DURATION_SECONDS) {
      return ctx.reply(`🎤 Голосове повідомлення задовге. Максимум — ${MAX_VOICE_DURATION_SECONDS} секунд.`)
    }

    const placeholder = await ctx.reply('🎤 Розпізнаю голосове повідомлення...')
    const chatId = ctx.chat?.id

    let transcribedText: string
    try {
      const fileLink = await ctx.telegram.getFileLink(voiceFileId)
      transcribedText = await this.audioTranscribeService.transcribe(fileLink)
    } catch (error) {
      console.error('Error transcribing voice message:', error)
      return BotHelper.safeEditMessageTextById(
        ctx,
        chatId,
        placeholder.message_id,
        '❌ Не вдалося розпізнати голосове повідомлення. Спробуйте ще раз або напишіть текстом.',
      )
    }

    // Show what was heard before acting on it — the transcript can be wrong, and the admin
    // should see what the AI is actually about to work from, same as if they'd typed it.
    await BotHelper.safeEditMessageTextById(ctx, chatId, placeholder.message_id, `📝 ${transcribedText}`)

    return this.processQuery(ctx, transcribedText)
  }

  private processQuery = async (ctx: BotContext, text: string) => {
    await ctx.sendChatAction('typing')

    const { actor, conversationId } = AiHelper.getActorContext(ctx)
    const result = await this.aiAssistantService.handleMessage(actor, text, conversationId)

    if (result.pendingConfirmation && result.pendingActionId) {
      return ctx.replyWithHTML(AiHelper.sanitizeReplyHtml(result.replyText), this.buildConfirmationKeyboard(result.pendingActionId))
    }

    return ctx.replyWithHTML(AiHelper.sanitizeReplyHtml(result.replyText))
  }

  private handleConfirm = async (ctx: BotContext) => {
    try {
      BotHelper.safeAnswerCbQuery(ctx)

      const [actionId] = RegexHelper.getMatchGroupValue(ctx)
      if (!actionId) {
        await BotHelper.safeDeleteMessage(ctx)
        return ctx.reply('❗️ Помилка. Невірні дані кнопки.')
      }

      const { actor, conversationId } = AiHelper.getActorContext(ctx)
      const result = await this.aiAssistantService.confirmPendingAction(actor, conversationId, actionId)

      if (result.logOperations?.length && result.auditAction) {
        AuditLogHelper.startAction(ctx, result.auditAction, AuditLogTrigger.ADMIN_ACTION, result.logOperations)
      }

      // Delete rather than edit-in-place — editMessageText without a reply_markup override leaves
      // the Confirm/Cancel buttons attached and tappable, which is exactly the stale-button case
      // the per-action id above is meant to guard against. A fresh message has no buttons to stray-tap.
      await BotHelper.safeDeleteMessage(ctx)
      return await ctx.replyWithHTML(AiHelper.sanitizeReplyHtml(result.replyText))
    } catch (error) {
      return this.scene.handleAdminSceneError(ctx, error, this.mainTainerChatId)
    }
  }

  private handleCancel = async (ctx: BotContext) => {
    try {
      BotHelper.safeAnswerCbQuery(ctx)

      const [actionId] = RegexHelper.getMatchGroupValue(ctx)
      if (!actionId) {
        await BotHelper.safeDeleteMessage(ctx)
        return ctx.reply('❗️ Помилка. Невірні дані кнопки.')
      }

      const { conversationId } = AiHelper.getActorContext(ctx)
      await this.aiAssistantService.cancelPendingAction(conversationId, actionId)

      await BotHelper.safeDeleteMessage(ctx)
      return await ctx.reply('❌ Скасовано.')
    } catch (error) {
      return this.scene.handleAdminSceneError(ctx, error, this.mainTainerChatId)
    }
  }

  private buildConfirmationKeyboard(actionId: string): TReplyInlineKeyboard {
    return KeyboardHelper.createInlineKeyboard([
      [
        {
          text: BUTTON_PATTERNS.CONFIRM,
          callback_data: RegexHelper.createButtonActionCallbackData(CALLBACK_PREFIX.AI.CONFIRM, actionId),
        },
        {
          text: BUTTON_PATTERNS.CANCEL,
          callback_data: RegexHelper.createButtonActionCallbackData(CALLBACK_PREFIX.AI.CANCEL, actionId),
        },
      ],
    ])
  }
}
