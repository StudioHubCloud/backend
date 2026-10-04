import { BotContext } from '@app/bot/bot.context'
import { BUTTON_PATTERNS } from '@app/bot/static/button-patterns'
import { Injectable } from '@nestjs/common'
import { Composer } from 'telegraf'
import { AuditLogHelper, BotHelper, KeyboardHelper, PassHelper, RegexHelper, TextHelper, UserHelper } from '@app/bot/helpers'
import { MessageHelper } from '@app/bot/helpers/message.helper'
import { DateTimeProvider, DateTimeProviderInjector } from '@app/infrastructure/providers'
import { AdminKeyboards, TrainerKeyboards } from '@app/bot/keyboard/storage'
import { COMMON_BUTTONS } from '@app/bot/keyboard/storage/common-keyboards'
import { CALLBACK_PREFIX, TReplyInlineKeyboard } from '@app/bot/libs'
import { StaffMemberPayoutService } from '@app/domain/staff-member-payout'
import { PENDING_PAYOUT_EXISTS_MESSAGE } from '@app/domain/staff-member-payout/staff-member-payout.service'
import { StaffMemberPayoutSelectModel } from '@app/infrastructure/database'
import { AuditLogActions, AuditLogTrigger, DATE_FORMAT, StaffMemberPayoutStatusEnum, TPayoutStatistics, TSalaryPayoutResult } from '@app/libs'
import { UserProfileService } from '@app/domain/user-profile'
import { format, parseISO, startOfMonth, subDays } from 'date-fns'
import { IInitiatePayoutSceneState, InitiatePayoutSceneHelper } from '@app/bot/stage/scenes/initiate-payout/initiate-payout.scene-helper'

const ADMIN_ONLY_MESSAGE = '⛔️ Доступно лише адміністратору'

@Injectable()
export class PayoutStaffComposer {
  private readonly composer: Composer<BotContext>
  constructor(
    private readonly staffMemberPayoutService: StaffMemberPayoutService,
    private readonly userProfileService: UserProfileService,
    @DateTimeProviderInjector() private readonly dateTimeProvider: DateTimeProvider,
  ) {
    this.composer = new Composer<BotContext>()
    this.initComposerHandlers()
  }

  middleware() {
    return this.composer.middleware()
  }

