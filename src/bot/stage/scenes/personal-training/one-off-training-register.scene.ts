import { Injectable } from '@nestjs/common'
import { Scenes } from 'telegraf'
import { parse } from 'date-fns'
import { BotContext } from '@app/bot/bot.context'
import {
  BotHelper,
  KeyboardHelper,
  PersonalTrainingHelper,
  RegexHelper,
  SceneHelper,
  StaffAvailabilityHelper,
  TBusyIntervalsLoader,
  TextHelper,
  UserHelper,
} from '@app/bot/helpers'
import { CALLBACK_PREFIX, SCENES, TReplyInlineKeyboard } from '@app/bot/libs'
import { BUTTON_PATTERNS } from '@app/bot/static/button-patterns'
import { MESSAGES_SCENE } from '@app/bot/static/messages'
import { TypedConfigService } from '@app/infrastructure/config'
import { DateTimeProvider, DateTimeProviderInjector } from '@app/infrastructure/providers'
import { CommonSceneKeyboards, OneOffTrainingRegisterSceneKeyboards } from '@app/bot/keyboard/storage/scene-keyboards'
import { AuditLogActions, AuditLogTrigger, DATE_FORMAT } from '@app/libs'
import { StaffMemberSelectModel, StudioPriceSelectModel, UserProfileSelectModel } from '@app/infrastructure/database'
import { UserProfileService } from '@app/domain/user-profile'
import { PersonalTrainingSignupService } from '@app/domain/personal-training-signup'
import { CalendarPicker, TimePicker } from '@app/bot/menus'
import { AuditLogHelper } from '@app/bot/helpers/audit-log.helper'

const PARTICIPANTS_NOTE_MAX_LENGTH = 500

export interface IOneOffTrainingRegisterSceneState {
  staffUserId: string
  staffUserProfile: UserProfileSelectModel & { staffMember: StaffMemberSelectModel }
  studioPrice: StudioPriceSelectModel
  scheduledDate: string
  scheduledAt: string
  participantsNote: string
  pickerMessageId: number // the open inline step (price list, calendar, time picker): closed into a label on typed input, deleted on exit
}

/**
 * Admin-driven registration of a one-off session (individual / duo / trio) for a trainer.
 *
 * A one-off is not a pass and is not tied to a client (the person may be a group client or not in the bot at all):
 * it belongs to the trainer, and the admin types who came. The date may be in the past or the future.
 */
@Injectable()
export class OneOffTrainingRegisterScene extends Scenes.WizardScene<BotContext> {
  private readonly scene = new SceneHelper<IOneOffTrainingRegisterSceneState>()
  // "⬅️ Назад" in the pickers returns to the previous step (calendar → price list, hours → calendar)
  private readonly pickerBaseOptions = { withBackButton: true }
  private mainTainerChatId: string

  constructor(
    @DateTimeProviderInjector() private readonly dateTimeProvider: DateTimeProvider,
    private readonly configService: TypedConfigService,
    private readonly userProfileService: UserProfileService,
    private readonly personalTrainingSignupService: PersonalTrainingSignupService,
  ) {
    super(
      SCENES.ONE_OFF_TRAINING_REGISTER,
      (ctx) => this.enterSceneHandler(ctx),
      (ctx) => this.priceSelectHandler(ctx),
      (ctx) => this.dateHandler(ctx),
      (ctx) => this.timeHandler(ctx),
      (ctx) => this.participantsHandler(ctx),
      (ctx) => this.confirmHandler(ctx),
    )

    this.mainTainerChatId = this.configService.get('MAINTAINER_CHAT_ID')

    this.hears(BUTTON_PATTERNS.EXIT, async (ctx) => {
      const { role } = UserHelper.getUser(ctx)
      await this.deletePicker(ctx)
      await ctx.replyWithHTML(MESSAGES_SCENE.ONE_OFF_TRAINING_REGISTER.EXIT, KeyboardHelper.getRoleBasedMainMenuKeyboard(role))
      return ctx.scene.leave()
    })

    this.enter(async (ctx, next) => {
      try {
        const { staffUserId } = this.scene.getState(ctx, ['staffUserId'])
        const staffUserProfiles = await this.userProfileService.getAllActiveStaffMembersUserProfiles()
        const staffUserProfile = staffUserProfiles.find((profile) => profile.id === staffUserId)

        if (!staffUserProfile?.staffMember) {
          await ctx.replyWithHTML(MESSAGES_SCENE.ONE_OFF_TRAINING_REGISTER.NO_TRAINER)
          return ctx.scene.leave()
        }

        this.scene.setState(ctx, { staffUserProfile: { ...staffUserProfile, staffMember: staffUserProfile.staffMember } })
        return await next()
      } catch (error) {
        return this.scene.handleAdminSceneError(ctx, error, this.mainTainerChatId)
      }
    })
  }

