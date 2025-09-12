import { Composer } from 'telegraf'
import { Injectable } from '@nestjs/common'
import { PinoLogger } from 'nestjs-pino'
import { BotContext } from '@app/bot/bot.context'
import { SchedulerComposer } from '../common/scheduler.composer'
import { PaymentComposer } from '../common/payment.composer'
import { PassInfoComposer } from './pass-info/pass-info.composer'
import { UserHelper } from '@app/bot/helpers'
import { ClientKeyboards } from '@app/bot/keyboard/storage'
import { RulesGuardComposer } from '../common/rules-guard.composer'
import { MessageHelper } from '@app/bot/helpers/message.helper'

@Injectable()
export class ClientRootComposer {
  private readonly composer: Composer<BotContext>
  constructor(
    private readonly logger: PinoLogger,
    private readonly schedulerComposer: SchedulerComposer,
    private readonly passInfoComposer: PassInfoComposer,
    private readonly paymentComposer: PaymentComposer,
    private readonly rulesGuardComposer: RulesGuardComposer,
  ) {
    this.composer = new Composer<BotContext>()
    this.logger.setContext(ClientRootComposer.name)

    this.composer.use(this.rulesGuardComposer.middleware())

    this.initComposerHandlers()
    this.initExternalComposers()
  }

  private initComposerHandlers() {
    this.composer.start(this.startHandler)
  }

  private initExternalComposers() {
    this.composer.use(this.schedulerComposer.middleware())
    this.composer.use(this.passInfoComposer.middleware())
    this.composer.use(this.paymentComposer.middleware())
  }

  private startHandler = async (ctx: BotContext) => {
    const user = UserHelper.getUser(ctx)
    const withoutPass = !user.client || user.client.pass.length === 0
    return ctx.reply(MessageHelper.makeClientGreetingsMessage(user.firstName), ClientKeyboards.mainMenu({ withoutPass }))
  }

  middleware() {
    return this.composer.middleware()
  }
}