  initComposerHandlers() {
    this.composer.hears(BUTTON_PATTERNS.PAYOUT_CALCULATIONS, async (ctx) => {
      const user = UserHelper.getUser(ctx)
      const isAdmin = UserHelper.isAdminRole(ctx)

      if (isAdmin) {
      } else {
        return this.renderStaffMemberPayoutSummaryMenu(ctx, user.id, isAdmin, false)
      }
    })

    this.composer.action(RegexHelper.createButtonActionRegex(CALLBACK_PREFIX.STAFF.PAYOUT.SUMMARY), async (ctx: BotContext) => {
      return this.handlePaymentAction(ctx, async (userId, isAdmin) => {
        return this.renderStaffMemberPayoutSummaryMenu(ctx, userId, isAdmin)
      })
    })

    this.composer.action(RegexHelper.createButtonActionRegex(CALLBACK_PREFIX.STAFF.PAYOUT.DETAILS), async (ctx: BotContext) => {
      return this.handlePaymentAction(ctx, async (userId, isAdmin) => {
        return this.renderStaffMemberPayoutDetailsMenu(ctx, userId, isAdmin)
      })
    })

    this.composer.action(RegexHelper.createButtonActionRegex(CALLBACK_PREFIX.STAFF.PAYOUT.DETAILS_BACK), async (ctx: BotContext) => {
      return this.handlePaymentAction(ctx, async (userId, isAdmin) => {
        return this.renderStaffMemberPayoutDetailsMenu(ctx, userId, isAdmin)
      })
    })

    this.composer.action(RegexHelper.createButtonActionRegex(CALLBACK_PREFIX.STAFF.PAYOUT.CLIENT_INFO), async (ctx: BotContext) => {
      return this.handlePaymentAction(ctx, async (userId, isAdmin) => {
        return this.renderStaffMemberPayoutClientInfoMenu(ctx, userId, isAdmin)
      })
    })

    this.composer.action(RegexHelper.createButtonActionRegex(CALLBACK_PREFIX.STAFF.PAYOUT.INITIATE), async (ctx: BotContext) => {
      return this.handlePaymentAction(ctx, async (userId, isAdmin) => {
        if (!isAdmin) {
          return BotHelper.safeAnswerCbQuery(ctx, ADMIN_ONLY_MESSAGE, { show_alert: true })
        }
        if (await this.staffMemberPayoutService.findPendingPayoutByUserProfileId(userId)) {
          return BotHelper.safeAnswerCbQuery(ctx, PENDING_PAYOUT_EXISTS_MESSAGE, { show_alert: true })
        }
        return this.renderManualPayoutDates(ctx, userId)
      })
    })

    this.composer.action(RegexHelper.createButtonActionRegex(CALLBACK_PREFIX.STAFF.PAYOUT.MANUAL_DATE), async (ctx: BotContext) => {
      return this.handleManualPayoutAction(ctx, (userId, payoutDate) => this.renderManualPayoutConfirm(ctx, userId, payoutDate))
    })

    this.composer.action(RegexHelper.createButtonActionRegex(CALLBACK_PREFIX.STAFF.PAYOUT.MANUAL_PAY), async (ctx: BotContext) => {
      return this.handleManualPayoutAction(ctx, (userId, payoutDate) => this.registerManualPayout(ctx, userId, payoutDate))
    })

    // Payouts prepared by the monthly cron: the list, then pay or cancel each one (admins only)
    this.composer.action(RegexHelper.createButtonActionRegex(CALLBACK_PREFIX.STAFF.PAYOUT.PENDING_LIST), async (ctx: BotContext) => {
      if (!UserHelper.isAdminRole(ctx)) {
        return BotHelper.safeAnswerCbQuery(ctx, ADMIN_ONLY_MESSAGE, { show_alert: true })
      }
      BotHelper.safeAnswerCbQuery(ctx)
      return this.renderPendingPayoutsList(ctx)
    })

    this.composer.action(RegexHelper.createButtonActionRegex(CALLBACK_PREFIX.STAFF.PAYOUT.APPROVE), async (ctx: BotContext) => {
      return this.handlePendingPayoutAction(ctx, 'approve')
    })

    this.composer.action(RegexHelper.createButtonActionRegex(CALLBACK_PREFIX.STAFF.PAYOUT.CANCEL_PENDING), async (ctx: BotContext) => {
      return this.handlePendingPayoutAction(ctx, 'cancel')
    })
  }

  /**
   * Manual payout, step 1: the end of the period. Today (e.g. before a trainer's vacation) or the end of the previous
   * month (e.g. after cancelling a prepared payout); only dates after the last payout, which a new one must follow.
   */
  private async renderManualPayoutDates(ctx: BotContext, userId: string) {
    const today = this.dateTimeProvider.getTodayDateStringInTz(DATE_FORMAT.DATE_MAIN)
    const endOfLastMonth = format(subDays(startOfMonth(parseISO(today)), 1), DATE_FORMAT.DATE_MAIN)
    const lastPayoutDate = (await this.staffMemberPayoutService.getLastPayoutDateByUserProfileId(userId))?.slice(0, 10)

    const dates = [
      { label: `Сьогодні · ${format(parseISO(today), 'dd.MM')}`, isoDate: today },
      { label: `Кінець минулого місяця · ${format(parseISO(endOfLastMonth), 'dd.MM')}`, isoDate: endOfLastMonth },
    ]
      .filter(({ isoDate }) => !lastPayoutDate || isoDate > lastPayoutDate)
      .map(({ label, isoDate }) => ({ label, date: format(parseISO(isoDate), DATE_FORMAT.DATE_INPUT) }))

    if (!dates.length) {
      return BotHelper.safeAnswerCbQuery(
        ctx,
        `ℹ️ Остання виплата вже покриває ці дати (до ${this.formatPayoutDate(lastPayoutDate ?? null)}). Нова має бути пізніше`,
        { show_alert: true },
      )
    }

    BotHelper.safeAnswerCbQuery(ctx)
    return BotHelper.safeEditMessageText(
      ctx,
      `💸 <b>Виплата зарплати</b>\n\nДо якої дати включно рахуємо період?`,
      AdminKeyboards.manualPayoutDatesMenu(userId, dates),
    )
  }

