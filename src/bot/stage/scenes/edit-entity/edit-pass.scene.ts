import { BotContext } from '@app/bot/bot.context'
import { Injectable } from '@nestjs/common'
import { Scenes } from 'telegraf'
import { EDIT_PASS_SCENE_ACTIONS, SCENES, TEditEntitySceneMetaData, TEditPassSceneAction } from '@app/bot/libs'
import { BotHelper, KeyboardHelper, PassHelper, SceneHelper, TextHelper, UserHelper } from '@app/bot/helpers'
import { DateTimeProvider, DateTimeProviderInjector } from '@app/infrastructure/providers'
import { PassService } from '@app/domain/pass'
import { TypedConfigService } from '@app/infrastructure/config'
import { BUTTON_PATTERNS } from '@app/bot/static/button-patterns'
import { MESSAGES_SCENE } from '@app/bot/static/messages'
import { CommonSceneKeyboards } from '@app/bot/keyboard/storage'
import { DATE_FORMAT } from '@app/libs/constants/global'
import { PassSelectModel, PassTemplateSelectModel, UserProfileSelectModel } from '@app/infrastructure/database'

export interface IEditPassSceneState extends TEditEntitySceneMetaData {
  action: TEditPassSceneAction
  passId: string
  clientUserProfile: UserProfileSelectModel
  clientUserId: string
  originalPass: PassSelectModel & {
    client: { userProfile: UserProfileSelectModel | null } | null
    passTemplate: PassTemplateSelectModel
  }
}

@Injectable()
export class EditPassScene extends Scenes.WizardScene<BotContext> {
  private readonly scene = new SceneHelper<IEditPassSceneState>()
  private mainTainerChatId: string
  private dateExample = '24 07 2024'

  private readonly actionHandlerMap = new Map<TEditPassSceneAction, number>([
    [EDIT_PASS_SCENE_ACTIONS.EDIT_LENGTH, 1], // Handler 2
    [EDIT_PASS_SCENE_ACTIONS.EDIT_START_DATE, 2], // Handler 3
    [EDIT_PASS_SCENE_ACTIONS.EDIT_END_DATE, 3], // Handler 4
  ])

  private readonly displayNames = {
    [EDIT_PASS_SCENE_ACTIONS.EDIT_LENGTH]: 'Кількість тренувань',
    [EDIT_PASS_SCENE_ACTIONS.EDIT_START_DATE]: 'Дату початку абонемента',
    [EDIT_PASS_SCENE_ACTIONS.EDIT_END_DATE]: 'Дату закінчення абонемента',
  }

  constructor(
    @DateTimeProviderInjector() private readonly dateTimeProvider: DateTimeProvider,
    private readonly passService: PassService,
    private readonly configService: TypedConfigService,
  ) {
    super(
      SCENES.EDIT_PASS,
      (ctx) => this.routingHandler(ctx), // Handler 0: Router
      (ctx) => this.editLengthHandler(ctx), // Handler 1: Edit length
      (ctx) => this.editStartDateHandler(ctx), // Handler 2: Edit start date
      (ctx) => this.editEndDateHandler(ctx), // Handler 3: Edit end date
    )

    this.mainTainerChatId = this.configService.get('MAINTAINER_CHAT_ID')

    this.hears(BUTTON_PATTERNS.EXIT, async (ctx) => {
      const { promptMessageId } = this.scene.getState(ctx, ['promptMessageId'])

      const action = async () => {
        await this.renderPassManageMenu(ctx)
      }
      return this.scene.handleAdminSceneExit(ctx, promptMessageId, action)
    })

    this.enter(async (ctx, next) => {
      const { action, passId, clientUserProfile, originalPass } = this.scene.getState(ctx)

      if (!passId || !action || !clientUserProfile || !originalPass) {
        const { role } = UserHelper.getUser(ctx)
        const keyboard = KeyboardHelper.getRoleBasedMainMenuKeyboard(role)
        ctx.replyWithHTML(MESSAGES_SCENE.EDIT_ENTITIES.NO_INITIAL_DATA, keyboard)
        return ctx.scene.leave()
      }
      return await next()
    })
  }

  // Handler 0: Router - directs to specific handler based on action
  private routingHandler = async (ctx: BotContext) => {
    try {
      const { action } = this.scene.getState(ctx, 'action')

      const targetHandler = this.actionHandlerMap.get(action)

      if (targetHandler === undefined) {
        await ctx.replyWithHTML('❌ Невідома дія для редагування абонемента')
        return ctx.scene.leave()
      }

      this.scene.setState(ctx, { isInitialRun: true })

      ctx.wizard.selectStep(targetHandler)

      switch (targetHandler) {
        case 1:
          return this.editLengthHandler(ctx)
        case 2:
          return this.editStartDateHandler(ctx)
        case 3:
          return this.editEndDateHandler(ctx)
        default:
          return ctx.scene.leave()
      }
    } catch (error) {
      return this.scene.handleAdminSceneError(ctx, error, this.mainTainerChatId)
    }
  }

