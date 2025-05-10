import { Composer } from 'telegraf'
import { Injectable } from '@nestjs/common'
import { BotContext } from '@app/bot/bot.context'
import { SchedulerComposer } from './scheduler/scheduler.composer'
import { CLIENT_PATTERNS } from '@app/bot/static/patterns'
import { PassInfoComposer } from './pass-info/pass-info.composer'
import { UserHelper } from '@app/bot/helpers'
import { PinoLogger } from 'nestjs-pino'
import { UnverifiedGuard } from '@app/bot/guards'
import { Keyboards } from '@app/bot/modules/keyboard'

@Injectable()
export class ClientRootComposer {
  private readonly composer: Composer<BotContext>
  constructor(
    private readonly logger: PinoLogger,
    private readonly schedulerComposer: SchedulerComposer,
    private readonly passInfoComposer: PassInfoComposer,
  ) {
    this.composer = new Composer<BotContext>()
    this.logger.setContext(ClientRootComposer.name)

    this.composer.use(UnverifiedGuard)

    this.initComposer()

    this.composer.use(this.schedulerComposer.getComposer())
    this.composer.use(this.passInfoComposer.getComposer())
  }

  private initComposer() {
    this.composer.start(this.startHandler)
    this.composer.hears(CLIENT_PATTERNS.PAYMENT, this.paymentHandler)
    this.composer.hears(CLIENT_PATTERNS.RULES, this.rulesHandler)
  }

  private startHandler = async (ctx: BotContext) => {
    const user = UserHelper.getUser(ctx)
    return ctx.reply(`Вітаємо в особистому кабінеті ${user.firstName}❤️`, Keyboards.client.mainMenu())
  }

  private paymentHandler = async (ctx: BotContext) => {
    return ctx.reply('Тут будуть реквізити для оплати на першому етапі, потім підключим онлайн оплату')
  }
  
  private rulesHandler = async (ctx: BotContext) => {
    return ctx.reply('Якщо потрібні якісь правила, можна їх сюди вставити')
  }

  getComposer() {
    return this.composer
  }
}