  /** Manual payout, step 2: the calculation for that date, like a prepared payout, with 💸 Оплатити. */
  private async renderManualPayoutConfirm(ctx: BotContext, userId: string, payoutDate: string) {
    const salary = await this.staffMemberPayoutService.calculateStaffPayoutSalary(userId, payoutDate)
    const header = `💸 <b>Виплата · період до ${payoutDate}</b>\n\n`
    const nothingToPay = salary.statistics.totalPayout > 0 ? '' : '\n\nℹ️ <i>Немає що виплачувати</i>'

    BotHelper.safeAnswerCbQuery(ctx)
    return BotHelper.safeEditMessageText(
      ctx,
      `${header}${MessageHelper.getStaffPayoutInfoMessage(salary.statistics)}${nothingToPay}`,
      AdminKeyboards.manualPayoutConfirmMenu(userId, payoutDate, salary.statistics.totalPayout),
    )
  }

  /**
   * Manual payout, step 3: recalculated at the tap (never pays a stale screen), registered as paid, the trainer is
   * notified. The service refuses a date not after the last payout or a trainer with a prepared payout.
   */
  private async registerManualPayout(ctx: BotContext, userId: string, payoutDate: string) {
    const [salary, staffUserProfile] = await Promise.all([
      this.staffMemberPayoutService.calculateStaffPayoutSalary(userId, payoutDate),
      this.userProfileService.getUserProfileById(userId),
    ])

    if (!staffUserProfile || salary.statistics.totalPayout <= 0) {
      return BotHelper.safeAnswerCbQuery(ctx, 'ℹ️ Немає що виплачувати', { show_alert: true })
    }

    const payoutState: IInitiatePayoutSceneState = {
      staffUserProfile,
      staffUserId: userId,
      payoutDate,
      payoutAmount: salary.statistics.totalPayout,
      trainingIds: salary.trainingIds,
      personalTrainingIds: salary.personalTrainingIds,
      payoutStatistics: salary.statistics,
    }

    try {
      await this.staffMemberPayoutService.initiateStaffPayout({
        staffUserId: userId,
        amount: String(salary.statistics.totalPayout),
        paidAt: payoutDate,
        description: InitiatePayoutSceneHelper.getPayoutDescriptionMessage(payoutState),
        trainingIds: salary.trainingIds,
        personalTrainingIds: salary.personalTrainingIds,
      })
    } catch (error) {
      return BotHelper.safeAnswerCbQuery(ctx, `❌ ${error instanceof Error ? error.message : 'Не вдалося зареєструвати виплату'}`, {
        show_alert: true,
      })
    }

    await BotHelper.safeSendMessage(ctx.telegram, staffUserProfile.telegramId, InitiatePayoutSceneHelper.getStaffInfoMessage(payoutState))
    BotHelper.safeAnswerCbQuery(ctx, '💸 Зарплату виплачено')
    return BotHelper.safeEditMessageText(
      ctx,
      InitiatePayoutSceneHelper.getPayoutDoneMessage(payoutState),
      KeyboardHelper.createInlineKeyboard([[COMMON_BUTTONS.CLOSE]]),
    )
  }

