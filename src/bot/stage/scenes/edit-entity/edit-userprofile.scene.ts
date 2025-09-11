import { BotContext } from '@app/bot/bot.context'
import { Injectable } from '@nestjs/common'
import { Scenes } from 'telegraf'
import {
  EDIT_USER_PROFILE_SCENE_ACTIONS,
  SCENES,
  TEditEntitySceneMetaData,
  TEditUserProfileSceneAction,
  UserProfileWithClient,
} from '@app/bot/libs'
import { BotHelper, SceneHelper, TextHelper } from '@app/bot/helpers'
import { DateTimeProvider, DateTimeProviderInjector } from '@app/infrastructure/providers'
import { TypedConfigService } from '@app/infrastructure/config'
import { BUTTON_PATTERNS } from '@app/bot/static/button-patterns'
import { MESSAGES_SCENE } from '@app/bot/static/messages'
import { AdminKeyboards, CommonSceneKeyboards } from '@app/bot/keyboard/storage'
import { DATE_FORMAT } from '@app/libs/constants/global'
import { UserProfileService } from '@app/domain/user-profile'
import { ClientHelper } from '@app/bot/helpers/client.helper'

export interface IEditUserProfileSceneState extends TEditEntitySceneMetaData {
  action: TEditUserProfileSceneAction
  clientUserProfile: UserProfileWithClient
  nameOverride?: string
  phoneOverride?: string
  dateOfBirthOverride?: string
}

@Injectable()
export class EditUserProfileScene extends Scenes.WizardScene<BotContext> {
  private readonly scene = new SceneHelper<IEditUserProfileSceneState>()
  private mainTainerChatId: string
  private dateExample = '01 01 2000'

  private readonly actionHandlerMap = new Map<TEditUserProfileSceneAction, number>([
    [EDIT_USER_PROFILE_SCENE_ACTIONS.EDIT_NAME, 1], // Handler 2
    [EDIT_USER_PROFILE_SCENE_ACTIONS.EDIT_PHONE, 2], // Handler 3
    [EDIT_USER_PROFILE_SCENE_ACTIONS.EDIT_DATE_OF_BIRTH, 3], // Handler 4
  ])

  private readonly displayNames = {
    [EDIT_USER_PROFILE_SCENE_ACTIONS.EDIT_NAME]: "Ім'я",
    [EDIT_USER_PROFILE_SCENE_ACTIONS.EDIT_PHONE]: 'Телефон',
    [EDIT_USER_PROFILE_SCENE_ACTIONS.EDIT_DATE_OF_BIRTH]: 'Дата народження',
  }

