import { Scenes } from 'telegraf'
import { Injectable } from '@nestjs/common'
import { BotContext } from '@app/bot/bot.context'
import { DATE_FORMAT, FileTypeEnum, UserProfileRoleEnum, UserProfileStatusEnum } from '@app/libs'
import { CALLBACK_PREFIX, IRegisterSceneState, NavigationMapValues, SCENES, TNextFunction } from '@app/bot/libs'
import { SceneHelper, BotHelper, UserHelper, TextHelper, KeyboardHelper, NameHelper, RegexHelper } from '@app/bot/helpers'
import { CalendarPicker, TCalendarPickerOptions } from '@app/bot/menus'
import { MESSAGES_COMMON, MESSAGES_SCENE } from '@app/bot/static/messages'
import { RegisterSceneNavigation } from './register.scene-navigation'
import { BUTTON_PATTERNS } from '@app/bot/static/button-patterns'
import { UserProfileService } from '@app/domain/user-profile'
import { GroupService } from '@app/domain/group'
import { DateTimeProvider, DateTimeProviderInjector } from '@app/infrastructure/providers'
import { RedisCacheService } from '@app/infrastructure/redis'
import { REGISTER_SCENE_CURSOR_MAP, REGISTER_SCENE_NAVIGATION_MAP } from './register.navigation-map'
import { AdminKeyboards, CommonKeyboards, CommonSceneKeyboards, GuestKeyboards } from '@app/bot/keyboard/storage'
import { PassRelatedKeyboards } from '@app/bot/keyboard/storage/scene-keyboards'
import { MessageHelper } from '@app/bot/helpers/message.helper'

@Injectable()
export class RegisterScene extends Scenes.WizardScene<BotContext> {
  private readonly registerScene = new SceneHelper<IRegisterSceneState>()
  private readonly sceneNavigation = new RegisterSceneNavigation<IRegisterSceneState>(REGISTER_SCENE_NAVIGATION_MAP)
  private REQUESTED_ROLE: UserProfileRoleEnum = UserProfileRoleEnum.GUEST

  constructor(
    private readonly userProfileService: UserProfileService,
    private readonly groupService: GroupService,
    private readonly redisCacheService: RedisCacheService,
    @DateTimeProviderInjector() private readonly dateTimeProvider: DateTimeProvider,
  ) {
    super(
      SCENES.REGISTER,
      (ctx) => this.enterSceneHandler(ctx),
      (ctx) => this.nameHandler(ctx),
      (ctx) => this.phoneHandler(ctx),
      (ctx) => this.dateOfBirthHandler(ctx),
      (ctx) => this.groupHandler(ctx),
      (ctx) => this.fileUploadHandler(ctx),
      (ctx) => this.completeHandler(ctx),
    )

    this.enter(async (ctx: BotContext, next: TNextFunction) => {
      this.REQUESTED_ROLE = ctx.scene.state['role']
      return await next()
    })

    this.hears(BUTTON_PATTERNS.EXIT, async (ctx) => {
      await this.deletePicker(ctx)
      await ctx.replyWithHTML(MESSAGES_SCENE.REGISTER.EXIT, CommonKeyboards.registerAs())
      return ctx.scene.leave()
    })

    this.initNameConfirmationActions()
  }

  private enterSceneHandler = async (ctx: BotContext) => {
    const { next } = this.sceneNavigation.getNavigation(this.REQUESTED_ROLE, REGISTER_SCENE_CURSOR_MAP.ENTER_HANDLER)
    return await this.goNext(ctx, next)
  }

  private nameHandler = async (ctx: BotContext) => {
    const { next } = this.sceneNavigation.getNavigation(this.REQUESTED_ROLE, REGISTER_SCENE_CURSOR_MAP.NAME_HANDLER)

    const { textPayload } = BotHelper.getUpdatePayload(ctx)

    const result = NameHelper.processNameInput(textPayload)
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

    return await this.goNext(ctx, next)
  }

  private phoneHandler = async (ctx: BotContext) => {
    const { next, prev } = this.sceneNavigation.getNavigation(this.REQUESTED_ROLE, REGISTER_SCENE_CURSOR_MAP.PHONE_HANDLER)

    const { textPayload } = BotHelper.getUpdatePayload(ctx)

    switch (textPayload) {
      case BUTTON_PATTERNS.BACK:
        return await this.goBack(ctx, prev)
      default:
        break
    }

    const phone = TextHelper.validatePhone(textPayload)

    if (!phone) {
      return ctx.replyWithHTML(MESSAGES_SCENE.REGISTER.PROVIDE_PHONE_ERROR)
    }

    this.registerScene.setState(ctx, { phone })
    const state = this.registerScene.getState(ctx)
    return await this.goNext(ctx, next, { data: state, role: this.REQUESTED_ROLE })
  }