  /** Admin-only manual payout callback: staff user id + period end (dd.MM.yyyy); refused while a prepared payout waits. */
  private async handleManualPayoutAction(ctx: BotContext, action: (userId: string, payoutDate: string) => Promise<any>) {
    if (!UserHelper.isAdminRole(ctx)) {
      return BotHelper.safeAnswerCbQuery(ctx, ADMIN_ONLY_MESSAGE, { show_alert: true })
    }
    const [userId, payoutDate] = RegexHelper.getMatchGroupValue(ctx)
    if (!userId || !RegexHelper.isValidUuid(userId) || !payoutDate || !TextHelper.validateDateInput(payoutDate)) {
      return BotHelper.safeAnswerCbQuery(ctx, '❗️ Помилка. Невірні дані кнопки.', { show_alert: true })
    }
    if (await this.staffMemberPayoutService.findPendingPayoutByUserProfileId(userId)) {
      return BotHelper.safeAnswerCbQuery(ctx, PENDING_PAYOUT_EXISTS_MESSAGE, { show_alert: true })
    }
    return action(userId, payoutDate)
  }

  /**
   * Pays (the trainer is notified) or cancels (the sessions unlock, the admin pays manually later) a payout the
   * monthly cron prepared, then shows what is left. A stale button or a second admin gets "already handled".
   */
  private async handlePendingPayoutAction(ctx: BotContext, action: 'approve' | 'cancel') {
    if (!UserHelper.isAdminRole(ctx)) {
      return BotHelper.safeAnswerCbQuery(ctx, ADMIN_ONLY_MESSAGE, { show_alert: true })
    }

    const [payoutId] = RegexHelper.getMatchGroupValue(ctx)
    const payout = payoutId && RegexHelper.isValidUuid(payoutId) ? await this.staffMemberPayoutService.findPayoutById(payoutId) : null
    const result =
      payout?.status === StaffMemberPayoutStatusEnum.PENDING
        ? action === 'approve'
          ? await this.staffMemberPayoutService.approvePendingPayout(payout.id)
          : await this.staffMemberPayoutService.cancelPendingPayout(payout.id)
        : null

    if (!payout || !result) {
      BotHelper.safeAnswerCbQuery(ctx, 'ℹ️ Цю виплату вже оброблено', { show_alert: true })
      return this.renderPendingPayoutsList(ctx)
    }

    const [, logOperations] = result
    const staffUserProfile = payout.staffMember?.userProfile
    const name = UserHelper.getDisplayName(staffUserProfile ?? null)
    const amount = Number(payout.amount)

    if (action === 'approve') {
      AuditLogHelper.startAction(ctx, AuditLogActions.STAFF_PAYOUT_APPROVE, AuditLogTrigger.ADMIN_ACTION, logOperations)
      if (staffUserProfile) {
        const payoutState: IInitiatePayoutSceneState = {
          staffUserProfile,
          staffUserId: staffUserProfile.id,
          payoutDate: this.formatPayoutDate(payout.paidAt),
          payoutAmount: amount,
          trainingIds: [],
          personalTrainingIds: [],
          payoutStatistics: payout.snapshot?.statistics as TPayoutStatistics,
        }
        await BotHelper.safeSendMessage(ctx.telegram, staffUserProfile.telegramId, InitiatePayoutSceneHelper.getStaffInfoMessage(payoutState))
      }
      BotHelper.safeAnswerCbQuery(ctx, `💸 Оплачено: ${name}`)
      return this.renderPendingPayoutsList(ctx, `✅ Оплачено: ${TextHelper.escapeHtml(name)} · ${PassHelper.toDisplayPrice(amount)}\n\n`)
    }

    AuditLogHelper.startAction(ctx, AuditLogActions.STAFF_PAYOUT_CANCEL, AuditLogTrigger.ADMIN_ACTION, logOperations)
    BotHelper.safeAnswerCbQuery(ctx, `❌ Відмінено: ${name}`)
    return this.renderPendingPayoutsList(
      ctx,
      `❌ Відмінено: ${TextHelper.escapeHtml(name)}. Заняття розблоковано, виплату можна зробити вручну: «${BUTTON_PATTERNS.STAFF}» → тренер → «${BUTTON_PATTERNS.PAYOUT_CALCULATIONS}»\n\n`,
    )
  }

