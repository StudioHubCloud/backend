import { Scenes } from 'telegraf'
import { Injectable } from '@nestjs/common'
import { PinoLogger } from 'nestjs-pino'
import { BotContext } from '@app/bot/bot.context'
import { DATE_FORMAT, FileTypeEnum, UserProfileRoleEnum, UserProfileStatusEnum } from '@app/libs'
import { CALLBACK_PREFIX, SCENES } from '@app/bot/libs'
import { BotHelper, KeyboardHelper, MessageHelper, NameHelper, RegexHelper, SceneHelper, TextHelper, UserHelper } from '@app/bot/helpers'
import { CalendarPicker, TCalendarPickerOptions } from '@app/bot/menus'
import { MESSAGES_COMMON, MESSAGES_SCENE } from '@app/bot/static/messages'
import { BUTTON_PATTERNS } from '@app/bot/static/button-patterns'
import { UserProfileService } from '@app/domain/user-profile'
import { GroupService } from '@app/domain/group'
import { DateTimeProvider, DateTimeProviderInjector } from '@app/infrastructure/providers'
import { AdminKeyboards, ClientKeyboards, CommonKeyboards, CommonSceneKeyboards } from '@app/bot/keyboard/storage'
import { PassRelatedKeyboards } from '@app/bot/keyboard/storage/scene-keyboards'

/** Scene entry: `withParent` = from the start screen (a parent who doesn't train registers with the child). */
export interface IRegisterChildSceneState {
  withParent?: boolean
  parentFirstName?: string
  parentLastName?: string
  parentPhone?: string
  firstName?: string
  lastName?: string
  /** dd.MM.yyyy, as typed or picked */
  date_of_birth?: string
  /** null: no group for the age, the admin picks one on verification */
  groupId?: number | null
  groupName?: string
  hasGroupsForAge?: boolean
  fileId?: string | null
  fileType?: FileTypeEnum | null
  isCashPayment?: boolean
  /** Open calendar / group list, removed on leaving the step (no dead buttons) */
  pickerMessageId?: number | null
}

const STEP = {
  ENTER: 0,
  PARENT_NAME: 1,
  PARENT_PHONE: 2,
  CHILD_NAME: 3,
  CHILD_DOB: 4,
  GROUP: 5,
  PAYMENT: 6,
  CONFIRM: 7,
} as const
type TStep = (typeof STEP)[keyof typeof STEP]

/**
 * "👧 Зареєструвати дитину" (start screen: parent name + phone first) and "➕ Зареєструвати дитину" («Мої діти», the parent
 * is already a client): child name → date of birth → group → payment → confirm. Creates the child (no Telegram) linked to
 * the parent and sends the admins one request with the parent's contacts.
 */
@Injectable()
export class RegisterChildScene extends Scenes.WizardScene<BotContext> {
  private readonly scene = new SceneHelper<IRegisterChildSceneState>()

  constructor(
    private readonly logger: PinoLogger,
    private readonly userProfileService: UserProfileService,
    private readonly groupService: GroupService,
    @DateTimeProviderInjector() private readonly dateTimeProvider: DateTimeProvider,
  ) {
    super(
      SCENES.REGISTER_CHILD,
      (ctx) => this.startHandler(ctx),
      (ctx) => this.parentNameHandler(ctx),
      (ctx) => this.parentPhoneHandler(ctx),
      (ctx) => this.childNameHandler(ctx),
      (ctx) => this.childDobHandler(ctx),
      (ctx) => this.groupHandler(ctx),
      (ctx) => this.paymentHandler(ctx),
      (ctx) => this.confirmHandler(ctx),
    )
    this.logger.setContext(RegisterChildScene.name)

    this.hears(BUTTON_PATTERNS.EXIT, async (ctx) => {
      await this.deletePicker(ctx)
      await ctx.replyWithHTML(MESSAGES_SCENE.REGISTER_CHILD.EXIT, this.getLeaveKeyboard(ctx))
      return ctx.scene.leave()
    })
  }

  private startHandler = async (ctx: BotContext) => {
    if (!this.canRegister(ctx)) {
      await ctx.replyWithHTML(MESSAGES_SCENE.REGISTER_CHILD.NOT_ALLOWED)
      return ctx.scene.leave()
    }
    return this.goTo(ctx, this.scene.getState(ctx).withParent ? STEP.PARENT_NAME : STEP.CHILD_NAME)
  }