  // Handler 1: Edit pass length (in weeks)
  private editLengthHandler = async (ctx: BotContext) => {
    try {
      const { originalPass, isInitialRun } = this.scene.getState(ctx, ['originalPass', 'isInitialRun'])

      const { textPayload } = BotHelper.getUpdatePayload(ctx)

      if (isInitialRun) {
        // First time entering this handler - show current value and prompt
        const result = await ctx.replyWithHTML(
          `🏃‍♂️ Поточна кількість тренувань: <b>${originalPass?.lengthOverride || originalPass.passTemplate.length}</b>\n\n` +
            `📝 Введіть нову кількість тренувань:\n` +
            `💡 Це кількість тренувань, які клієнт може відвідати з цим абонементом`,
          CommonSceneKeyboards.exit(),
        )
        return this.scene.setState(ctx, { isInitialRun: false, promptMessageId: result.message_id })
      }

      const newLength = parseInt(textPayload || '', 10)

      if (isNaN(newLength) || newLength < 1) {
        return await ctx.replyWithHTML('❌ Введіть корректну кількість тренувань\n(не менше 1)')
      }

      await this.passService.updatePass(originalPass?.id, {
        lengthOverride: newLength, // Just update the training session count
      })

      this.scene.setState(ctx, { originalPass: { ...originalPass, lengthOverride: newLength } })

      return this.confirmationHandler(ctx)
    } catch (error) {
      return this.scene.handleAdminSceneError(ctx, error, this.mainTainerChatId)
    }
  }
  // Handler 2: Edit start date
  private editStartDateHandler = async (ctx: BotContext) => {
    return this.handleDateUpdateAction(ctx, 'startDate')
  }

  // Handler 3: Edit end date
  private editEndDateHandler = async (ctx: BotContext) => {
    return this.handleDateUpdateAction(ctx, 'endDate')
  }

  private handleDateUpdateAction = async (ctx: BotContext, field: 'startDate' | 'endDate') => {
    try {
      const { originalPass, isInitialRun } = this.scene.getState(ctx, ['originalPass', 'isInitialRun'])

      const { textPayload } = BotHelper.getUpdatePayload(ctx)

      if (isInitialRun) {
        const currentValue = originalPass?.[field]
        const currentDateText = currentValue ? `<b>${currentValue}</b>` : '<i>не встановлена</i>'

        const result = await ctx.replyWithHTML(
          `📅 Поточна дата ${field === 'startDate' ? 'початку' : 'закінчення'}: ${currentDateText}\n\n` +
            `📝 Введіть нову дату ${field === 'startDate' ? 'початку' : 'закінчення'} у форматі ДД ММ РРРР:\n` +
            `💡 Приклад: ${this.dateExample}`,
          CommonSceneKeyboards.exit(),
        )
        return this.scene.setState(ctx, { isInitialRun: false, promptMessageId: result.message_id })
      }

      const date_of_birth = TextHelper.validateDateInput(textPayload)

      if (!date_of_birth) {
        return await ctx.replyWithHTML('❌ Невірний формат дати. Використовуйте ДД ММ РРРР')
      }

      const newDate = this.dateTimeProvider.parseAndFormatDate({
        date: date_of_birth || '',
        outputDateFormat: DATE_FORMAT.DATE_MAIN,
        inputDateFormat: DATE_FORMAT.DATE_INPUT,
      })

      await this.passService.updatePass(originalPass.id, {
        [field]: newDate,
      })

      return this.confirmationHandler(ctx) // Go to confirmation
    } catch (error) {
      return this.scene.handleAdminSceneError(ctx, error, this.mainTainerChatId)
    }
  }

  private confirmationHandler = async (ctx: BotContext) => {
    try {
      this.scene.setState(ctx, { isInitialRun: false })

      const { action, promptMessageId } = this.scene.getState(ctx)
      ctx.deleteMessage(promptMessageId).catch(() => {})

      const { role } = UserHelper.getUser(ctx)
      const keyboard = KeyboardHelper.getRoleBasedMainMenuKeyboard(role)

      await ctx.replyWithHTML(`✅ ${this.displayNames[action] || 'Поле'} успішно оновлено!`, keyboard),
        await this.renderPassManageMenu(ctx)
      return ctx.scene.leave()
    } catch (error) {
      return this.scene.handleAdminSceneError(ctx, error, this.mainTainerChatId)
    }
  }

  private renderPassManageMenu = async (ctx: BotContext) => {
    const { originalPass, clientUserId, clientUserProfile } = this.scene.getState(ctx)
    const pass = await this.passService.getPassById(originalPass.id)

    await PassHelper.renderPassManageMenu(ctx, this.dateTimeProvider, {
      pass: pass as typeof originalPass,
      fullName: UserHelper.getDisplayName(clientUserProfile),
      clientUserId,
      shouldEdit: false,
    })
  }
}