  /** The prepared payouts still waiting, with `notice` (what was just done) on top. */
  private async renderPendingPayoutsList(ctx: BotContext, notice = '') {
    await this.deletePayoutTail(ctx)
    const payouts = await this.staffMemberPayoutService.findAllPendingPayouts()

    if (!payouts.length) {
      return BotHelper.safeEditMessageText(ctx, `${notice}✅ Усі підготовлені виплати оброблено`, KeyboardHelper.createInlineKeyboard([[COMMON_BUTTONS.CLOSE]]))
    }

    const items = payouts
      .filter((payout) => payout.staffMember?.userProfile)
      .map((payout) => ({
        staffUserId: payout.staffMember!.userProfile.id,
        name: UserHelper.getDisplayName(payout.staffMember!.userProfile),
        amount: Number(payout.amount),
      }))
    return BotHelper.safeEditMessageText(ctx, `${notice}${MessageHelper.getPendingPayoutsListMessage()}`, AdminKeyboards.pendingPayoutsList(items))
  }

  /** "31.10.2026" from a payout's paid_at ("2026-10-31 00:00:00"). */
  private formatPayoutDate(paidAt: string | null): string {
    const [year, month, day] = (paidAt ?? '').slice(0, 10).split('-')
    return day ? `${day}.${month}.${year}` : ''
  }

  /** The payout to show: the snapshot of a prepared (pending) payout if there is one, else a fresh calculation. */
  private async getPayoutResult(userId: string): Promise<{ result: TSalaryPayoutResult; pending?: StaffMemberPayoutSelectModel }> {
    const pending = await this.staffMemberPayoutService.findPendingPayoutByUserProfileId(userId)
    if (pending?.snapshot) {
      return { result: pending.snapshot, pending }
    }
    return { result: await this.staffMemberPayoutService.calculateStaffPayoutSalary(userId) }
  }

  private async renderStaffMemberPayoutSummaryMenu(ctx: BotContext, userId: string, isAdmin: boolean, isEdit: boolean = true) {
    await this.deletePayoutTail(ctx)
    const { result, pending } = await this.getPayoutResult(userId)

    const isEmpty = result.statistics.totalTrainings === 0 && result.statistics.personalTrainingCount === 0

    const pendingHeader = pending
      ? `⏳ <b>Підготовлена виплата</b> · ${this.formatPayoutDate(pending.paidAt)}\n<i>Дані зафіксовані, заняття заблоковані</i>\n\n`
      : ''
    const pendingFooter = pending && !isAdmin ? '\n\n⏳ <i>Очікує підтвердження адміністратором</i>' : ''
    const message = `${pendingHeader}${MessageHelper.getStaffPayoutInfoMessage(result.statistics)}${pendingFooter}`
    const keyboard = isAdmin
      ? pending
        ? AdminKeyboards.pendingPayoutSummaryMenu(pending.id, userId, Number(pending.amount))
        : AdminKeyboards.staffmemberPayoutSummaryMenu(userId, isEmpty)
      : TrainerKeyboards.staffmemberPayoutSummaryMenu(userId, isEmpty)
    const { isCallbackQueryUpdate } = BotHelper.getUpdatePayload(ctx)

    if (isCallbackQueryUpdate) {
      BotHelper.safeAnswerCbQuery(ctx)
    }

    if (isEdit) {
      return BotHelper.safeEditMessageText(ctx, message, keyboard)
    }
    return ctx.reply(message, { parse_mode: 'HTML', ...keyboard })
  }

