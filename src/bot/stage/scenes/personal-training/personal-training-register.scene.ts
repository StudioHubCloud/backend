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
import { CALLBACK_PREFIX, SCENES, TReplyInlineKeyboard, UserProfileWithClient } from '@app/bot/libs'
import { BUTTON_PATTERNS } from '@app/bot/static/button-patterns'
import { MESSAGES_SCENE } from '@app/bot/static/messages'
import { TypedConfigService } from '@app/infrastructure/config'
import { DateTimeProvider, DateTimeProviderInjector } from '@app/infrastructure/providers'
import { CommonSceneKeyboards, PersonalTrainingRegisterSceneKeyboards } from '@app/bot/keyboard/storage/scene-keyboards'
import { AuditLogActions, AuditLogTrigger, DATE_FORMAT, PassTemplateTypeEnum } from '@app/libs'
import { StaffMemberSelectModel, UserProfileSelectModel } from '@app/infrastructure/database'
import { PassService } from '@app/domain/pass'
import { UserProfileService } from '@app/domain/user-profile'
import { PersonalTrainingSignupService } from '@app/domain/personal-training-signup'
import { CalendarPicker, TimePicker } from '@app/bot/menus'
import { AuditLogHelper } from '@app/bot/helpers/audit-log.helper'

export interface IPersonalTrainingRegisterSceneState {
  clientUserProfile: UserProfileWithClient
  staffMember: StaffMemberSelectModel & { userProfile: UserProfileSelectModel }
  scheduledDate: string
  scheduledAt: string
  pickerMessageId: number // the open inline step (trainer list, calendar, time picker): closed into a label on typed input, deleted on exit
}

/**
 * Admin-driven registration of an individual training.
 *
 * The client and trainer agree offline; the trainer reports the date and time to the admin, who
 * records it here. The date may be in the past or the future — the admin is transcribing an
 * agreement, not booking a slot, so no future-date guard applies.
 */
@Injectable()
export class PersonalTrainingRegisterScene extends Scenes.WizardScene<BotContext> {
  private readonly scene = new SceneHelper<IPersonalTrainingRegisterSceneState>()
  // "⬅️ Назад" in the pickers returns to the previous step (calendar → trainer list, hours → calendar)
  private readonly pickerBaseOptions = { withBackButton: true }
  private mainTainerChatId: string

  constructor(
    @DateTimeProviderInjector() private readonly dateTimeProvider: DateTimeProvider,
    private readonly configService: TypedConfigService,
    private readonly passService: PassService,
    private readonly userProfileService: UserProfileService,
    private readonly personalTrainingSignupService: PersonalTrainingSignupService,
  ) {
    super(
      SCENES.PERSONAL_TRAINING_REGISTER,
      (ctx) => this.enterSceneHandler(ctx),
      (ctx) => this.trainerSelectHandler(ctx),
      (ctx) => this.dateHandler(ctx),
      (ctx) => this.timeHandler(ctx),
      (ctx) => this.confirmHandler(ctx),
    )

    this.mainTainerChatId = this.configService.get('MAINTAINER_CHAT_ID')

    this.hears(BUTTON_PATTERNS.EXIT, async (ctx) => {
      const { role } = UserHelper.getUser(ctx)
      await this.deletePicker(ctx)
      await ctx.replyWithHTML(
        MESSAGES_SCENE.PERSONAL_TRAINING_REGISTER.EXIT,
        KeyboardHelper.getRoleBasedMainMenuKeyboard(role),
      )
      return ctx.scene.leave()
    })

    this.enter(async (ctx, next) => {
      try {
        const { clientUserProfile } = this.scene.getState(ctx, ['clientUserProfile'])
        const guardMessage = await this.resolveGuardFailure(clientUserProfile)

        if (guardMessage) {
          await ctx.replyWithHTML(guardMessage)
          return ctx.scene.leave()
        }

        return await next()
      } catch (error) {
        return this.scene.handleAdminSceneError(ctx, error, this.mainTainerChatId)
      }
    })
  }

