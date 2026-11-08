import { Scenes } from 'telegraf'
import { Injectable } from '@nestjs/common'
import { addDays, format, parseISO } from 'date-fns'
import { BotContext } from '@app/bot/bot.context'
import { AuditLogActions, AuditLogTrigger, DATE_FORMAT } from '@app/libs'
import { SCENES } from '@app/bot/libs'
import { AuditLogHelper } from '@app/bot/helpers/audit-log.helper'
import { BotHelper, KeyboardHelper, PassHelper, SceneHelper, TextHelper, UserHelper } from '@app/bot/helpers'
import { CalendarPicker, TCalendarPickerOptions } from '@app/bot/menus'
import { MESSAGES_COMMON, MESSAGES_SCENE } from '@app/bot/static/messages'
import { BUTTON_PATTERNS } from '@app/bot/static/button-patterns'
import { CommonSceneKeyboards } from '@app/bot/keyboard/storage'
import { PassSelectionHelper, PassService } from '@app/domain/pass'
import { TrainingSignupService } from '@app/domain/training-signup'
import { UserProfileService } from '@app/domain/user-profile'
import { DateTimeProvider, DateTimeProviderInjector } from '@app/infrastructure/providers'

export interface IPassFreezeSceneState {
  passId: string
  clientUserId: string
  /** yyyy-MM-dd */
  frozenFrom?: string
  frozenDays?: number
  /** The open calendar, removed on leaving the step (no dead buttons) */
  pickerMessageId?: number | null
}

const STEP = {
  ENTER: 0,
  DATE: 1,
  DAYS: 2,
  CONFIRM: 3,
} as const
type TStep = (typeof STEP)[keyof typeof STEP]

type TFreezablePass = NonNullable<Awaited<ReturnType<PassService['findStudioPassById']>>>

/**
 * "🧊 Заморозити абонемент" on the admin's pass card: first day → number of days → confirmation listing the signups that
 * will be cancelled. One freeze per validity period, up to the template's limit.
 */
@Injectable()
export class PassFreezeScene extends Scenes.WizardScene<BotContext> {
  private readonly scene = new SceneHelper<IPassFreezeSceneState>()

  constructor(
    private readonly passService: PassService,
    private readonly trainingSignupService: TrainingSignupService,
    private readonly userProfileService: UserProfileService,
    @DateTimeProviderInjector() private readonly dateTimeProvider: DateTimeProvider,
  ) {
    super(
      SCENES.PASS_FREEZE,
      (ctx) => this.startHandler(ctx),
      (ctx) => this.dateHandler(ctx),
      (ctx) => this.daysHandler(ctx),
      (ctx) => this.confirmHandler(ctx),
    )

    this.hears(BUTTON_PATTERNS.EXIT, async (ctx) => {
      await this.deletePicker(ctx)
      await ctx.replyWithHTML(MESSAGES_SCENE.EDIT_ENTITIES.EXIT, KeyboardHelper.getMainMenuKeyboard(ctx))
      await this.renderPassCard(ctx)
      return ctx.scene.leave()
    })
  }

  private startHandler = async (ctx: BotContext) => {
    const pass = await this.getFreezablePass(ctx)
    return pass ? this.goTo(ctx, STEP.DATE, pass) : this.abort(ctx)
  }

  private dateHandler = async (ctx: BotContext) => {
    const pass = await this.getFreezablePass(ctx)
    if (!pass) {
      return this.abort(ctx)
    }

    const { textPayload, isCallbackQueryUpdate } = BotHelper.getUpdatePayload(ctx)
    const picked = await CalendarPicker.handle(ctx, this.getToday(), this.getPickerOptions(pass))
    if (picked?.type === 'navigated') {
      return
    }
    if (!picked && isCallbackQueryUpdate) {
      return BotHelper.safeAnswerCbQuery(ctx)
    }

    const dateInput = TextHelper.validateDateInput(picked?.type === 'selected' ? picked.date : textPayload)
    if (!dateInput) {
      return ctx.replyWithHTML(MESSAGES_COMMON.DATE_ERROR)
    }

    const frozenFrom = this.dateTimeProvider.parseAndFormatDate({
      date: dateInput,
      outputDateFormat: DATE_FORMAT.DATE_MAIN,
      inputDateFormat: DATE_FORMAT.DATE_INPUT,
    })
    if (!this.isInRange(frozenFrom, pass)) {
      return ctx.replyWithHTML(MESSAGES_SCENE.PASS_FREEZE.DATE_OUT_OF_RANGE)
    }

    await this.closePicker(ctx, `${MESSAGES_SCENE.PASS_FREEZE.DATE_PICKER} ${TextHelper.bold(dateInput)}`)
    this.scene.setState(ctx, { frozenFrom })
    return this.goTo(ctx, STEP.DAYS, pass)
  }

