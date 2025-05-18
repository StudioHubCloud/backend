import { Composer } from 'telegraf'
import { Injectable } from '@nestjs/common'
import { BotContext } from '@app/bot/bot.context'
import { SchedulerComposer } from './scheduler/scheduler.composer'
import { GuardComposer } from '../common/guard.composer'
import { PATTERNS_CLIENT, PATTERNS_COMMON } from '@app/bot/static/patterns'
import { PassInfoComposer } from './pass-info/pass-info.composer'
import { UserHelper } from '@app/bot/helpers'
import { PinoLogger } from 'nestjs-pino'
import { ClientKeyboards } from '@app/bot/modules/keyboard/storage'

@Injectable()
export class ClientRootComposer {
  private readonly composer: Composer<BotContext>
  constructor(
    private readonly logger: PinoLogger,
    private readonly schedulerComposer: SchedulerComposer,
    private readonly passInfoComposer: PassInfoComposer,
    private readonly guardComposer: GuardComposer
  ) {
    this.composer = new Composer<BotContext>()
    this.logger.setContext(ClientRootComposer.name)

    this.composer.use(this.guardComposer.middleware())
    
    this.initComposerHandlers()
    this.initExternalComposers()
  }

  private initComposerHandlers() {
    this.composer.start(this.startHandler)
    this.composer.hears(PATTERNS_CLIENT.PAYMENT, this.paymentHandler)
    this.composer.hears(PATTERNS_COMMON.RULES, this.rulesHandler)
  }

  private initExternalComposers() {
    this.composer.use(this.schedulerComposer.middleware())
    this.composer.use(this.passInfoComposer.middleware())
  }

  private startHandler = async (ctx: BotContext) => {
    const user = UserHelper.getUser(ctx)
    return ctx.reply(`Вітаємо в особистому кабінеті ${user.firstName}❤️`, ClientKeyboards.mainMenu())
  }

  private paymentHandler = async (ctx: BotContext) => {
    return ctx.reply('Тут будуть реквізити для оплати на першому етапі, потім підключим онлайн оплату')
  }
  
  private rulesHandler = async (ctx: BotContext) => {
    return ctx.reply('Якщо потрібні якісь правила, можна їх сюди вставити')
  }

  middleware() {
    return this.composer.middleware()
  }
}