  private parentNameHandler = async (ctx: BotContext) => {
    const name = await this.readName(ctx)
    if (!name) {
      return
    }
    this.scene.setState(ctx, { parentFirstName: name.firstName, parentLastName: name.lastName })
    return this.goTo(ctx, STEP.PARENT_PHONE)
  }

  private parentPhoneHandler = async (ctx: BotContext) => {
    const { textPayload } = BotHelper.getUpdatePayload(ctx)
    if (textPayload === BUTTON_PATTERNS.BACK) {
      return this.goTo(ctx, STEP.PARENT_NAME)
    }
    const phone = TextHelper.validatePhone(textPayload)
    if (!phone) {
      return ctx.replyWithHTML(MESSAGES_SCENE.REGISTER.PROVIDE_PHONE_ERROR)
    }
    this.scene.setState(ctx, { parentPhone: phone })
    return this.goTo(ctx, STEP.CHILD_NAME)
  }

  private childNameHandler = async (ctx: BotContext) => {
    const { textPayload } = BotHelper.getUpdatePayload(ctx)
    if (textPayload === BUTTON_PATTERNS.BACK && this.scene.getState(ctx).withParent) {
      return this.goTo(ctx, STEP.PARENT_PHONE)
    }
    const name = await this.readName(ctx)
    if (!name) {
      return
    }
    this.scene.setState(ctx, { firstName: name.firstName, lastName: name.lastName })
    return this.goTo(ctx, STEP.CHILD_DOB)
  }

  private childDobHandler = async (ctx: BotContext) => {
    const { textPayload, isCallbackQueryUpdate } = BotHelper.getUpdatePayload(ctx)
    if (textPayload === BUTTON_PATTERNS.BACK) {
      await this.deletePicker(ctx)
      return this.goTo(ctx, STEP.CHILD_NAME)
    }

    const picked = await CalendarPicker.handle(ctx, this.getToday(), this.getDobPickerOptions())
    if (picked?.type === 'navigated') {
      return
    }
    if (!picked && isCallbackQueryUpdate) {
      return BotHelper.safeAnswerCbQuery(ctx)
    }

    const dateOfBirth = TextHelper.validateDateInput(picked?.type === 'selected' ? picked.date : textPayload)
    if (!dateOfBirth) {
      return ctx.replyWithHTML(MESSAGES_COMMON.DATE_ERROR)
    }

    await this.closePicker(ctx, `🎂 Дата народження: ${TextHelper.bold(dateOfBirth)}`)
    this.scene.setState(ctx, { date_of_birth: dateOfBirth })
    return this.goTo(ctx, STEP.GROUP)
  }

  private groupHandler = async (ctx: BotContext) => {
    const { textPayload, isCallbackQueryUpdate } = BotHelper.getUpdatePayload(ctx)
    if (textPayload === BUTTON_PATTERNS.BACK) {
      await this.deletePicker(ctx)
      return this.goTo(ctx, STEP.CHILD_DOB)
    }

    const match = isCallbackQueryUpdate ? RegexHelper.getMatchValue(CALLBACK_PREFIX.SCENES.PASS.GROUP_SELECT, textPayload) : null
    if (!match) {
      return isCallbackQueryUpdate ? BotHelper.safeAnswerCbQuery(ctx) : ctx.replyWithHTML(MESSAGES_SCENE.REGISTER.SELECT_GROUP_HINT)
    }

    // Re-checked against the age filter: the button may be from an old list
    const [groupId] = match
    const group = (await this.getGroupsForAge(ctx)).find((g) => g.id === Number(groupId))
    if (!group) {
      return BotHelper.safeAnswerCbQuery(ctx, MESSAGES_SCENE.REGISTER.SELECT_GROUP_HINT, { show_alert: true })
    }

    await BotHelper.safeAnswerCbQuery(ctx)
    this.scene.setState(ctx, { groupId: group.id, groupName: group.name })
    await this.closePicker(ctx, `👯‍♀️ Група: ${TextHelper.bold(TextHelper.escapeHtml(group.name))}`)
    return this.goTo(ctx, STEP.PAYMENT)
  }