  private daysHandler = async (ctx: BotContext) => {
    const pass = await this.getFreezablePass(ctx)
    if (!pass) {
      return this.abort(ctx)
    }

    const { textPayload } = BotHelper.getUpdatePayload(ctx)
    if (textPayload === BUTTON_PATTERNS.BACK) {
      return this.goTo(ctx, STEP.DATE, pass)
    }

    const maxDays = this.getMaxDays(pass)
    const frozenDays = /^\d+$/.test(textPayload?.trim() ?? '') ? Number(textPayload!.trim()) : NaN
    if (!(frozenDays >= 1 && frozenDays <= maxDays)) {
      return ctx.replyWithHTML(MESSAGES_SCENE.PASS_FREEZE.DAYS_ERROR(maxDays))
    }

    this.scene.setState(ctx, { frozenDays })
    return this.goTo(ctx, STEP.CONFIRM, pass)
  }

  private confirmHandler = async (ctx: BotContext) => {
    const { textPayload } = BotHelper.getUpdatePayload(ctx)
    if (textPayload === BUTTON_PATTERNS.BACK) {
      const pass = await this.getFreezablePass(ctx)
      return pass ? this.goTo(ctx, STEP.DAYS, pass) : this.abort(ctx)
    }
    if (textPayload !== BUTTON_PATTERNS.CONFIRM) {
      return
    }
    if (!UserHelper.isAdminRole(ctx)) {
      return this.abort(ctx, MESSAGES_SCENE.PASS_FREEZE.NOT_ALLOWED)
    }

    const { passId, clientUserId, frozenFrom, frozenDays } = this.scene.getState(ctx)
    const result = await this.trainingSignupService.freezePass(passId, frozenFrom!, frozenDays!)
    if (!result.data) {
      return this.abort(ctx, result.message)
    }

    const { pass, cancelledSignups, logOperations } = result.data
    AuditLogHelper.startAction(ctx, AuditLogActions.PASS_EDIT, AuditLogTrigger.ADMIN_ACTION, logOperations)

    const range = PassHelper.getFreezeRangeLabel(frozenFrom!, frozenDays!, this.dateTimeProvider)
    const endDate = this.dateTimeProvider.formatDateStringInTz(pass.endDate!, 'd MMMM')
    const signupLines = PassHelper.getFreezeSignupLines(cancelledSignups, this.dateTimeProvider)

    await ctx.replyWithHTML(MESSAGES_SCENE.PASS_FREEZE.DONE({ range, endDate, signupLines }), KeyboardHelper.getMainMenuKeyboard(ctx))

    const [clientProfile, freshPass] = await Promise.all([
      this.userProfileService.getUserProfileById(clientUserId),
      this.passService.findStudioPassById(passId),
    ])
    if (clientProfile && freshPass) {
      await BotHelper.notifyClient(ctx.telegram, this.userProfileService, clientProfile, {
        text: MESSAGES_SCENE.PASS_FREEZE.CLIENT_NOTICE({ passName: freshPass.passTemplate.name, range, endDate, signupLines }),
      })
    }

    await this.renderPassCard(ctx)
    return ctx.scene.leave()
  }

