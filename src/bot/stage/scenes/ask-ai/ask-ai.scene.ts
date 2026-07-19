import { Scenes } from 'telegraf'
import { Injectable } from '@nestjs/common'
import { BotContext } from '@app/bot/bot.context'
import { AiAssistantService } from '@app/infrastructure/ai'
import { AiHelper, AuditLogHelper, BotHelper, KeyboardHelper, RegexHelper, SceneHelper } from '@app/bot/helpers'
import { BUTTON_PATTERNS } from '@app/bot/static/button-patterns'
import { CALLBACK_PREFIX, SCENES, TEditEntitySceneMetaData, TReplyInlineKeyboard } from '@app/bot/libs'
import { CommonSceneKeyboards } from '@app/bot/keyboard/storage'
import { AuditLogTrigger } from '@app/libs'
import { TypedConfigService } from '@app/infrastructure/config'

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

      const { textPayload } = BotHelper.getUpdatePayload(ctx)
      if (!textPayload) {
        return
      }

      await ctx.sendChatAction('typing')

      const { actor, conversationId } = AiHelper.getActorContext(ctx)
      const result = await this.aiAssistantService.handleMessage(actor, textPayload, conversationId)

      if (result.pendingConfirmation && result.pendingActionId) {
        return ctx.reply(result.replyText, this.buildConfirmationKeyboard(result.pendingActionId))
      }

      return ctx.reply(result.replyText)
    } catch (error) {
      return this.scene.handleAdminSceneError(ctx, error, this.mainTainerChatId)
    }
  }

  private handleConfirm = async (ctx: BotContext) => {
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
    return ctx.reply(result.replyText)
  }

  private handleCancel = async (ctx: BotContext) => {
    BotHelper.safeAnswerCbQuery(ctx)

    const [actionId] = RegexHelper.getMatchGroupValue(ctx)
    if (!actionId) {
      await BotHelper.safeDeleteMessage(ctx)
      return ctx.reply('❗️ Помилка. Невірні дані кнопки.')
    }

    const { conversationId } = AiHelper.getActorContext(ctx)
    await this.aiAssistantService.cancelPendingAction(conversationId, actionId)

    await BotHelper.safeDeleteMessage(ctx)
    return ctx.reply('❌ Скасовано.')
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