  private paymentHandler = async (ctx: BotContext) => {
    const { textPayload, isFileUpdate, fileId, fileType } = BotHelper.getUpdatePayload(ctx)

    if (textPayload === BUTTON_PATTERNS.BACK) {
      return this.goTo(ctx, this.scene.getState(ctx).hasGroupsForAge ? STEP.GROUP : STEP.CHILD_DOB)
    }
    if (textPayload === BUTTON_PATTERNS.PAY_CASH) {
      this.scene.setState(ctx, { isCashPayment: true, fileId: null, fileType: null })
      return this.goTo(ctx, STEP.CONFIRM)
    }
    if (isFileUpdate && fileId && fileType) {
      this.scene.setState(ctx, { isCashPayment: false, fileId, fileType })
      return this.goTo(ctx, STEP.CONFIRM)
    }
    return ctx.replyWithHTML(MESSAGES_SCENE.REGISTER_CHILD.PAYMENT_HINT, CommonSceneKeyboards.backExitWithCash())
  }

  private confirmHandler = async (ctx: BotContext) => {
    const { textPayload } = BotHelper.getUpdatePayload(ctx)
    if (textPayload === BUTTON_PATTERNS.BACK) {
      return this.goTo(ctx, STEP.PAYMENT)
    }
    if (textPayload !== BUTTON_PATTERNS.CONFIRM) {
      return
    }

    // The real person (never the acting child); re-checked: the status may have changed while the scene was open
    const parent = UserHelper.getUser(ctx)
    const state = this.scene.getState(ctx)
    if (!this.canRegister(ctx)) {
      await ctx.replyWithHTML(MESSAGES_SCENE.REGISTER_CHILD.NOT_ALLOWED, this.getLeaveKeyboard(ctx))
      return ctx.scene.leave()
    }

    const parentFirstName = state.withParent ? state.parentFirstName! : parent.firstName
    const parentLastName = state.withParent ? (state.parentLastName ?? null) : parent.lastName
    const parentPhone = state.withParent ? state.parentPhone! : parent.phoneNumber
    const parentFullName = state.withParent ? UserHelper.getFullName(parentFirstName, parentLastName) : parent.fullName
    const childFullName = UserHelper.getFullName(state.firstName!, state.lastName)

    let child: Awaited<ReturnType<UserProfileService['createChildProfile']>>
    try {
      child = await this.userProfileService.createChildProfile({
        guardianId: parent.id,
        firstName: state.firstName!,
        lastName: state.lastName ?? null,
        fullName: childFullName,
        dateOfBirth: this.toDbDate(state.date_of_birth!),
        groupId: state.groupId ?? null,
        fileId: state.fileId ?? null,
        fileType: state.fileType ?? null,
        // A parent who doesn't train: a client waiting for the same approval as the child
        guardianUpdate: state.withParent
          ? {
              firstName: parentFirstName,
              lastName: parentLastName,
              fullName: parentFullName,
              phoneNumber: parentPhone,
              role: UserProfileRoleEnum.CLIENT,
              status: UserProfileStatusEnum.VERIFICATION_REQUESTED,
            }
          : undefined,
      })
    } catch (error) {
      this.logger.error(error, 'Child registration failed for parent %s', parent.id)
      await ctx.replyWithHTML(MESSAGES_SCENE.REGISTER_CHILD.SAVE_ERROR, this.getLeaveKeyboard(ctx))
      return ctx.scene.leave()
    }

    await this.sendRequestToAdmins(ctx, child.id, state, {
      fullName: parentFullName,
      phoneNumber: parentPhone,
      telegramUsername: parent.telegramUsername,
    })
    // From the start screen the parent now waits for the approval (same keyboard as after a client registration)
    // A client who just added a child is a parent now: the profile button appears in the menu (acting unchanged)
    const actingName = UserHelper.isActingForChild(ctx) ? UserHelper.getActingUser(ctx).firstName : null
    const keyboard = state.withParent ? CommonKeyboards.registerAs() : ClientKeyboards.mainMenu({ parent: { actingName } })
    await ctx.replyWithHTML(MESSAGES_SCENE.REGISTER_CHILD.COMPLETE, keyboard)
    return ctx.scene.leave()
  }