  /**
   * Group and individual details in one message, edited in place, so going back and to another trainer leaves nothing
   * behind. Only a text over Telegram's 4096-char limit continues in new messages (see editWithLongText).
   */
  private async renderStaffMemberPayoutDetailsMenu(ctx: BotContext, userId: string, isAdmin: boolean) {
    const { result } = await this.getPayoutResult(userId)
    const text = [
      MessageHelper.getStaffPayoutDetailsMessage(result, this.dateTimeProvider),
      MessageHelper.getStaffPayoutPersonalDetailsMessage(result, this.dateTimeProvider),
    ]
      .filter(Boolean)
      .join('\n\n')

    if (!text) {
      BotHelper.safeAnswerCbQuery(ctx, '❓ Немає даних для відображення', { show_alert: true })
      BotHelper.safeDeleteMessage(ctx)
      return
    }

    const keyboard = isAdmin
      ? AdminKeyboards.staffmemberPayoutDetailsMenu(userId)
      : TrainerKeyboards.staffmemberPayoutDetailsMenu(userId)
    BotHelper.safeAnswerCbQuery(ctx)
    return this.editWithLongText(ctx, text, keyboard)
  }

  /**
   * The current message becomes the first part (with the keyboard); the other parts of a text over Telegram's limit
   * follow as new messages, remembered in the session so the next step of the payout menu deletes them.
   */
  private async editWithLongText(ctx: BotContext, text: string, keyboard: TReplyInlineKeyboard) {
    await this.deletePayoutTail(ctx)
    const [first, ...rest] = BotHelper.splitLongMessage(text)
    await BotHelper.safeEditMessageText(ctx, first, keyboard)

    if (!rest.length || !ctx.chat) {
      return
    }
    const sentIds: number[] = []
    for (const part of rest) {
      const sent = await BotHelper.safeSendMessage(ctx.telegram, ctx.chat.id, part)
      if (sent) {
        sentIds.push(sent.message_id)
      }
    }
    ctx.session ??= {}
    ctx.session.payoutTailMessageIds = sentIds
  }

  /** Deletes the continuation messages of the previous payout screen, if any (see editWithLongText). */
  private async deletePayoutTail(ctx: BotContext) {
    const ids = ctx.session?.payoutTailMessageIds
    if (!ids?.length || !ctx.chat) {
      return
    }
    const chatId = ctx.chat.id
    await Promise.all(ids.map((id) => ctx.telegram.deleteMessage(chatId, id).catch(() => {})))
    ctx.session.payoutTailMessageIds = []
  }


  private async renderStaffMemberPayoutClientInfoMenu(ctx: BotContext, userId: string, isAdmin: boolean) {
    const { result } = await this.getPayoutResult(userId)
    const message = MessageHelper.getStaffPayoutClientInfoMessage(result, this.dateTimeProvider)

    if (!message) {
      return BotHelper.safeAnswerCbQuery(ctx, '❓ Немає групових тренувань для відображення', { show_alert: true })
    }

    const keyboard = isAdmin
      ? AdminKeyboards.staffmemberPayoutClientInfoMenu(userId)
      : TrainerKeyboards.staffmemberPayoutClientInfoMenu(userId)
    BotHelper.safeAnswerCbQuery(ctx)
    return this.editWithLongText(ctx, message, keyboard)
  }

  /**
   * The role comes from the session, never from the callback data (its ":true" only picks the admin keyboard layout):
   * a trainer may only look at their own payout, whatever the button says.
   */
  private async handlePaymentAction(ctx: BotContext, action: (userId: string, isAdmin: boolean) => Promise<any>) {
    const [userId] = RegexHelper.getMatchGroupValue(ctx)

    if (!userId) {
      BotHelper.safeAnswerCbQuery(ctx, '❓ Відсутня інформація про користувача', { show_alert: true })
      BotHelper.safeDeleteMessage(ctx)
      return
    }

    const isAdmin = UserHelper.isAdminRole(ctx)

    if (!isAdmin && userId !== UserHelper.getUser(ctx).id) {
      return BotHelper.safeAnswerCbQuery(ctx, '⛔️ Можна переглядати лише власні нарахування', { show_alert: true })
    }

    return action(userId, isAdmin)
  }
}
