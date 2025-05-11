import { Scenes } from 'telegraf'
import { Injectable } from '@nestjs/common'
import { BotContext } from '@app/bot/bot.context'
import { CALLBACK_PREFIX, DATE_FORMAT, ISceneNavigationMap, SCENES, UserProfileRoleEnum, UserProfileStatusEnum } from '@app/libs'
import { SceneHelper, BotHelper, UserHelper, KeyboardHelper, TextHelper } from '@app/bot/helpers'
import { MESSAGES_SCENE } from '@app/bot/static/messages'
import { CommonSceneKeyboards } from '@app/bot/modules/keyboard/storage'
import { PATTERNS_COMMON } from '@app/bot/static/patterns'
import { UserProfileService } from '@app/domain/user-profile'
import { DateTimeService, DateTimeServiceInjector } from '@app/infrastructure/providers'
import { RedisCacheService } from '@app/infrastructure/redis'
import { TypedConfigService } from '@app/infrastructure/config'

interface IVerificationRequestSceneState {
  firstName: string
  lastName?: string
  phone?: string
  date_of_birth?: string
  role?: string
}

@Injectable()
export class VerificationRequestScene extends Scenes.WizardScene<BotContext> {
  private readonly scene = new SceneHelper<IVerificationRequestSceneState>()

  private readonly CURSOR_MAP = {
    ENTER_SCENE: 0,
    NAME_HANDLER: 1,
    PHONE_HANDLER: 2,
    DOB_HANDLER: 3,
    COMPLETE_HANDLER: 4,
  } as const

  constructor(
    private readonly userProfileService: UserProfileService,
    @DateTimeServiceInjector() private readonly dateTimeService: DateTimeService,
    private readonly redisCacheService: RedisCacheService,
    private readonly configService: TypedConfigService,
  ) {
    super(
      SCENES.VERIFICATION_REQUEST,
      (ctx) => this.enterSceneHandler(ctx),
      (ctx) => this.nameHandler(ctx),
      (ctx) => this.phoneHandler(ctx),
      (ctx) => this.dateOfBirthHandler(ctx),
      (ctx) => this.completeHandler(ctx),
    )

    this.hears(PATTERNS_COMMON.EXIT, async (ctx) => {
      const role = UserHelper.getUserRole(ctx)
      ctx.replyWithHTML(
        MESSAGES_SCENE.VERIFICATION.EXIT,
        KeyboardHelper.getRoleBasedRegisterRequestKeyboard(role, { completed: false }),
      )
      ctx.scene.leave()
    })
  }

  private enterSceneHandler = async (ctx: BotContext) => {
    await ctx.replyWithHTML(MESSAGES_SCENE.VERIFICATION.PROVIDE_NAME, CommonSceneKeyboards.exit())
    return ctx.wizard.next()
  }

  private nameHandler = async (ctx: BotContext) => {
    const data = BotHelper.getUpdatePayload(ctx)
    const [firstName, lastName] = data?.split(' ')
    this.scene.setState(ctx, { firstName, lastName })

    const navigationMap: ISceneNavigationMap = {
      [UserProfileRoleEnum.CLIENT]: {
        message: MESSAGES_SCENE.VERIFICATION.PROVIDE_PHONE,
        nextCursor: this.CURSOR_MAP.PHONE_HANDLER,
      },
      [UserProfileRoleEnum.GUEST]: {
        message: MESSAGES_SCENE.VERIFICATION.PROVIDE_DOB,
        nextCursor: this.CURSOR_MAP.DOB_HANDLER,
      },
    }

    const role = UserHelper.getUserRole(ctx)
    const { message, nextCursor } = navigationMap[role]

    await ctx.replyWithHTML(message, CommonSceneKeyboards.backWithExit())
    return ctx.wizard.selectStep(nextCursor)
  }

  private phoneHandler = async (ctx: BotContext) => {
    const data = BotHelper.getUpdatePayload(ctx)
    const phone = TextHelper.stripNonNumericCharacters(data)
    this.scene.setState(ctx, { phone })

    await ctx.replyWithHTML(MESSAGES_SCENE.VERIFICATION.PROVIDE_DOB, CommonSceneKeyboards.backWithExit())
    return ctx.wizard.next()
  }

  private dateOfBirthHandler = async (ctx: BotContext) => {
    const data = BotHelper.getUpdatePayload(ctx)
    const date_of_birth = TextHelper.validateDOB(data)

    if (!date_of_birth) {
      await ctx.replyWithHTML('Невірний формат', CommonSceneKeyboards.backWithExit())
      return
    }

    const formatedDate = this.dateTimeService.parseAndFormatDate({
      date: date_of_birth,
      dateFormat: DATE_FORMAT.DATE_MAIN,
      parseFormat: DATE_FORMAT.DATE_INPUT,
    })

    this.scene.setState(ctx, { date_of_birth: formatedDate })

    await ctx.replyWithHTML(
      VerificationRequestScene.prepareInfoText(this.scene.getState(ctx), { mode: 'confirm' }),
      CommonSceneKeyboards.confirm(),
    )
    return ctx.wizard.selectStep(this.CURSOR_MAP.COMPLETE_HANDLER)
  }

  private completeHandler = async (ctx: BotContext) => {
    const data = BotHelper.getUpdatePayload(ctx)

    if (data !== PATTERNS_COMMON.CONFIRM) {
      return
    }

    const { firstName, lastName, phone, date_of_birth } = this.scene.getState(ctx)
    const { id, role } = UserHelper.getUser(ctx)
    const isGuest = UserHelper.isGuestRole(ctx)

    await this.userProfileService.updateUserProfile(id, {
      firstName,
      lastName,
      phoneNumber: phone,
      dateOfBirth: date_of_birth,
      status: isGuest ? UserProfileStatusEnum.ACTIVE : UserProfileStatusEnum.VERIFICATION_REQUESTED,
    })

    await Promise.all([
      this.redisCacheService.reset(),
      ctx.telegram.sendMessage(
        this.configService.get('ADMIN_CHAT_ID'),
        VerificationRequestScene.prepareInfoText(this.scene.getState(ctx), { mode: 'info' }),
        {
          parse_mode: 'HTML',
          reply_markup: {
            inline_keyboard: [[{ text: 'Верифікувати ✅', callback_data: `${CALLBACK_PREFIX.VERIFY_USER}:${id}:${role}` }]],
          },
        },
      ),
      ctx.replyWithHTML(
        MESSAGES_SCENE.VERIFICATION.COMPLETE,
        KeyboardHelper.getRoleBasedRegisterRequestKeyboard(role, { completed: true }),
      ),
    ])
    ctx.scene.leave()
  }

  static prepareInfoText = (data: Partial<IVerificationRequestSceneState>, { mode }: { mode: 'confirm' | 'info' }) => {
    const { firstName, date_of_birth, lastName, phone, role } = data
    const modeText =
      mode === 'confirm'
        ? `Підтвердіть дані: ✅\n\n`
        : `${role === UserProfileRoleEnum.CLIENT ? 'Клієнт' : 'Тренер'} відправив запит на реєстрацію: ✅\n\n`
    return (
      modeText +
      `➡️ Ім'я: ${TextHelper.bold(`${firstName}${lastName ? ` ${lastName}` : ''}`)}\n➡️ Номер телефону: ${TextHelper.bold(phone)}\n➡️ Дата народження: ${TextHelper.bold(date_of_birth)}`
    )
  }
}

/**
 * 4. handle guest and client flows
 * 5. trainer flow
 * //debug old data after reset
 */
