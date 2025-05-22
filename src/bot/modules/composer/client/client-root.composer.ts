import { Composer } from 'telegraf'
import { Injectable } from '@nestjs/common'
import { PinoLogger } from 'nestjs-pino'
import { BotContext } from '@app/bot/bot.context'
import { SchedulerComposer } from '../common/scheduler.composer'
import { PaymentComposer } from '../common/payment.composer'
import { PATTERNS_COMMON } from '@app/bot/static/patterns'
import { RULES } from '@app/bot/static/messages'
import { PassInfoComposer } from './pass-info/pass-info.composer'
import { UserHelper } from '@app/bot/helpers'
import { ClientKeyboards } from '@app/bot/modules/keyboard/storage'

@Injectable()
export class ClientRootComposer {
  private readonly composer: Composer<BotContext>
  constructor(
    private readonly logger: PinoLogger,
    private readonly schedulerComposer: SchedulerComposer,
    private readonly passInfoComposer: PassInfoComposer,
    private readonly paymentComposer: PaymentComposer,
  ) {
    this.composer = new Composer<BotContext>()
    this.logger.setContext(ClientRootComposer.name)

    
    this.initComposerHandlers()
    this.initExternalComposers()
  }

  private initComposerHandlers() {
    this.composer.start(this.startHandler)
    this.composer.hears(PATTERNS_COMMON.RULES, this.rulesHandler)
  }

  private initExternalComposers() {
    this.composer.use(this.schedulerComposer.middleware())
    this.composer.use(this.passInfoComposer.middleware())
    this.composer.use(this.paymentComposer.middleware())
  }

  private startHandler = async (ctx: BotContext) => {
    const user = UserHelper.getUser(ctx)
    return ctx.reply(`Вітаємо в особистому кабінеті ${user.firstName}❤️`, ClientKeyboards.mainMenu())
  }

  private rulesHandler = async (ctx: BotContext) => {
    return ctx.replyWithHTML(RULES)
  }

  middleware() {
    return this.composer.middleware()
  }
}
