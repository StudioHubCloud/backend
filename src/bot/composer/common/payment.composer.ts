import { BotContext } from '@app/bot/bot.context'
import { MESSAGES_COMMON } from '@app/bot/static/messages'
import { BUTTON_PATTERNS } from '@app/bot/static/button-patterns'
import { Injectable } from '@nestjs/common'
import { Composer } from 'telegraf'
import { UserHelper } from '@app/bot/helpers'

@Injectable()
export class PaymentComposer {
  private readonly composer: Composer<BotContext>
  constructor() {
    this.composer = new Composer<BotContext>()
    this.initComposerHandlers()
  }

  middleware() {
    return this.composer.middleware()
  }

  initComposerHandlers() {
    this.composer.hears(BUTTON_PATTERNS.PAYMENT, this.paymentHandler)
  }

  private paymentHandler = async (ctx: BotContext) => {
    const isGuestRole = UserHelper.isGuestRole(ctx)
    await ctx.reply(isGuestRole ? MESSAGES_COMMON.PAYMENT_GUEST : MESSAGES_COMMON.PAYMENT, {parse_mode: 'MarkdownV2'})
  }
}
