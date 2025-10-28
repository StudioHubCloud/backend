import { BotContext } from '@app/bot/bot.context'
import { MESSAGES_COMMON } from '@app/bot/static/messages'
import { BUTTON_PATTERNS } from '@app/bot/static/button-patterns'
import { Injectable } from '@nestjs/common'
import { Composer } from 'telegraf'
import { UserHelper } from '@app/bot/helpers'
import { SCENES } from '@app/bot/libs'
import { PassActivationRequestTypeEnum } from '@app/libs'

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
    this.composer.hears(BUTTON_PATTERNS.PAYMENT, this.paymentDataHandler)
    this.composer.hears(BUTTON_PATTERNS.CLIENT_PASS_BUY, this.passPurchaseActionHandler)
  }

  private paymentDataHandler = async (ctx: BotContext) => {
    const isGuestRole = UserHelper.isGuestRole(ctx)
    await ctx.reply(isGuestRole ? MESSAGES_COMMON.PAYMENT_GUEST : MESSAGES_COMMON.PAYMENT, { parse_mode: 'MarkdownV2' })
  }

  private passPurchaseActionHandler = async (ctx: BotContext) => {
    const [hasPass, userProfile] = UserHelper.hasPass(ctx)
    return ctx.scene.enter(SCENES.PASS_PAYMENT, { userProfile, requestType: hasPass ? PassActivationRequestTypeEnum.RENEW : PassActivationRequestTypeEnum.PURCHASE })
  }
}
