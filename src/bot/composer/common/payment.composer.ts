import { BotContext } from '@app/bot/bot.context'
import { MESSAGES_COMMON } from '@app/bot/static/messages'
import { BUTTON_PATTERNS } from '@app/bot/static/button-patterns'
import { Injectable } from '@nestjs/common'
import { Composer } from 'telegraf'

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
    await ctx.reply(MESSAGES_COMMON.PAYMENT, {parse_mode: 'MarkdownV2'})
  }
}