  private enterSceneHandler = async (ctx: BotContext) => {
    try {
      const { staffUserProfile } = this.scene.getState(ctx, ['staffUserProfile'])
      // Carries the "🚪 Вийти" reply keyboard for the whole scene; the following steps use inline keyboards
      await ctx.replyWithHTML(
        `${MESSAGES_SCENE.ONE_OFF_TRAINING_REGISTER.START} ${TextHelper.bold(UserHelper.getDisplayName(staffUserProfile))}\n\n${MESSAGES_SCENE.ONE_OFF_TRAINING_REGISTER.START_HINT}`,
        CommonSceneKeyboards.exit(),
      )

      if (!(await this.renderPriceSelect(ctx, false))) {
        return ctx.scene.leave()
      }

      return ctx.wizard.next()
    } catch (error) {
      return this.scene.handleAdminSceneError(ctx, error, this.mainTainerChatId)
    }
  }

  /** Sends the one-off price list, or (going back from the calendar) edits the current message into it. False when there are none. */
  private async renderPriceSelect(ctx: BotContext, shouldEdit: boolean): Promise<boolean> {
    const prices = await this.personalTrainingSignupService.getOneOffPrices()

    if (!prices.length) {
      await ctx.replyWithHTML(MESSAGES_SCENE.ONE_OFF_TRAINING_REGISTER.NO_PRICES)
      return false
    }

    const keyboard = OneOffTrainingRegisterSceneKeyboards.priceSelectInlineKeyboard(prices)

    if (shouldEdit) {
      await BotHelper.safeEditMessageText(ctx, MESSAGES_SCENE.ONE_OFF_TRAINING_REGISTER.SELECT_PRICE, keyboard)
    } else {
      await this.replyWithPicker(ctx, MESSAGES_SCENE.ONE_OFF_TRAINING_REGISTER.SELECT_PRICE, keyboard)
    }
    return true
  }

  /** Calendar marking the trainer's busy days; built per update because it depends on this user's scene state. */
  private getCalendarOptions(ctx: BotContext) {
    const { staffUserProfile } = this.scene.getState(ctx)
    return StaffAvailabilityHelper.calendarOptions(this.loadBusyIntervals(staffUserProfile.staffMember.id), this.dateTimeProvider, this.pickerBaseOptions)
  }

  /** Time picker disabling the trainer's busy slots on the picked date. */
  private getTimeOptions(ctx: BotContext) {
    const { staffUserProfile, scheduledDate } = this.scene.getState(ctx)
    return StaffAvailabilityHelper.timeOptions(
      this.loadBusyIntervals(staffUserProfile.staffMember.id),
      scheduledDate,
      this.dateTimeProvider,
      this.pickerBaseOptions,
    )
  }

  private loadBusyIntervals(staffMemberId: string): TBusyIntervalsLoader {
    return (fromIso, toIso) => this.personalTrainingSignupService.getStaffMemberBusyIntervals(staffMemberId, fromIso, toIso)
  }

  /** Sends a picker and remembers its message, so typed input can close it like a button pick does. */
  private async replyWithPicker(ctx: BotContext, text: string, keyboard: TReplyInlineKeyboard) {
    const message = await ctx.replyWithHTML(text, keyboard)
    this.scene.setState(ctx, { pickerMessageId: message.message_id })
  }