  /** Start screen: a not yet registered person. «Мої діти»: an active client. */
  private canRegister(ctx: BotContext) {
    const user = UserHelper.getUser(ctx)
    return this.scene.getState(ctx).withParent
      ? UserHelper.isUnverifiedStatus(ctx)
      : user.role === UserProfileRoleEnum.CLIENT && user.status === UserProfileStatusEnum.ACTIVE
  }

  private getLeaveKeyboard(ctx: BotContext) {
    return this.scene.getState(ctx).withParent ? CommonKeyboards.registerAs() : KeyboardHelper.getMainMenuKeyboard(ctx)
  }

  private async sendRequestToAdmins(
    ctx: BotContext,
    childId: string,
    state: IRegisterChildSceneState,
    parent: { fullName: string; phoneNumber: string | null; telegramUsername: string | null },
  ) {
    const caption = MessageHelper.getVerifyRequestMessage(
      {
        firstName: state.firstName,
        lastName: state.lastName,
        date_of_birth: state.date_of_birth,
        groupName: state.groupName,
        isCashPayment: state.isCashPayment,
      },
      { completed: true, role: UserProfileRoleEnum.CLIENT, parents: [parent] },
    )
    const keyboard = AdminKeyboards.verifyActions(childId, UserProfileRoleEnum.CLIENT)
    const admins = await this.userProfileService.findRequestReviewers()

    await Promise.all(
      admins.map(async (admin) => {
        if (!state.fileId || !state.fileType) {
          return BotHelper.safeSendMessage(ctx.telegram, admin.telegramId, caption, keyboard)
        }
        const method = state.fileType === FileTypeEnum.PHOTO ? 'sendPhoto' : 'sendDocument'
        return ctx.telegram[method](admin.telegramId, state.fileId, { caption, parse_mode: 'HTML', ...keyboard }).catch((error) =>
          this.logger.error('Error sending child verification request to admin: %s', error?.message),
        )
      }),
    )
  }

  /** Sends the step's prompt (and its inline picker) and moves the wizard there. */
  private async goTo(ctx: BotContext, step: TStep) {
    const state = this.scene.getState(ctx)
    const M = MESSAGES_SCENE.REGISTER_CHILD

    switch (step) {
      case STEP.PARENT_NAME:
        await ctx.replyWithHTML(M.PARENT_NAME, CommonSceneKeyboards.exit())
        break
      case STEP.PARENT_PHONE:
        await ctx.replyWithHTML(MESSAGES_SCENE.REGISTER.PROVIDE_PHONE, CommonSceneKeyboards.backWithExit())
        break
      case STEP.CHILD_NAME:
        await ctx.replyWithHTML(M.CHILD_NAME, state.withParent ? CommonSceneKeyboards.backWithExit() : CommonSceneKeyboards.exit())
        break
      case STEP.CHILD_DOB: {
        await ctx.replyWithHTML(M.CHILD_DOB, CommonSceneKeyboards.backWithExit())
        const picker = await ctx.replyWithHTML(
          MESSAGES_SCENE.REGISTER.DOB_PICKER,
          await CalendarPicker.keyboard(this.getToday(), this.getDobPickerOptions()),
        )
        this.scene.setState(ctx, { pickerMessageId: picker.message_id })
        break
      }
      case STEP.GROUP: {
        const groups = await this.getGroupsForAge(ctx)
        this.scene.setState(ctx, { hasGroupsForAge: groups.length > 0 })
        if (!groups.length) {
          // No group for the age: skipped both ways, the admin picks one on verification
          this.scene.setState(ctx, { groupId: null, groupName: undefined })
          await ctx.replyWithHTML(M.NO_GROUP_FOR_AGE)
          return this.goTo(ctx, STEP.PAYMENT)
        }
        await ctx.replyWithHTML(M.SELECT_GROUP, CommonSceneKeyboards.backWithExit())
        const list = await ctx.replyWithHTML(
          M.SELECT_GROUP_LIST,
          PassRelatedKeyboards.passGroupSelectInlineKeyboard(groups, { suggestedGroupId: state.groupId }),
        )
        this.scene.setState(ctx, { pickerMessageId: list.message_id })
        break
      }
      case STEP.PAYMENT:
        await ctx.replyWithHTML(M.PAYMENT, CommonSceneKeyboards.backExitWithCash())
        break
      case STEP.CONFIRM:
        await ctx.replyWithHTML(this.getSummary(ctx), CommonSceneKeyboards.backExitConfirm())
        break
    }
    return ctx.wizard.selectStep(step)
  }