  private dateOfBirthHandler = async (ctx: BotContext) => {
    const { next, prev } = this.sceneNavigation.getNavigation(this.REQUESTED_ROLE, REGISTER_SCENE_CURSOR_MAP.DOB_HANDLER)

    const { textPayload, isCallbackQueryUpdate } = BotHelper.getUpdatePayload(ctx)

    switch (textPayload) {
      case BUTTON_PATTERNS.BACK:
        await this.deletePicker(ctx)
        return await this.goBack(ctx, prev)
      default:
        break
    }

    const picked = await CalendarPicker.handle(ctx, this.getToday(), this.getDobPickerOptions())
    if (picked?.type === 'navigated') {
      return
    }
    if (!picked && isCallbackQueryUpdate) {
      return BotHelper.safeAnswerCbQuery(ctx)
    }

    // A picked day comes in the typed format, so both paths are validated the same way
    const date_of_birth = TextHelper.validateDateInput(picked?.type === 'selected' ? picked.date : textPayload)

    if (!date_of_birth) {
      return ctx.replyWithHTML(MESSAGES_COMMON.DATE_ERROR)
    }

    await this.closePicker(ctx, `🎂 Дата народження: ${TextHelper.bold(date_of_birth)}`)
    this.registerScene.setState(ctx, { date_of_birth })
    const state = this.registerScene.getState(ctx)

    if (next?.cursor === REGISTER_SCENE_CURSOR_MAP.GROUP_HANDLER) {
      return this.openGroupStep(ctx, next, 'next')
    }

    return await this.goNext(ctx, next, { data: state, role: this.REQUESTED_ROLE })
  }

  /** Client only: the group their pass will be bound to; the admin opens the pass for it on verification. */
  private groupHandler = async (ctx: BotContext) => {
    const { next, prev } = this.sceneNavigation.getNavigation(this.REQUESTED_ROLE, REGISTER_SCENE_CURSOR_MAP.GROUP_HANDLER)
    const { textPayload, isCallbackQueryUpdate } = BotHelper.getUpdatePayload(ctx)

    if (textPayload === BUTTON_PATTERNS.BACK) {
      await this.deletePicker(ctx)
      return await this.goBack(ctx, prev)
    }

    const groupSelectMatch = isCallbackQueryUpdate
      ? RegexHelper.getMatchValue(CALLBACK_PREFIX.SCENES.PASS.GROUP_SELECT, textPayload)
      : null

    if (!groupSelectMatch) {
      if (isCallbackQueryUpdate) {
        return BotHelper.safeAnswerCbQuery(ctx)
      }
      return ctx.replyWithHTML(MESSAGES_SCENE.REGISTER.SELECT_GROUP_HINT)
    }

    // Re-checked against the age filter: the button may be from an old list
    const [groupId] = groupSelectMatch
    const group = (await this.getGroupsForAge(ctx)).find((g) => g.id === Number(groupId))

    if (!group) {
      return BotHelper.safeAnswerCbQuery(ctx, MESSAGES_SCENE.REGISTER.SELECT_GROUP_HINT, { show_alert: true })
    }

    await BotHelper.safeAnswerCbQuery(ctx)
    this.registerScene.setState(ctx, { groupId: group.id, groupName: group.name })
    await this.closePicker(ctx, `👯‍♀️ Група: ${TextHelper.bold(TextHelper.escapeHtml(group.name))}`)

    const state = this.registerScene.getState(ctx)
    return await this.goNext(ctx, next, { data: state, role: this.REQUESTED_ROLE })
  }

  /**
   * Enters the group step (from the date of birth, or back from the payment). Without a group for the client's age
   * the step is skipped both ways and the admin picks the group on verification.
   */
  private async openGroupStep(ctx: BotContext, step: NavigationMapValues<IRegisterSceneState> | undefined, direction: 'next' | 'back') {
    const groupStep = this.sceneNavigation.getNavigation(this.REQUESTED_ROLE, REGISTER_SCENE_CURSOR_MAP.GROUP_HANDLER)
    const groups = await this.getGroupsForAge(ctx)
    const state = this.registerScene.getState(ctx)

    if (!groups.length) {
      this.registerScene.setState(ctx, { groupId: null, groupName: undefined })
      if (direction === 'back') {
        return await this.goBack(ctx, groupStep.prev)
      }
      await ctx.replyWithHTML(MESSAGES_SCENE.REGISTER.NO_GROUP_FOR_AGE)
      return await this.goNext(ctx, groupStep.next, { data: state, role: this.REQUESTED_ROLE })
    }

    const wizard =
      direction === 'next'
        ? await this.goNext(ctx, step)
        : await this.goBack(ctx, step)

    const message = await ctx.replyWithHTML(
      MESSAGES_SCENE.REGISTER.SELECT_GROUP_LIST,
      PassRelatedKeyboards.passGroupSelectInlineKeyboard(groups, { suggestedGroupId: state.groupId }),
    )
    this.registerScene.setState(ctx, { pickerMessageId: message.message_id })
    return wizard
  }