  /** Typed date/time: the open picker turns into its "📅 Дата: …" / "⏰ Час: …" line (no keyboard). */
  private async closePicker(ctx: BotContext, label: string) {
    const { pickerMessageId } = this.scene.getState(ctx)
    await BotHelper.safeEditMessageTextById(ctx, ctx.chat?.id, pickerMessageId, label)
  }

  /** "Вийти": the open inline step (price list, calendar, time) would stay with dead buttons, so it goes away. */
  private async deletePicker(ctx: BotContext) {
    const { pickerMessageId } = this.scene.getState(ctx)
    if (pickerMessageId && ctx.chat) {
      await ctx.telegram.deleteMessage(ctx.chat.id, pickerMessageId).catch(() => {})
    }
  }

  /** Studio-local today in DATE_FORMAT.DATE_MAIN, as CalendarPicker expects. */
  private getToday() {
    return this.dateTimeProvider.getTodayDateStringInTz(DATE_FORMAT.DATE_MAIN)
  }

  private priceSelectHandler = async (ctx: BotContext) => {
    try {
      const { textPayload, isCallbackQueryUpdate } = BotHelper.getUpdatePayload(ctx)

      if (!isCallbackQueryUpdate) {
        return
      }

      const priceSelectMatch = RegexHelper.getMatchValue(CALLBACK_PREFIX.SCENES.PERSONAL_TRAINING.PRICE_SELECT, textPayload)

      if (!priceSelectMatch) {
        return BotHelper.safeAnswerCbQuery(ctx)
      }

      const [studioPriceId] = priceSelectMatch
      BotHelper.safeAnswerCbQuery(ctx)

      const prices = await this.personalTrainingSignupService.getOneOffPrices()
      const studioPrice = prices.find((price) => price.id === studioPriceId)

      if (!studioPrice) {
        await ctx.replyWithHTML(MESSAGES_SCENE.ONE_OFF_TRAINING_REGISTER.NO_PRICES)
        return ctx.scene.leave()
      }

      this.scene.setState(ctx, { studioPrice })

      await BotHelper.safeEditMessageText(
        ctx,
        `${MESSAGES_SCENE.ONE_OFF_TRAINING_REGISTER.PRICE_LABEL} ${TextHelper.bold(TextHelper.escapeHtml(studioPrice.name))}`,
      )
      await this.replyWithPicker(ctx, MESSAGES_SCENE.PERSONAL_TRAINING_REGISTER.ENTER_DATE, await CalendarPicker.keyboard(this.getToday(), this.getCalendarOptions(ctx)))

      return ctx.wizard.next()
    } catch (error) {
      return this.scene.handleAdminSceneError(ctx, error, this.mainTainerChatId)
    }
  }

  private dateHandler = async (ctx: BotContext) => {
    try {
      const { textPayload, isTextUpdate, isCallbackQueryUpdate } = BotHelper.getUpdatePayload(ctx)
      let scheduledDate: string | null = null

      if (isCallbackQueryUpdate) {
        const picked = await CalendarPicker.handle(ctx, this.getToday(), this.getCalendarOptions(ctx))
        if (!picked) {
          return BotHelper.safeAnswerCbQuery(ctx) // a button from another message
        }
        if (picked.type === 'back') {
          // The calendar message turns back into the price list
          if (!(await this.renderPriceSelect(ctx, true))) {
            return ctx.scene.leave()
          }
          return ctx.wizard.back()
        }
        if (picked.type !== 'selected') {
          return
        }
        scheduledDate = picked.date
        await BotHelper.safeEditMessageText(ctx, `${MESSAGES_SCENE.PERSONAL_TRAINING_REGISTER.DATE_LABEL} ${TextHelper.bold(scheduledDate)}`)
      } else if (isTextUpdate) {
        scheduledDate = TextHelper.validateDateInput(textPayload)
        if (!scheduledDate) {
          await this.replyWithPicker(ctx, MESSAGES_SCENE.PERSONAL_TRAINING_REGISTER.ENTER_DATE_ERROR, await CalendarPicker.keyboard(this.getToday(), this.getCalendarOptions(ctx)))
          return
        }
        await this.closePicker(ctx, `${MESSAGES_SCENE.PERSONAL_TRAINING_REGISTER.DATE_LABEL} ${TextHelper.bold(scheduledDate)}`)
      } else {
        return
      }

      this.scene.setState(ctx, { scheduledDate })
      await this.replyWithPicker(ctx, MESSAGES_SCENE.PERSONAL_TRAINING_REGISTER.ENTER_TIME, await TimePicker.keyboard(this.getTimeOptions(ctx)))

      return ctx.wizard.next()
    } catch (error) {
      return this.scene.handleAdminSceneError(ctx, error, this.mainTainerChatId)
    }
  }