  private getSummary(ctx: BotContext) {
    const state = this.scene.getState(ctx)
    const user = UserHelper.getUser(ctx)
    const parentName = state.withParent ? UserHelper.getFullName(state.parentFirstName!, state.parentLastName) : user.fullName
    const parentPhone = state.withParent ? state.parentPhone : user.phoneNumber
    const childLines = [
      `🧒 Дитина: ${TextHelper.bold(TextHelper.escapeHtml(UserHelper.getFullName(state.firstName!, state.lastName)))}`,
      `🎂 Дата народження: ${TextHelper.bold(state.date_of_birth ?? '')}`,
      state.groupName ? `👯‍♀️ Група: ${TextHelper.bold(TextHelper.escapeHtml(state.groupName))}` : `👯‍♀️ Група: підбере адміністратор`,
      state.isCashPayment ? `💵 Оплата готівкою` : `📎 Підтвердження оплати додано`,
    ]
    const parentLines = [
      `👤 Ти: ${TextHelper.bold(TextHelper.escapeHtml(parentName))}`,
      parentPhone ? `📞 Телефон: ${TextHelper.bold(parentPhone)}` : null,
    ].filter(Boolean)
    return (
      `🔍 Перевір, чи все вірно:\n\n${parentLines.join('\n')}\n\n${childLines.join('\n')}\n\n` +
      `👌 Якщо все правильно — тисни “${BUTTON_PATTERNS.CONFIRM}”\n❌ Щоб щось змінити — “${BUTTON_PATTERNS.BACK}”`
    )
  }

  /** Name step (parent or child): "Ім'я Прізвище", same parsing as the registration; null = asked again. */
  private async readName(ctx: BotContext) {
    const { textPayload } = BotHelper.getUpdatePayload(ctx)
    const { firstName, lastName } = NameHelper.processNameInput(textPayload)
    const validation = NameHelper.validateNames(firstName, lastName)
    if (!validation.isValid) {
      await ctx.replyWithHTML(`❌ ${validation.suggestion}\n\nСпробуй ще раз:`)
      return null
    }
    return { firstName, lastName: lastName || undefined }
  }

  /** Kids: years from 2 to 18 back (year → month → day). */
  private getDobPickerOptions(): TCalendarPickerOptions {
    const year = Number(this.getToday().slice(0, 4))
    return { yearRange: { fromYear: year - 18, toYear: year - 2 }, withoutToday: true }
  }

  private getToday() {
    return this.dateTimeProvider.getTodayDateStringInTz(DATE_FORMAT.DATE_MAIN)
  }

  private toDbDate(dateInput: string) {
    return this.dateTimeProvider.parseAndFormatDate({
      date: dateInput,
      outputDateFormat: DATE_FORMAT.DATE_MAIN,
      inputDateFormat: DATE_FORMAT.DATE_INPUT,
    })
  }

  private async getGroupsForAge(ctx: BotContext) {
    const { date_of_birth } = this.scene.getState(ctx)
    return this.groupService.getAgeAppropriateActiveGroups(date_of_birth ? this.toDbDate(date_of_birth) : null)
  }

  private async closePicker(ctx: BotContext, label: string) {
    const { pickerMessageId } = this.scene.getState(ctx)
    if (pickerMessageId) {
      await BotHelper.safeEditMessageTextById(ctx, ctx.chat?.id, pickerMessageId, label)
    }
    this.scene.setState(ctx, { pickerMessageId: null })
  }

  private async deletePicker(ctx: BotContext) {
    const { pickerMessageId } = this.scene.getState(ctx)
    if (pickerMessageId && ctx.chat) {
      await ctx.telegram.deleteMessage(ctx.chat.id, pickerMessageId).catch(() => {})
    }
    this.scene.setState(ctx, { pickerMessageId: null })
  }
}
