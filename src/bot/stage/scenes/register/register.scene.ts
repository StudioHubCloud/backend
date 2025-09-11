import { Scenes } from 'telegraf'
import { Injectable } from '@nestjs/common'
import { BotContext } from '@app/bot/bot.context'
import { DATE_FORMAT, UserProfileRoleEnum, UserProfileStatusEnum } from '@app/libs'
import { IRegisterSceneState, SCENES, TNextFunction } from '@app/bot/libs'
import { SceneHelper, BotHelper, UserHelper, TextHelper, KeyboardHelper, NameHelper } from '@app/bot/helpers'
import { MESSAGES_COMMON, MESSAGES_SCENE } from '@app/bot/static/messages'
import { RegisterSceneNavigation } from './register.scene-navigation'
import { BUTTON_PATTERNS } from '@app/bot/static/button-patterns'
import { UserProfileService } from '@app/domain/user-profile'
import { DateTimeProvider, DateTimeProviderInjector } from '@app/infrastructure/providers'
import { RedisCacheService } from '@app/infrastructure/redis'
import { REGISTER_SCENE_CURSOR_MAP, REGISTER_SCENE_NAVIGATION_MAP } from './register.navigation-map'
import { CommonKeyboards, CommonSceneKeyboards, GuestKeyboards } from '@app/bot/keyboard/storage'
import { MessageHelper } from '@app/bot/helpers/message.helper'

@Injectable()
export class RegisterScene extends Scenes.WizardScene<BotContext> {
  private readonly registerScene = new SceneHelper<IRegisterSceneState>()
  private readonly sceneNavigation = new RegisterSceneNavigation<IRegisterSceneState>(REGISTER_SCENE_NAVIGATION_MAP)
  private REQUESTED_ROLE: UserProfileRoleEnum

  constructor(
    private readonly userProfileService: UserProfileService,
    private readonly redisCacheService: RedisCacheService,
    @DateTimeProviderInjector() private readonly dateTimeProvider: DateTimeProvider,
  ) {
    super(
      SCENES.REGISTER,
      (ctx) => this.enterSceneHandler(ctx),
      (ctx) => this.nameHandler(ctx),
      (ctx) => this.phoneHandler(ctx),
      (ctx) => this.dateOfBirthHandler(ctx),
      (ctx) => this.completeHandler(ctx),
    )

    this.enter(async (ctx: BotContext, next: TNextFunction) => {
      this.REQUESTED_ROLE = ctx.scene.state['role']
      return await next()
    })

    this.hears(BUTTON_PATTERNS.EXIT, async (ctx) => {
      await ctx.replyWithHTML(MESSAGES_SCENE.REGISTER.EXIT, CommonKeyboards.registerAs())
      return ctx.scene.leave()
    })

    this.initNameConfirmationActions()
  }

  private enterSceneHandler = async (ctx: BotContext) => {
    const { next } = this.sceneNavigation.getNavigation(this.REQUESTED_ROLE, REGISTER_SCENE_CURSOR_MAP.ENTER_HANDLER)
    return await this.sceneNavigation.handleNext(ctx, next)
  }

  private nameHandler = async (ctx: BotContext) => {
    const { next } = this.sceneNavigation.getNavigation(this.REQUESTED_ROLE, REGISTER_SCENE_CURSOR_MAP.NAME_HANDLER)

    const [data] = BotHelper.getUpdatePayload(ctx)

    const result = NameHelper.processNameInput(data)
    const { firstName, lastName, wasSwapped, confidence } = result

    const validation = NameHelper.validateNames(firstName, lastName)

    if (!validation.isValid) {
      return ctx.replyWithHTML(`❌ ${validation.suggestion}\n\nСпробуйте ще раз:`)
    }
    const suggestion = NameHelper.getSuggestionMessage(result)

    if (confidence === 'low' && suggestion) {
      const confirmKeyboard = KeyboardHelper.createInlineKeyboard([
        [
          { text: '✅ Залишити як є', callback_data: 'name_confirm_keep' },
          { text: '🔄 Змінити порядок', callback_data: 'name_confirm_swap' },
        ],
        [{ text: '✏️ Ввести заново', callback_data: 'name_confirm_retry' }],
      ])

      // Store both variants in scene state
      this.registerScene.setState(ctx, {
        firstName,
        lastName,
        firstNameAlt: lastName,
        lastNameAlt: firstName,
      })

      return ctx.replyWithHTML(
        `📝 Ви ввели: <b>${firstName}${lastName ? ` ${lastName}` : ''}</b>\n\n💡 ${suggestion}`,
        confirmKeyboard,
      )
    }

    if (wasSwapped && suggestion) {
      await ctx.replyWithHTML(`✅ ${suggestion}\n\n📝 Результат: <b>${firstName}${lastName ? ` ${lastName}` : ''}</b>`)
    }

    this.registerScene.setState(ctx, { firstName, lastName })

    return await this.sceneNavigation.handleNext(ctx, next)
  }

  private phoneHandler = async (ctx: BotContext) => {
    const { next, prev } = this.sceneNavigation.getNavigation(this.REQUESTED_ROLE, REGISTER_SCENE_CURSOR_MAP.PHONE_HANDLER)

    const [data] = BotHelper.getUpdatePayload(ctx)

    switch (data) {
      case BUTTON_PATTERNS.BACK:
        return await this.sceneNavigation.handleBack(ctx, prev)
      default:
        break
    }

    const phone = TextHelper.validatePhone(data)

    if (!phone) {
      return ctx.replyWithHTML(MESSAGES_SCENE.REGISTER.PROVIDE_PHONE_ERROR)
    }

    this.registerScene.setState(ctx, { phone })
    const state = this.registerScene.getState(ctx)
    return await this.sceneNavigation.handleNext(ctx, next, { data: state, role: this.REQUESTED_ROLE })
  }