  private timeHandler = async (ctx: BotContext) => {
    try {
      const { textPayload, isTextUpdate, isCallbackQueryUpdate } = BotHelper.getUpdatePayload(ctx)
      let validatedTime: string | null = null

      if (isCallbackQueryUpdate) {
        const picked = await TimePicker.handle(ctx, this.getTimeOptions(ctx))
        if (!picked) {
          return BotHelper.safeAnswerCbQuery(ctx) // e.g. a calendar button from the previous step
        }
        if (picked.type === 'back') {
          // The hours message turns back into the calendar
          await BotHelper.safeEditMessageText(
            ctx,
            MESSAGES_SCENE.PERSONAL_TRAINING_REGISTER.ENTER_DATE,
            await CalendarPicker.keyboard(this.getToday(), this.getCalendarOptions(ctx)),
          )
          return ctx.wizard.back()
        }
        if (picked.type !== 'selected') {
          return
        }
        validatedTime = picked.time
        await BotHelper.safeEditMessageText(ctx, `${MESSAGES_SCENE.PERSONAL_TRAINING_REGISTER.TIME_LABEL} ${TextHelper.bold(validatedTime)}`)
      } else if (isTextUpdate) {
        validatedTime = TextHelper.validateTimeInput(textPayload)
        if (!validatedTime) {
          await this.replyWithPicker(ctx, MESSAGES_SCENE.PERSONAL_TRAINING_REGISTER.ENTER_TIME_ERROR, await TimePicker.keyboard(this.getTimeOptions(ctx)))
          return
        }
        await this.closePicker(ctx, `${MESSAGES_SCENE.PERSONAL_TRAINING_REGISTER.TIME_LABEL} ${TextHelper.bold(validatedTime)}`)
      } else {
        return
      }

      const { scheduledDate } = this.scene.getState(ctx)

      // Studio-local wall clock -> UTC instant. getUtcString() would treat it as already-UTC and shift it.
      const parsedDate = parse(scheduledDate, DATE_FORMAT.DATE_INPUT, new Date())
      const scheduledAt = this.dateTimeProvider.getUtcStringTz(this.dateTimeProvider.addTimeToDate(parsedDate, validatedTime))

      this.scene.setState(ctx, { scheduledAt })

      // A typed time skips the picker's busy slots, so the conflict is shown right away (and again on confirm)
      const { staffUserProfile } = this.scene.getState(ctx)
      const conflictWarning = await StaffAvailabilityHelper.getConflictWarning(
        this.loadBusyIntervals(staffUserProfile.staffMember.id),
        scheduledAt,
        this.dateTimeProvider,
      )
      await ctx.replyWithHTML(
        `${MESSAGES_SCENE.ONE_OFF_TRAINING_REGISTER.ENTER_PARTICIPANTS}${conflictWarning}`,
        CommonSceneKeyboards.backWithExit(),
      )

      return ctx.wizard.next()
    } catch (error) {
      return this.scene.handleAdminSceneError(ctx, error, this.mainTainerChatId)
    }
  }

