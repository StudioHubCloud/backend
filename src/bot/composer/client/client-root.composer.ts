import { Composer } from 'telegraf'
import { Injectable } from '@nestjs/common'
import { PinoLogger } from 'nestjs-pino'
import { BotContext } from '@app/bot/bot.context'
import { SchedulerComposer } from '../common/scheduler.composer'
import { PaymentComposer } from '../common/payment.composer'
import { PassInfoComposer } from './pass-info/pass-info.composer'
import { ChildrenComposer } from './children/children.composer'
import { KeyboardHelper, UserHelper } from '@app/bot/helpers'
import { ClientKeyboards } from '@app/bot/keyboard/storage'
import { RulesGuardComposer } from '../common/rules-guard.composer'
import { MessageHelper } from '@app/bot/helpers/message.helper'
import { BUTTON_PATTERNS } from '@app/bot/static/button-patterns'
import { MESSAGES_CLIENT } from '@app/bot/static/messages'

@Injectable()
export class ClientRootComposer {
  private readonly composer: Composer<BotContext>
  constructor(
    private readonly logger: PinoLogger,
    private readonly schedulerComposer: SchedulerComposer,
    private readonly passInfoComposer: PassInfoComposer,
    private readonly paymentComposer: PaymentComposer,
    private readonly rulesGuardComposer: RulesGuardComposer,
    private readonly childrenComposer: ChildrenComposer,
  ) {
    this.composer = new Composer<BotContext>()
    this.logger.setContext(ClientRootComposer.name)

    // «Мої діти» works before the rules consent: switching back to «Я» must never be blocked by a child's rules
    this.composer.use(this.childrenComposer.middleware())
    this.composer.use(this.rulesGuardComposer.middleware())

    this.initComposerHandlers()
    this.initExternalComposers()
  }

  private initComposerHandlers() {
    this.composer.start(this.startHandler)
    // «✨ Більше» sub-menu: payment details and rules (moved out of the main menu), register a child
    this.composer.hears(BUTTON_PATTERNS.MORE, (ctx) => ctx.replyWithHTML(MESSAGES_CLIENT.MORE, ClientKeyboards.more()))
    this.composer.hears(BUTTON_PATTERNS.BACK_TO_MAIN_MENU, (ctx) =>
      ctx.reply(MessageHelper.makeClientGreetingsMessage(UserHelper.getUser(ctx).firstName), KeyboardHelper.getMainMenuKeyboard(ctx)),
    )
  }

  private initExternalComposers() {
    this.composer.use(this.schedulerComposer.middleware())
    this.composer.use(this.passInfoComposer.middleware())
    this.composer.use(this.paymentComposer.middleware())
  }

  private startHandler = async (ctx: BotContext) => {
    const user = UserHelper.getUser(ctx)
    return ctx.reply(MessageHelper.makeClientGreetingsMessage(user.firstName), KeyboardHelper.getMainMenuKeyboard(ctx))
  }

  middleware() {
    return this.composer.middleware()
  }
}