  private enterSceneHandler = async (ctx: BotContext) => {
    try {
      const { clientUserProfile } = this.scene.getState(ctx, ['clientUserProfile'])
      // Carries the "🚪 Вийти" reply keyboard for the whole scene; the following steps use inline pickers
      await ctx.replyWithHTML(
        `${MESSAGES_SCENE.PERSONAL_TRAINING_REGISTER.START} ${TextHelper.bold(UserHelper.getDisplayName(clientUserProfile))}`,
        CommonSceneKeyboards.exit(),
      )

      if (!(await this.renderTrainerSelect(ctx, false))) {
        return ctx.scene.leave()
      }

      return ctx.wizard.next()
    } catch (error) {
      return this.scene.handleAdminSceneError(ctx, error, this.mainTainerChatId)
    }
  }

  /** Sends the trainer list, or (going back from the calendar) edits the current message into it. False when there are no trainers. */
  private async renderTrainerSelect(ctx: BotContext, shouldEdit: boolean): Promise<boolean> {
    const trainers = await this.userProfileService.getAllActiveStaffMembersUserProfiles()

    if (!trainers.length) {
      await ctx.replyWithHTML(MESSAGES_SCENE.PERSONAL_TRAINING_REGISTER.NO_TRAINERS)
      return false
    }

    const keyboard = PersonalTrainingRegisterSceneKeyboards.trainerSelectInlineKeyboard(trainers)

    if (shouldEdit) {
      await BotHelper.safeEditMessageText(ctx, MESSAGES_SCENE.PERSONAL_TRAINING_REGISTER.SELECT_TRAINER, keyboard)
    } else {
      await this.replyWithPicker(ctx, MESSAGES_SCENE.PERSONAL_TRAINING_REGISTER.SELECT_TRAINER, keyboard)
    }
    return true
  }

  /** Calendar marking the trainer's busy days; built per update because it depends on this user's scene state. */
  private getCalendarOptions(ctx: BotContext) {
    const { staffMember } = this.scene.getState(ctx)
    return StaffAvailabilityHelper.calendarOptions(this.loadBusyIntervals(staffMember.id), this.dateTimeProvider, this.pickerBaseOptions)
  }