  private participantsHandler = async (ctx: BotContext) => {
    try {
      const { textPayload, isTextUpdate, isCallbackQueryUpdate } = BotHelper.getUpdatePayload(ctx)

      if (!isTextUpdate) {
        return isCallbackQueryUpdate ? BotHelper.safeAnswerCbQuery(ctx) : undefined // stale picker button
      }

      if (textPayload === BUTTON_PATTERNS.BACK) {
        // Restore the exit-only reply keyboard, then show the time picker again
        await ctx.replyWithHTML(MESSAGES_SCENE.ONE_OFF_TRAINING_REGISTER.BACK_TO_TIME, CommonSceneKeyboards.exit())
        await this.replyWithPicker(ctx, MESSAGES_SCENE.PERSONAL_TRAINING_REGISTER.ENTER_TIME, await TimePicker.keyboard(this.getTimeOptions(ctx)))
        return ctx.wizard.back()
      }

      const participantsNote = textPayload?.trim()

      if (!participantsNote || participantsNote.length > PARTICIPANTS_NOTE_MAX_LENGTH) {
        await ctx.replyWithHTML(MESSAGES_SCENE.ONE_OFF_TRAINING_REGISTER.ENTER_PARTICIPANTS_ERROR)
        return
      }

      this.scene.setState(ctx, { participantsNote })
      const { staffUserProfile, studioPrice, scheduledAt } = this.scene.getState(ctx)

      const conflictWarning = await StaffAvailabilityHelper.getConflictWarning(
        this.loadBusyIntervals(staffUserProfile.staffMember.id),
        scheduledAt,
        this.dateTimeProvider,
      )
      const confirmMessage =
        PersonalTrainingHelper.getOneOffConfirmMessage(
          UserHelper.getDisplayName(staffUserProfile),
          { scheduledAt, participantsNote, studioPrice },
          this.dateTimeProvider,
        ) + conflictWarning

      await ctx.replyWithHTML(confirmMessage, CommonSceneKeyboards.backExitConfirm())
      return ctx.wizard.next()
    } catch (error) {
      return this.scene.handleAdminSceneError(ctx, error, this.mainTainerChatId)
    }
  }

  private confirmHandler = async (ctx: BotContext) => {
    try {
      const { textPayload, isTextUpdate, isCallbackQueryUpdate } = BotHelper.getUpdatePayload(ctx)

      if (!isTextUpdate) {
        return isCallbackQueryUpdate ? BotHelper.safeAnswerCbQuery(ctx) : undefined // stale picker button
      }

      if (textPayload === BUTTON_PATTERNS.BACK) {
        // Back to the participants step (its reply keyboard has Back + Exit)
        await ctx.replyWithHTML(MESSAGES_SCENE.ONE_OFF_TRAINING_REGISTER.BACK_TO_PARTICIPANTS)
        await ctx.replyWithHTML(MESSAGES_SCENE.ONE_OFF_TRAINING_REGISTER.ENTER_PARTICIPANTS, CommonSceneKeyboards.backWithExit())
        return ctx.wizard.back()
      }

      if (textPayload !== BUTTON_PATTERNS.CONFIRM) {
        return
      }

      const { staffUserProfile, studioPrice, scheduledAt, participantsNote } = this.scene.getState(ctx)

      const [created, logOperations] = await this.personalTrainingSignupService.registerOneOffTraining({
        staffMemberId: staffUserProfile.staffMember.id,
        studioPriceId: studioPrice.id,
        scheduledAt,
        participantsNote,
      })

      AuditLogHelper.startAction(ctx, AuditLogActions.PERSONAL_TRAINING_REGISTER, AuditLogTrigger.ADMIN_ACTION, logOperations)

      await BotHelper.safeSendMessage(
        ctx.telegram,
        staffUserProfile.telegramId,
        PersonalTrainingHelper.getTrainerRegisteredMessage({ ...created, studioPrice }, this.dateTimeProvider),
      )

      const { role } = UserHelper.getUser(ctx)
      await ctx.replyWithHTML(MESSAGES_SCENE.ONE_OFF_TRAINING_REGISTER.REGISTER_SUCCESS, KeyboardHelper.getRoleBasedMainMenuKeyboard(role))

      return ctx.scene.leave()
    } catch (error) {
      return this.scene.handleAdminSceneError(ctx, error, this.mainTainerChatId)
    }
  }
}