  constructor(
    @DateTimeProviderInjector() private readonly dateTimeProvider: DateTimeProvider,
    private readonly userProfileService: UserProfileService,
    private readonly configService: TypedConfigService,
  ) {
    super(
      SCENES.EDIT_USER_PROFILE,
      (ctx) => this.routingHandler(ctx), // Handler 0: Router
      (ctx) => this.editNameHandler(ctx), // Handler 1: Edit name
      (ctx) => this.editPhoneHandler(ctx), // Handler 2: Edit phone
      (ctx) => this.editDateOfBirthHandler(ctx), // Handler 3: Edit date of birth
    )

    this.mainTainerChatId = this.configService.get('MAINTAINER_CHAT_ID')

    this.hears(BUTTON_PATTERNS.EXIT, async (ctx) => {
      return this.scene.handleAdminSceneExit(ctx)
    })

    this.enter(async (ctx, next) => {
      const { action, clientUserProfile } = this.scene.getState(ctx)

      if (!action || !clientUserProfile) {
        ctx.replyWithHTML(MESSAGES_SCENE.EDIT_ENTITIES.NO_INITIAL_DATA, AdminKeyboards.mainMenu())
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
          return this.editNameHandler(ctx)
        case 2:
          return this.editPhoneHandler(ctx)
        case 3:
          return this.editDateOfBirthHandler(ctx)
        default:
          return ctx.scene.leave()
      }
    } catch (error) {
      return this.scene.handleAdminSceneError(ctx, error, this.mainTainerChatId)
    }
  }

  // Handler 1: Edit fullname
  private editNameHandler = async (ctx: BotContext) => {
    try {
      const { isInitialRun, clientUserProfile } = this.scene.getState(ctx, ['isInitialRun', 'clientUserProfile'])

      const [payload] = BotHelper.getUpdatePayload(ctx)

      if (isInitialRun) {
        // First time entering this handler - show current value and prompt
        const result = await ctx.replyWithHTML(
          `🏃‍♂️ Поточне імʼя: <b>${clientUserProfile?.fullName}</b>\n\n` + `📝 Введіть нове повне імʼя:`,
          CommonSceneKeyboards.exit(),
        )
        return this.scene.setState(ctx, { isInitialRun: false, promptMessageId: result.message_id })
      }

      await this.userProfileService.updateUserProfile(clientUserProfile.id, {
        fullName: payload,
      })

      this.scene.setState(ctx, { clientUserProfile: { ...clientUserProfile, fullName: payload } })

      return this.confirmationHandler(ctx)
    } catch (error) {
      return this.scene.handleAdminSceneError(ctx, error, this.mainTainerChatId)
    }
  }

  // Handler 2: Edit phone
  private editPhoneHandler = async (ctx: BotContext) => {
    try {
      const { isInitialRun, clientUserProfile } = this.scene.getState(ctx, ['isInitialRun', 'clientUserProfile'])

      const [payload] = BotHelper.getUpdatePayload(ctx)

      if (isInitialRun) {
        // First time entering this handler - show current value and prompt
        const result = await ctx.replyWithHTML(
          `🏃‍♂️ Поточний телефон: <b>${clientUserProfile?.phoneNumber || 'Не вказано'}</b>\n\n` +
            `📝 Введіть новий телефон:\n` +
            `💡 Формат: 0XXXXXXXXX`,
          CommonSceneKeyboards.exit(),
        )
        return this.scene.setState(ctx, { isInitialRun: false, promptMessageId: result.message_id })
      }

      const phone = TextHelper.validatePhone(payload)

      if (!phone) {
        return ctx.replyWithHTML(MESSAGES_SCENE.REGISTER.PROVIDE_PHONE_ERROR)
      }
      await this.userProfileService.updateUserProfile(clientUserProfile.id, {
        phoneNumber: phone,
      })

      this.scene.setState(ctx, { clientUserProfile: { ...clientUserProfile, phoneNumber: phone } })

      return this.confirmationHandler(ctx)
    } catch (error) {
      return this.scene.handleAdminSceneError(ctx, error, this.mainTainerChatId)
    }
  }

  private editDateOfBirthHandler = async (ctx: BotContext) => {
    try {
      const { clientUserProfile, isInitialRun } = this.scene.getState(ctx, ['clientUserProfile', 'isInitialRun'])

      const [payload] = BotHelper.getUpdatePayload(ctx)

      if (isInitialRun) {
        const result = await ctx.replyWithHTML(
          `📅 Поточна дата народження: <b>${clientUserProfile?.dateOfBirth || 'Не вказано'}</b>\n\n` +
            `📝 Введіть нову дату народження у форматі ДД ММ РРРР:\n` +
            `💡 Приклад: ${this.dateExample}`,
          CommonSceneKeyboards.exit(),
        )
        return this.scene.setState(ctx, { isInitialRun: false, promptMessageId: result.message_id })
      }

      const date_of_birth = TextHelper.validateDateInput(payload)

      if (!date_of_birth) {
        return await ctx.replyWithHTML('❌ Невірний формат дати. Використовуйте ДД ММ РРРР')
      }

      const dateOfBirthFormatted = this.dateTimeProvider.parseAndFormatDate({
        date: date_of_birth || '',
        outputDateFormat: DATE_FORMAT.DATE_MAIN,
        inputDateFormat: DATE_FORMAT.DATE_INPUT,
      })

      await this.userProfileService.updateUserProfile(clientUserProfile.id, {
        dateOfBirth: dateOfBirthFormatted,
      })

      this.scene.setState(ctx, { clientUserProfile: { ...clientUserProfile, dateOfBirth: dateOfBirthFormatted } })

      return this.confirmationHandler(ctx) // Go to confirmation
    } catch (error) {
      return this.scene.handleAdminSceneError(ctx, error, this.mainTainerChatId)
    }
  }

  private confirmationHandler = async (ctx: BotContext) => {
    try {
      this.scene.setState(ctx, { isInitialRun: false })

      const { clientUserProfile, promptMessageId, action } = this.scene.getState(ctx)
      ctx.deleteMessage(promptMessageId).catch(() => {})
      await ctx.replyWithHTML(`✅ ${this.displayNames[action] || 'Поле'} успішно оновлено!`, AdminKeyboards.mainMenu())
      await ClientHelper.renderClientManageMenu(ctx, clientUserProfile, false)
      return ctx.scene.leave()
    } catch (error) {
      return this.scene.handleAdminSceneError(ctx, error, this.mainTainerChatId)
    }
  }
}