  /** Navigation that also opens the step's inline picker: the date of birth gets a calendar, wherever it is entered from. */
  private async goNext(...args: Parameters<RegisterSceneNavigation<IRegisterSceneState>['handleNext']>) {
    const wizard = await this.sceneNavigation.handleNext(...args)
    await this.openStepPicker(args[0], args[1])
    return wizard
  }

  private async goBack(...args: Parameters<RegisterSceneNavigation<IRegisterSceneState>['handleBack']>) {
    const wizard = await this.sceneNavigation.handleBack(...args)
    await this.openStepPicker(args[0], args[1])
    return wizard
  }

  private async openStepPicker(ctx: BotContext, step?: NavigationMapValues<IRegisterSceneState>) {
    if (step?.cursor !== REGISTER_SCENE_CURSOR_MAP.DOB_HANDLER) {
      return
    }
    const message = await ctx.replyWithHTML(
      MESSAGES_SCENE.REGISTER.DOB_PICKER,
      await CalendarPicker.keyboard(this.getToday(), this.getDobPickerOptions()),
    )
    this.registerScene.setState(ctx, { pickerMessageId: message.message_id })
  }

  /** Year → month → day; kids from 2 years old (the youngest groups), adults up to 80. */
  private getDobPickerOptions(): TCalendarPickerOptions {
    const year = Number(this.getToday().slice(0, 4))
    return { yearRange: { fromYear: year - 80, toYear: year - 2 }, withoutToday: true }
  }

  private getToday() {
    return this.dateTimeProvider.getTodayDateStringInTz(DATE_FORMAT.DATE_MAIN)
  }

  /** Active groups for the typed date of birth (the profile is saved only at the end of the scene). */
  private async getGroupsForAge(ctx: BotContext) {
    const { date_of_birth } = this.registerScene.getState(ctx)
    const dateOfBirth = date_of_birth
      ? this.dateTimeProvider.parseAndFormatDate({
          date: date_of_birth,
          outputDateFormat: DATE_FORMAT.DATE_MAIN,
          inputDateFormat: DATE_FORMAT.DATE_INPUT,
        })
      : null
    return this.groupService.getAgeAppropriateActiveGroups(dateOfBirth)
  }

  /** The open picker (calendar, group list) turns into a "🎂 …" / "👯‍♀️ Група: …" line, without buttons. */
  private async closePicker(ctx: BotContext, label: string) {
    const { pickerMessageId } = this.registerScene.getState(ctx)
    if (pickerMessageId) {
      await BotHelper.safeEditMessageTextById(ctx, ctx.chat?.id, pickerMessageId, label)
    }
    this.registerScene.setState(ctx, { pickerMessageId: null })
  }

  /** "Назад" / "Вийти": the open picker would stay with dead buttons, so it goes away. */
  private async deletePicker(ctx: BotContext) {
    const { pickerMessageId } = this.registerScene.getState(ctx)
    if (pickerMessageId && ctx.chat) {
      await ctx.telegram.deleteMessage(ctx.chat.id, pickerMessageId).catch(() => {})
    }
    this.registerScene.setState(ctx, { pickerMessageId: null })
  }