  private dateOfBirthHandler = async (ctx: BotContext) => {
    const { next, prev } = this.sceneNavigation.getNavigation(this.REQUESTED_ROLE, REGISTER_SCENE_CURSOR_MAP.DOB_HANDLER)

    const [data] = BotHelper.getUpdatePayload(ctx)

    switch (data) {
      case BUTTON_PATTERNS.BACK:
        return await this.sceneNavigation.handleBack(ctx, prev)
      default:
        break
    }

    const date_of_birth = TextHelper.validateDateInput(data)

    if (!date_of_birth) {
      return ctx.replyWithHTML(MESSAGES_COMMON.DATE_ERROR)
    }

    this.registerScene.setState(ctx, { date_of_birth })
    const state = this.registerScene.getState(ctx)

    return await this.sceneNavigation.handleNext(ctx, next, { data: state, role: this.REQUESTED_ROLE })
  }

  private completeHandler = async (ctx: BotContext) => {
    const { prev } = this.sceneNavigation.getNavigation(this.REQUESTED_ROLE, REGISTER_SCENE_CURSOR_MAP.COMPLETE_HANDLER)

    const [incoming_message] = BotHelper.getUpdatePayload(ctx)
    const state = this.registerScene.getState(ctx)

    switch (incoming_message) {
      case BUTTON_PATTERNS.BACK:
        return await this.sceneNavigation.handleBack(ctx, prev, { data: state, role: this.REQUESTED_ROLE })
      default:
        break
    }

    if (incoming_message !== BUTTON_PATTERNS.CONFIRM) {
      return
    }

    const { firstName, lastName, phone, date_of_birth } = state
    const { id } = UserHelper.getUser(ctx)
    const isGuest = this.REQUESTED_ROLE === UserProfileRoleEnum.GUEST

    const dateOfBirth =
      this.REQUESTED_ROLE !== UserProfileRoleEnum.TRAINER
        ? this.dateTimeProvider.parseAndFormatDate({
            date: date_of_birth || '',
            outputDateFormat: DATE_FORMAT.DATE_MAIN,
            inputDateFormat: DATE_FORMAT.DATE_INPUT,
          })
        : null

    await this.userProfileService.updateUserProfile(id, {
      firstName,
      lastName,
      dateOfBirth,
      fullName: UserHelper.getFullName(firstName!, lastName),
      phoneNumber: phone,
      role: this.REQUESTED_ROLE,
      status: isGuest ? UserProfileStatusEnum.ACTIVE : UserProfileStatusEnum.VERIFICATION_REQUESTED,
    })

    const sendMessageToStudioAdmins = async (ctx: BotContext) => {
      const studioAdmins = await this.userProfileService.findStudioAdmins()
      studioAdmins.forEach((admin) => {
        ctx.telegram.sendMessage(
          admin.telegramId,
          MessageHelper.getVerifyRequestMessage(state, { completed: true, role: this.REQUESTED_ROLE }),
          {
            parse_mode: 'HTML',
            ...CommonKeyboards.verifyActions(id, this.REQUESTED_ROLE),
          },
        )
      })
    }

    const keyboard = isGuest ? GuestKeyboards.mainMenu() : CommonKeyboards.registerAs()

    await Promise.all([
      this.redisCacheService.reset(),
      ctx.replyWithHTML(MESSAGES_SCENE.REGISTER[isGuest ? 'COMPLETE_GUEST' : 'COMPLETE'], keyboard),
      !isGuest ? sendMessageToStudioAdmins(ctx) : null,
    ])

    return ctx.scene.leave()
  }

  private initNameConfirmationActions() {
    this.action('name_confirm_keep', async (ctx) => {
      BotHelper.safeAnswerCbQuery(ctx)
      await ctx.deleteMessage()
      const { next } = this.sceneNavigation.getNavigation(this.REQUESTED_ROLE, REGISTER_SCENE_CURSOR_MAP.NAME_HANDLER)
      return await this.sceneNavigation.handleNext(ctx, next)
    })

    this.action('name_confirm_swap', async (ctx) => {
      BotHelper.safeAnswerCbQuery(ctx)
      await ctx.deleteMessage()

      const state = this.registerScene.getState(ctx)
      // Swap the names
      this.registerScene.setState(ctx, {
        firstName: state.firstNameAlt,
        lastName: state.lastNameAlt,
      })

      await ctx.replyWithHTML(`✅ Порядок змінено на: <b>${state.firstNameAlt} ${state.lastNameAlt}</b>`)

      const { next } = this.sceneNavigation.getNavigation(this.REQUESTED_ROLE, REGISTER_SCENE_CURSOR_MAP.NAME_HANDLER)
      return await this.sceneNavigation.handleNext(ctx, next)
    })

    this.action('name_confirm_retry', async (ctx) => {
      BotHelper.safeAnswerCbQuery(ctx)
      await ctx.deleteMessage()
      return ctx.replyWithHTML(MESSAGES_SCENE.REGISTER.PROVIDE_NAME, CommonSceneKeyboards.exit())
    })
  }
}
