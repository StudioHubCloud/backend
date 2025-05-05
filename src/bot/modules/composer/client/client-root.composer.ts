import { Composer } from 'telegraf'
import { Injectable } from '@nestjs/common'
import { BotContext } from '@app/bot/bot.context'
import { ClientKeyboards } from './client.keyboard'
import { SchedulerComposer } from './scheduler/scheduler.composer'
import { CLIENT_PATTERNS } from '@app/bot/static/patterns'
import { PassInfoComposer } from './pass-info/pass-info.composer'

@Injectable()
export class ClientRootComposer {
  private readonly composer: Composer<BotContext>
  constructor(
    private readonly schedulerComposer: SchedulerComposer,
    private readonly passInfoComposer: PassInfoComposer,
  ) {
    this.composer = new Composer<BotContext>()

    this.initComposer()

    this.composer.use(this.schedulerComposer.getComposer())
    this.composer.use(this.passInfoComposer.getComposer())
  }

  getComposer() {
    return this.composer
  }

  initComposer() {
    this.composer.start(this.startHandler)
    this.composer.hears(CLIENT_PATTERNS.PAYMENT, this.paymentHandler)
    this.composer.hears(CLIENT_PATTERNS.RULES, this.rulesHandler)
  }

  private startHandler = async (ctx: BotContext) => {
    return ctx.reply(`Вітаємо в особистому кабінеті ❤️`, ClientKeyboards.mainMenu())
  }

  private paymentHandler = async (ctx: BotContext) => {
    return ctx.reply('Payment handler works')
  }

  private rulesHandler = async (ctx: BotContext) => {
    return ctx.reply('Rules handler works')
  }
}
