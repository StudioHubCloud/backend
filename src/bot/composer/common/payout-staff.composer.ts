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
        return this.renderStaffMemberPayoutDetailsMenu(ctx, userId, isAdmin)
      })
    })

    this.composer.action(RegexHelper.createButtonActionRegex(CALLBACK_PREFIX.STAFF.PAYOUT.CLIENT_INFO), async (ctx: BotContext) => {
      return this.handlePaymentAction(ctx, async (userId, isAdmin) => {
        return this.renderStaffMemberPayoutClientInfoMenu(ctx, userId, isAdmin)
      })
    })

    this.composer.action(RegexHelper.createButtonActionRegex(CALLBACK_PREFIX.STAFF.PAYOUT.INITIATE), async (ctx: BotContext) => {
      return this.handlePaymentAction(ctx, async (userId) => {
        ctx.scene.enter(SCENES.INITIATE_PAYOUT, { staffUserId: userId })
        return
      })
    })
  }

  private async renderStaffMemberPayoutSummaryMenu(ctx: BotContext, userId: string, isAdmin: boolean, isEdit: boolean = true) {
    const result = await this.staffMemberPayoutService.calculateStaffPayoutSalary(userId)

    const isEmpty = result.statistics.totalTrainings === 0

    const message = MessageHelper.getStaffPayoutInfoMessage(result.statistics)
    const keyboard = isAdmin
      ? AdminKeyboards.staffmemberPayoutSummaryMenu(userId, isEmpty)
      : TrainerKeyboards.staffmemberPayoutSummaryMenu(userId, isEmpty)
    const { isCallbackQueryUpdate } = BotHelper.getUpdatePayload(ctx)

    if (isCallbackQueryUpdate) {
      BotHelper.safeAnswerCbQuery(ctx)
    }

    if (isEdit) {
      return ctx.editMessageText(message, { parse_mode: 'HTML', ...keyboard })
    }
    return ctx.reply(message, { parse_mode: 'HTML', ...keyboard })
  }

  private async renderStaffMemberPayoutDetailsMenu(ctx: BotContext, userId: string, isAdmin: boolean) {
    const result = await this.staffMemberPayoutService.calculateStaffPayoutSalary(userId)
    const message = MessageHelper.getStaffPayoutDetailsMessage(result, this.dateTimeProvider)

    if (!message) {
      BotHelper.safeAnswerCbQuery(ctx, '❓ Немає даних для відображення', { show_alert: true })
      ctx.deleteMessage()
      return
    }

    const keyboard = isAdmin
      ? AdminKeyboards.staffmemberPayoutDetailsMenu(userId)
      : TrainerKeyboards.staffmemberPayoutDetailsMenu(userId)
    BotHelper.safeAnswerCbQuery(ctx)
    return ctx.editMessageText(message, { parse_mode: 'HTML', ...keyboard })
  }

  private async renderStaffMemberPayoutClientInfoMenu(ctx: BotContext, userId: string, isAdmin: boolean) {
    const result = await this.staffMemberPayoutService.calculateStaffPayoutSalary(userId)
    const message = MessageHelper.getStaffPayoutClientInfoMessage(result, this.dateTimeProvider)
    const keyboard = isAdmin
      ? AdminKeyboards.staffmemberPayoutClientInfoMenu(userId)
      : TrainerKeyboards.staffmemberPayoutClientInfoMenu(userId)
    BotHelper.safeAnswerCbQuery(ctx)
    return ctx.editMessageText(message, { parse_mode: 'HTML', ...keyboard })
  }

  private async handlePaymentAction(ctx: BotContext, action: (userId: string, isAdmin: boolean) => Promise<any>) {
    const [userId, isAdmin] = RegexHelper.getMatchGroupValue(ctx)

    if (!userId) {
      BotHelper.safeAnswerCbQuery(ctx, '❓ Відсутня інформація про користувача', { show_alert: true })
      ctx.deleteMessage()
      return
    }
    return action(userId, !!isAdmin)
  }
}