  /** Time picker disabling the trainer's busy slots on the picked date. */
  private getTimeOptions(ctx: BotContext) {
    const { staffMember, scheduledDate } = this.scene.getState(ctx)
    return StaffAvailabilityHelper.timeOptions(
      this.loadBusyIntervals(staffMember.id),
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

  /** "Вийти": the open inline step (trainer list, calendar, time) would stay with dead buttons, so it goes away. */
  private async deletePicker(ctx: BotContext) {
    const { pickerMessageId } = this.scene.getState(ctx)
    if (pickerMessageId && ctx.chat) {
      await ctx.telegram.deleteMessage(ctx.chat.id, pickerMessageId).catch(() => {})
    }
  }

  /** Typed date/time: the open picker turns into its "📅 Дата: …" / "⏰ Час: …" line (no keyboard). */
  private async closePicker(ctx: BotContext, label: string) {
    const { pickerMessageId } = this.scene.getState(ctx)
    await BotHelper.safeEditMessageTextById(ctx, ctx.chat?.id, pickerMessageId, label)
  }

  /** Studio-local today in DATE_FORMAT.DATE_MAIN, as CalendarPicker expects. */
  private getToday() {
    return this.dateTimeProvider.getTodayDateStringInTz(DATE_FORMAT.DATE_MAIN)
  }

  /** Returns a message when the client cannot receive an individual training, or null when they can. */
  private async resolveGuardFailure(clientUserProfile: UserProfileWithClient): Promise<string | null> {
    const activePass = await this.passService.findActivePassByClientId(clientUserProfile?.client?.id)

    if (!activePass) {
      return MESSAGES_SCENE.PERSONAL_TRAINING_REGISTER.NO_ACTIVE_PASS
    }
    if (activePass.passTemplate.type !== PassTemplateTypeEnum.INDIVIDUAL) {
      return MESSAGES_SCENE.PERSONAL_TRAINING_REGISTER.WRONG_PASS_TYPE
    }
    if (activePass.availableSlots <= 0) {
      return MESSAGES_SCENE.PERSONAL_TRAINING_REGISTER.NO_SLOTS
    }
    return null
  }

  private trainerSelectHandler = async (ctx: BotContext) => {
    try {
      const { textPayload, isCallbackQueryUpdate } = BotHelper.getUpdatePayload(ctx)

      if (!isCallbackQueryUpdate) {
        return
      }

      const trainerSelectMatch = RegexHelper.getMatchValue(CALLBACK_PREFIX.SCENES.PERSONAL_TRAINING.TRAINER_SELECT, textPayload)

      if (!trainerSelectMatch) {
        return
      }

      const [staffMemberId] = trainerSelectMatch
      BotHelper.safeAnswerCbQuery(ctx)

      const trainers = await this.userProfileService.getAllActiveStaffMembersUserProfiles()
      const selectedTrainer = trainers.find((trainer) => trainer.staffMember?.id === staffMemberId)

      if (!selectedTrainer?.staffMember) {
        await ctx.replyWithHTML(MESSAGES_SCENE.PERSONAL_TRAINING_REGISTER.NO_TRAINERS)
        return ctx.scene.leave()
      }

      this.scene.setState(ctx, {
        staffMember: { ...selectedTrainer.staffMember, userProfile: selectedTrainer },
      })

      await BotHelper.safeEditMessageText(
        ctx,
        `${MESSAGES_SCENE.PERSONAL_TRAINING_REGISTER.TRAINER_LABEL} ${TextHelper.bold(UserHelper.getDisplayName(selectedTrainer))}`,
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
          // The calendar message turns back into the trainer list
          if (!(await this.renderTrainerSelect(ctx, true))) {
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

      const { scheduledDate, clientUserProfile, staffMember } = this.scene.getState(ctx)

      // Studio-local wall clock -> UTC instant. getUtcString() would treat it as already-UTC and shift it.
      const parsedDate = parse(scheduledDate, DATE_FORMAT.DATE_INPUT, new Date())
      const scheduledAt = this.dateTimeProvider.getUtcStringTz(this.dateTimeProvider.addTimeToDate(parsedDate, validatedTime))

      this.scene.setState(ctx, { scheduledAt })

      const conflictWarning = await StaffAvailabilityHelper.getConflictWarning(
        this.loadBusyIntervals(staffMember.id),
        scheduledAt,
        this.dateTimeProvider,
      )
      const confirmMessage =
        PersonalTrainingHelper.getRegisterConfirmMessage(
          UserHelper.getDisplayName(clientUserProfile),
          UserHelper.getDisplayName(staffMember.userProfile),
          scheduledAt,
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
        // Restore the exit-only reply keyboard, then show the time picker again
        await ctx.replyWithHTML(MESSAGES_SCENE.PERSONAL_TRAINING_REGISTER.BACK_TO_TIME, CommonSceneKeyboards.exit())
        await this.replyWithPicker(ctx, MESSAGES_SCENE.PERSONAL_TRAINING_REGISTER.ENTER_TIME, await TimePicker.keyboard(this.getTimeOptions(ctx)))
        return ctx.wizard.back()
      }

      if (textPayload !== BUTTON_PATTERNS.CONFIRM) {
        return
      }

      const { clientUserProfile, staffMember, scheduledAt } = this.scene.getState(ctx)

      const [created, logOperations] = await this.personalTrainingSignupService.registerTraining({
        clientId: clientUserProfile.client.id,
        staffMemberId: staffMember.id,
        scheduledAt,
      })

      AuditLogHelper.startAction(ctx, AuditLogActions.PERSONAL_TRAINING_REGISTER, AuditLogTrigger.ADMIN_ACTION, logOperations)

      const updatedPass = created.passId ? await this.passService.getPassById(created.passId) : null
      const remainingSlots = updatedPass?.availableSlots ?? 0

      await BotHelper.safeSendMessage(
        ctx.telegram,
        clientUserProfile.telegramId,
        PersonalTrainingHelper.getClientRegisteredMessage(
          UserHelper.getDisplayName(staffMember.userProfile),
          scheduledAt,
          remainingSlots,
          this.dateTimeProvider,
        ),
      )
      await BotHelper.safeSendMessage(
        ctx.telegram,
        staffMember.userProfile.telegramId,
        PersonalTrainingHelper.getTrainerRegisteredMessage(
          { ...created, client: { userProfile: clientUserProfile }, pass: updatedPass },
          this.dateTimeProvider,
        ),
      )

      const { role } = UserHelper.getUser(ctx)
      await ctx.replyWithHTML(
        MESSAGES_SCENE.PERSONAL_TRAINING_REGISTER.REGISTER_SUCCESS,
        KeyboardHelper.getRoleBasedMainMenuKeyboard(role),
      )

      return ctx.scene.leave()
    } catch (error) {
      return this.scene.handleAdminSceneError(ctx, error, this.mainTainerChatId)
    }
  }
}
