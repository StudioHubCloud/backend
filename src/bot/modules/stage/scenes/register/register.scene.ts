import { Scenes } from 'telegraf'
import { Injectable } from '@nestjs/common'
import { BotContext } from '@app/bot/bot.context'
import { CALLBACK_PREFIX, DATE_FORMAT, SCENES, TNextFunction, UserProfileRoleEnum, UserProfileStatusEnum } from '@app/libs'
import { SceneHelper, BotHelper, UserHelper, KeyboardHelper, TextHelper, RegexHelper } from '@app/bot/helpers'
import { MESSAGES_SCENE } from '@app/bot/static/messages'
import { CommonSceneKeyboards, GuestKeyboards } from '@app/bot/modules/keyboard/storage'
import { SceneNavigation } from '../scene.navigation'
import { PATTERNS_COMMON } from '@app/bot/static/patterns'
import { UserProfileService } from '@app/domain/user-profile'
import { DateTimeProvider, DateTimeProviderInjector } from '@app/infrastructure/providers'
import { RedisCacheService } from '@app/infrastructure/redis'
import { TypedConfigService } from '@app/infrastructure/config'
import { REGISTER_SCENE_CURSOR_MAP, REGISTER_SCENE_NAVIGATION_MAP } from './register.navigation-map'
import { IRegisterSceneState, RegisterSceneHelpers } from './register.scene-helpers'
import { KEYBARODS_COMMON, KEYBOARDS_GUEST } from '@app/bot/static/keyboards'

@Injectable()
export class RegisterScene extends Scenes.WizardScene<BotContext> {
  private readonly registerScene = new SceneHelper<IRegisterSceneState>()
  private readonly sceneNavigation = new SceneNavigation(REGISTER_SCENE_NAVIGATION_MAP)
  private USER_ROLE: UserProfileRoleEnum

  constructor(
    private readonly userProfileService: UserProfileService,
    private readonly redisCacheService: RedisCacheService,
    private readonly configService: TypedConfigService,
    @DateTimeProviderInjector() private readonly dateTimeService: DateTimeProvider,
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
      this.USER_ROLE = UserHelper.getUserRole(ctx)
      return await next()
    })

    this.hears(PATTERNS_COMMON.EXIT, async (ctx) => {
      ctx.replyWithHTML(MESSAGES_SCENE.REGISTER.EXIT, KeyboardHelper.createReplyMarkupKeyboard(KEYBARODS_COMMON.REGISTER_AS))
      return ctx.scene.leave()
    })
  }

  private enterSceneHandler = async (ctx: BotContext) => {
    const { next } = this.sceneNavigation.getNavigation(this.USER_ROLE, REGISTER_SCENE_CURSOR_MAP.ENTER_HANDLER)
    return await this.sceneNavigation.handleNext(ctx, next)
  }

  private nameHandler = async (ctx: BotContext) => {
    const { next, prev } = this.sceneNavigation.getNavigation(this.USER_ROLE, REGISTER_SCENE_CURSOR_MAP.NAME_HANDLER)

    const data = BotHelper.getUpdatePayload(ctx)

    switch (data) {
      case PATTERNS_COMMON.BACK:
        return await this.sceneNavigation.handleBack(ctx, prev)
      default:
        break
    }

    const [firstName, lastName] = data?.split(' ')
    this.registerScene.setState(ctx, { firstName, lastName })

    return await this.sceneNavigation.handleNext(ctx, next)
  }

  private phoneHandler = async (ctx: BotContext) => {
    const { next, prev } = this.sceneNavigation.getNavigation(this.USER_ROLE, REGISTER_SCENE_CURSOR_MAP.PHONE_HANDLER)

    const data = BotHelper.getUpdatePayload(ctx)

    switch (data) {
      case PATTERNS_COMMON.BACK:
        return await this.sceneNavigation.handleBack(ctx, prev)
      default:
        break
    }

    const phone = TextHelper.stripNonNumericCharacters(data)
    this.registerScene.setState(ctx, { phone })
    const state = this.registerScene.getState(ctx)
    return await this.sceneNavigation.handleNext(ctx, next, { data: state, role: this.USER_ROLE })
  }

  private dateOfBirthHandler = async (ctx: BotContext) => {
    const { next, prev } = this.sceneNavigation.getNavigation(UserHelper.getUserRole(ctx), REGISTER_SCENE_CURSOR_MAP.DOB_HANDLER)

    const data = BotHelper.getUpdatePayload(ctx)

    switch (data) {
      case PATTERNS_COMMON.BACK:
        return await this.sceneNavigation.handleBack(ctx, prev)
      default:
        break
    }

    const date_of_birth = TextHelper.validateDOB(data)

    if (!date_of_birth) {
      await ctx.replyWithHTML('Невірний формат', CommonSceneKeyboards.backWithExit())
      return
    }

    this.registerScene.setState(ctx, { date_of_birth })
    const state = this.registerScene.getState(ctx)

    return await this.sceneNavigation.handleNext(ctx, next, { data: state, role: this.USER_ROLE })
  }

  private completeHandler = async (ctx: BotContext) => {
    const { prev } = this.sceneNavigation.getNavigation(UserHelper.getUserRole(ctx), REGISTER_SCENE_CURSOR_MAP.COMPLETE_HANDLER)

    const data = BotHelper.getUpdatePayload(ctx)
    const state = this.registerScene.getState(ctx)

    switch (data) {
      case PATTERNS_COMMON.BACK:
        return await this.sceneNavigation.handleBack(ctx, prev, { data: state, role: this.USER_ROLE })
      default:
        break
    }

    if (data !== PATTERNS_COMMON.CONFIRM) {
      return
    }

    const { firstName, lastName, phone, date_of_birth } = state
    const { id, role } = UserHelper.getUser(ctx)
    const isGuest = UserHelper.isGuestRole(ctx)

    const dateOfBirth = this.dateTimeService.parseAndFormatDate({
      date: date_of_birth!,
      dateFormat: DATE_FORMAT.DATE_MAIN,
      parseFormat: DATE_FORMAT.DATE_INPUT,
    })

    await this.userProfileService.updateUserProfile(id, {
      firstName,
      lastName,
      dateOfBirth,
      phoneNumber: phone,
      status: isGuest ? UserProfileStatusEnum.ACTIVE : UserProfileStatusEnum.VERIFICATION_REQUESTED,
    })

    const sendMessageToAdmin = async () => {
      await ctx.telegram.sendMessage(
        this.configService.get('ADMIN_CHAT_ID'),
        RegisterSceneHelpers.prepareInfoText(state, { completed: true, role: this.USER_ROLE }),
        {
          parse_mode: 'HTML',
          ...KeyboardHelper.createInlineKeyboard([
            [
              {
                text: PATTERNS_COMMON.VERIFY,
                callback_data: RegexHelper.createButtonActionCallbackData(CALLBACK_PREFIX.VERIFY_USER, id, role),
              },
            ],
          ]),
        },
      )
    }
    const keyboard = isGuest
      ? KeyboardHelper.createReplyMarkupKeyboard(KEYBOARDS_GUEST.MAIN_MENU)
      : KeyboardHelper.createReplyMarkupKeyboard(KEYBARODS_COMMON.REGISTER_AS)

    await Promise.all([
      this.redisCacheService.reset(),
      ctx.replyWithHTML(MESSAGES_SCENE.REGISTER[isGuest ? 'COMPLETE_GUEST' : 'COMPLETE'], keyboard),
      !isGuest ? sendMessageToAdmin() : null,
    ])

    return ctx.scene.leave()
  }
}