  /** Sends the step's prompt (and the calendar) and moves the wizard there. */
  private async goTo(ctx: BotContext, step: TStep, pass: TFreezablePass) {
    const M = MESSAGES_SCENE.PASS_FREEZE

    switch (step) {
      case STEP.DATE: {
        await ctx.replyWithHTML(M.DATE, CommonSceneKeyboards.exit())
        const picker = await ctx.replyWithHTML(M.DATE_PICKER, await CalendarPicker.keyboard(this.getToday(), this.getPickerOptions(pass)))
        this.scene.setState(ctx, { pickerMessageId: picker.message_id })
        break
      }
      case STEP.DAYS: {
        const maxDays = this.getMaxDays(pass)
        await ctx.replyWithHTML(M.DAYS(maxDays), CommonSceneKeyboards.dateWithSuggestion(String(maxDays)))
        break
      }
      case STEP.CONFIRM:
        await ctx.replyWithHTML(await this.getSummary(ctx, pass), CommonSceneKeyboards.backExitConfirm())
        break
    }
    return ctx.wizard.selectStep(step)
  }

  private async getSummary(ctx: BotContext, pass: TFreezablePass) {
    const { passId, clientUserId, frozenFrom, frozenDays } = this.scene.getState(ctx)
    const [clientProfile, signups] = await Promise.all([
      this.userProfileService.getUserProfileById(clientUserId),
      this.trainingSignupService.getSignupsOnFreezeDays(passId, frozenFrom!, frozenDays!),
    ])
    const newEndDate = format(addDays(parseISO(pass.endDate!), frozenDays!), DATE_FORMAT.DATE_MAIN)

    return MESSAGES_SCENE.PASS_FREEZE.CONFIRM({
      fullName: clientProfile ? UserHelper.getDisplayName(clientProfile) : '',
      passName: pass.passTemplate.name,
      range: PassHelper.getFreezeRangeLabel(frozenFrom!, frozenDays!, this.dateTimeProvider),
      days: `${frozenDays} ${TextHelper.pluralize(frozenDays!, ['день', 'дні', 'днів'])}`,
      endDate: this.dateTimeProvider.formatDateStringInTz(newEndDate, 'd MMMM'),
      signupLines: PassHelper.getFreezeSignupLines(signups, this.dateTimeProvider),
    })
  }

  /** Re-read on every step: the pass may have been frozen or expired while the scene was open. */
  private async getFreezablePass(ctx: BotContext): Promise<TFreezablePass | null> {
    if (!UserHelper.isAdminRole(ctx)) {
      return null
    }
    const pass = await this.passService.findStudioPassById(this.scene.getState(ctx).passId)
    return pass && PassSelectionHelper.getFreezeRefusal(pass, this.getToday()) === null ? pass : null
  }

  private async abort(ctx: BotContext, message: string = MESSAGES_SCENE.PASS_FREEZE.UNAVAILABLE) {
    await this.deletePicker(ctx)
    await ctx.replyWithHTML(message, KeyboardHelper.getMainMenuKeyboard(ctx))
    return ctx.scene.leave()
  }

  private getMaxDays(pass: TFreezablePass) {
    return pass.passTemplate.passTemplateFreezeRule!.maxDays
  }

  private isInRange(day: string, pass: TFreezablePass) {
    return day >= this.getToday() && day <= pass.endDate!
  }

  private getPickerOptions(pass: TFreezablePass): TCalendarPickerOptions {
    return {
      resolveDays: async (days) =>
        Object.fromEntries(
          days.map((day) => [
            day,
            this.isInRange(day, pass)
              ? { style: 'success' as const }
              : { disabled: true, reason: MESSAGES_SCENE.PASS_FREEZE.DATE_OUT_OF_RANGE },
          ]),
        ),
    }
  }

  private getToday() {
    return this.dateTimeProvider.getTodayDateStringInTz(DATE_FORMAT.DATE_MAIN)
  }

  private async renderPassCard(ctx: BotContext) {
    const { passId, clientUserId } = this.scene.getState(ctx)
    const [pass, clientProfile] = await Promise.all([
      this.passService.findStudioPassById(passId),
      this.userProfileService.getUserProfileById(clientUserId),
    ])
    if (!pass || !clientProfile) {
      return
    }

    const [trainingSignups, { passes: activePasses }] = await Promise.all([
      this.trainingSignupService.getTrainingSignupByPassId(pass.id),
      this.passService.findActivePassesByClientId(pass.clientId),
    ])

    return PassHelper.renderPassManageMenu(ctx, this.dateTimeProvider, {
      pass,
      fullName: UserHelper.getDisplayName(clientProfile),
      clientUserId,
      shouldEdit: false,
      trainingSignups,
      activePasses,
    })
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