  private fileUploadHandler = async (ctx: BotContext) => {
    const { next, prev } = this.sceneNavigation.getNavigation(this.REQUESTED_ROLE, REGISTER_SCENE_CURSOR_MAP.FILE_UPLOAD_HANDLER)

    const { textPayload, isFileUpdate, fileId, fileType } = BotHelper.getUpdatePayload(ctx)
    const state = this.registerScene.getState(ctx)

    switch (textPayload) {
      case BUTTON_PATTERNS.BACK:
        if (prev?.cursor === REGISTER_SCENE_CURSOR_MAP.GROUP_HANDLER) {
          return this.openGroupStep(ctx, prev, 'back')
        }
        return await this.goBack(ctx, prev, {
          data: state,
          role: this.REQUESTED_ROLE,
        })
      case BUTTON_PATTERNS.PAY_CASH:
        this.registerScene.setState(ctx, { isCashPayment: true })
        return await this.goNext(ctx, next, {
          data: { ...state, isCashPayment: true },
          role: this.REQUESTED_ROLE,
        })
      default:
        break
    }

    if (isFileUpdate && fileId && fileType) {
      this.registerScene.setState(ctx, { fileId, fileType, isCashPayment: false })

      if (fileType === FileTypeEnum.PHOTO) {
        await ctx.replyWithPhoto(fileId, { caption: '📸 Фото успішно отримано' })
      }

      if (fileType === FileTypeEnum.DOCUMENT) {
        await ctx.replyWithDocument(fileId, { caption: '📄 Файл успішно отримано' })
      }
      await ctx.deleteMessage().catch(() => null)
      return await this.goNext(ctx, next, { data: state, role: this.REQUESTED_ROLE })
    }

    return ctx.replyWithHTML(
      '📸 <b>Завантаж фото</b> або 📄 <b>документ підтвердження оплати</b> для завершення реєстрації.',
      CommonSceneKeyboards.backExitWithCash(),
    )
  }

  private completeHandler = async (ctx: BotContext) => {
    const { prev } = this.sceneNavigation.getNavigation(this.REQUESTED_ROLE, REGISTER_SCENE_CURSOR_MAP.COMPLETE_HANDLER)

    const { textPayload } = BotHelper.getUpdatePayload(ctx)
    const state = this.registerScene.getState(ctx)

    switch (textPayload) {
      case BUTTON_PATTERNS.BACK:
        return await this.goBack(ctx, prev, { data: state, role: this.REQUESTED_ROLE })
      default:
        break
    }

    if (textPayload !== BUTTON_PATTERNS.CONFIRM) {
      return
    }

    const { firstName, lastName, phone, date_of_birth, fileId = null, fileType = null } = state
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
      fileId,
      fileType,
      status: isGuest ? UserProfileStatusEnum.ACTIVE : UserProfileStatusEnum.VERIFICATION_REQUESTED,
    })

    const sendMessageToStudioAdmins = async (ctx: BotContext) => {
      const studioAdmins = await this.userProfileService.findStudioAdmins()
      studioAdmins.forEach((admin) => {
        if (fileId && fileType) {
          const method = fileType === FileTypeEnum.PHOTO ? 'sendPhoto' : 'sendDocument'
          ctx.telegram[method](admin.telegramId, fileId, {
            caption: MessageHelper.getVerifyRequestMessage(state, { completed: true, role: this.REQUESTED_ROLE }),
            ...AdminKeyboards.verifyActions(id, this.REQUESTED_ROLE),
            parse_mode: 'HTML',
          }).catch((error) => console.error('Error sending verification request to admin:', error.message))
        } else {
          BotHelper.safeSendMessage(
            ctx.telegram,
            admin.telegramId,
            MessageHelper.getVerifyRequestMessage(state, { completed: true, role: this.REQUESTED_ROLE }),
            {
              ...AdminKeyboards.verifyActions(id, this.REQUESTED_ROLE),
            },
          )
        }
      })
    }

    if (this.REQUESTED_ROLE === UserProfileRoleEnum.CLIENT) {
      await this.userProfileService.saveRegisterRequest({ userProfileId: id, groupId: state.groupId ?? null, fileId, fileType })
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
      await BotHelper.safeDeleteMessage(ctx)
      const { next } = this.sceneNavigation.getNavigation(this.REQUESTED_ROLE, REGISTER_SCENE_CURSOR_MAP.NAME_HANDLER)
      return await this.goNext(ctx, next)
    })

    this.action('name_confirm_swap', async (ctx) => {
      BotHelper.safeAnswerCbQuery(ctx)
      await BotHelper.safeDeleteMessage(ctx)

      const state = this.registerScene.getState(ctx)
      // Swap the names
      this.registerScene.setState(ctx, {
        firstName: state.firstNameAlt,
        lastName: state.lastNameAlt,
      })

      await ctx.replyWithHTML(`✅ Порядок змінено на: <b>${state.firstNameAlt} ${state.lastNameAlt}</b>`)

      const { next } = this.sceneNavigation.getNavigation(this.REQUESTED_ROLE, REGISTER_SCENE_CURSOR_MAP.NAME_HANDLER)
      return await this.goNext(ctx, next)
    })

    this.action('name_confirm_retry', async (ctx) => {
      BotHelper.safeAnswerCbQuery(ctx)
      await BotHelper.safeDeleteMessage(ctx)
      return ctx.replyWithHTML(MESSAGES_SCENE.REGISTER.PROVIDE_NAME, CommonSceneKeyboards.exit())
    })
  }
}
