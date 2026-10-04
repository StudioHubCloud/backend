import { BotContext } from '@app/bot/bot.context'
import { BUTTON_PATTERNS } from '@app/bot/static/button-patterns'
import { Injectable } from '@nestjs/common'
import { Composer } from 'telegraf'
import { BotHelper, RegexHelper, UserHelper } from '@app/bot/helpers'
import { MessageHelper } from '@app/bot/helpers/message.helper'
import { DateTimeProvider, DateTimeProviderInjector } from '@app/infrastructure/providers'
import { AdminKeyboards, TrainerKeyboards } from '@app/bot/keyboard/storage'
import { CALLBACK_PREFIX, SCENES } from '@app/bot/libs'
import { StaffMemberPayoutService } from '@app/domain/staff-member-payout'

@Injectable()
export class PayoutStaffComposer {
  private readonly composer: Composer<BotContext>
  constructor(
    private readonly staffMemberPayoutService: StaffMemberPayoutService,
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
        return this.renderStaffMemberPayoutDetailsMenu(ctx, userId, isAdmin, true)
      })
    })

    this.composer.action(RegexHelper.createButtonActionRegex(CALLBACK_PREFIX.STAFF.PAYOUT.DETAILS_BACK), async (ctx: BotContext) => {
      return this.handlePaymentAction(ctx, async (userId, isAdmin) => {
        return this.renderStaffMemberPayoutDetailsMenu(ctx, userId, isAdmin, false)
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
          return BotHelper.safeAnswerCbQuery(ctx, '⛔️ Доступно лише адміністратору', { show_alert: true })
        }
        return ctx.scene.enter(SCENES.INITIATE_PAYOUT, { staffUserId: userId })
      })
    })
  }

  private async renderStaffMemberPayoutSummaryMenu(ctx: BotContext, userId: string, isAdmin: boolean, isEdit: boolean = true) {
    const result = await this.staffMemberPayoutService.calculateStaffPayoutSalary(userId)

    const isEmpty = result.statistics.totalTrainings === 0 && result.statistics.personalTrainingCount === 0

    const message = MessageHelper.getStaffPayoutInfoMessage(result.statistics)
    const keyboard = isAdmin
      ? AdminKeyboards.staffmemberPayoutSummaryMenu(userId, isEmpty)
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
   * Group details replace the current message; individual sessions go into a second message (Telegram 4096-char limit).
   * `withPersonal` is false when coming back from client info, so the second message isn't sent again.
   */
  private async renderStaffMemberPayoutDetailsMenu(ctx: BotContext, userId: string, isAdmin: boolean, withPersonal: boolean) {
    const result = await this.staffMemberPayoutService.calculateStaffPayoutSalary(userId)
    const groupMessage = MessageHelper.getStaffPayoutDetailsMessage(result, this.dateTimeProvider)
    const personalMessage = MessageHelper.getStaffPayoutPersonalDetailsMessage(result, this.dateTimeProvider)

    if (!groupMessage && !personalMessage) {
      BotHelper.safeAnswerCbQuery(ctx, '❓ Немає даних для відображення', { show_alert: true })
      BotHelper.safeDeleteMessage(ctx)
      return
    }

    const keyboard = isAdmin
      ? AdminKeyboards.staffmemberPayoutDetailsMenu(userId)
      : TrainerKeyboards.staffmemberPayoutDetailsMenu(userId)
    BotHelper.safeAnswerCbQuery(ctx)

    // Only individual sessions: show them in place of the group details
    if (!groupMessage) {
      return BotHelper.safeEditMessageText(ctx, personalMessage, keyboard)
    }

    await BotHelper.safeEditMessageText(ctx, groupMessage, keyboard)

    if (withPersonal && personalMessage && ctx.chat) {
      await BotHelper.safeSendMessage(ctx.telegram, ctx.chat.id, personalMessage)
    }
  }

  private async renderStaffMemberPayoutClientInfoMenu(ctx: BotContext, userId: string, isAdmin: boolean) {
    const result = await this.staffMemberPayoutService.calculateStaffPayoutSalary(userId)
    const message = MessageHelper.getStaffPayoutClientInfoMessage(result, this.dateTimeProvider)

    if (!message) {
      return BotHelper.safeAnswerCbQuery(ctx, '❓ Немає групових тренувань для відображення', { show_alert: true })
    }

    const keyboard = isAdmin
      ? AdminKeyboards.staffmemberPayoutClientInfoMenu(userId)
      : TrainerKeyboards.staffmemberPayoutClientInfoMenu(userId)
    BotHelper.safeAnswerCbQuery(ctx)
    return BotHelper.safeEditMessageText(ctx, message, keyboard)
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
