import { Composer } from 'telegraf'
import { Injectable } from '@nestjs/common'
import { BotContext } from '@app/bot/bot.context'
import { ClientKeyboards } from './client.keyboard'
import { SchedulerComposer } from './scheduler/scheduler.composer'
import { CLIENT_PATTERNS } from '@app/bot/static/patterns'
import { PassInfoComposer } from './pass-info/pass-info.composer'
import { UserHelper } from '@app/bot/helpers'
import { type TNextFunction } from '@app/libs/types'
import { MESSAGES_COMMON } from '@app/bot/static/messages'
import { SCENES } from '@app/libs'

@Injectable()
export class ClientRootComposer {
  private readonly composer: Composer<BotContext>
  constructor(
    private readonly schedulerComposer: SchedulerComposer,
    private readonly passInfoComposer: PassInfoComposer,
  ) {
    this.composer = new Composer<BotContext>()

    this.initComposerGuards()
    this.initComposer()

    this.composer.use(this.schedulerComposer.getComposer())
    this.composer.use(this.passInfoComposer.getComposer())
  }

  getComposer() {
    return this.composer
  }

  private initComposerGuards() {
    this.composer.use(this.unverifiedGuard)
  }

  private initComposer() {
    this.composer.start(this.startHandler)
    this.composer.hears(CLIENT_PATTERNS.PAYMENT, this.paymentHandler)
    this.composer.hears(CLIENT_PATTERNS.RULES, this.rulesHandler)
  }

  private unverifiedGuard = async (ctx: BotContext, next: TNextFunction) => {
    const isUnverified = UserHelper.isUnverifiedStatus(ctx)
    if (!isUnverified) {
      await ctx.reply('user is verified')
      return await next()
    }
    const isVerificationRequested = UserHelper.isVerificatonRequestedStatus(ctx)

    if(isVerificationRequested) {
      return ctx.reply(MESSAGES_COMMON.VERIFICATION_REQUESTED)
    }

    await ctx.reply('unverified guard triggered')

    return ctx.scene.enter(SCENES.GUEST.EXAMPLE)
  }

  private startHandler = async (ctx: BotContext) => {
    const user = UserHelper.getUser(ctx)
    throw new Error('An error occurred in the start handler')
    return ctx.reply(`Вітаємо в особистому кабінеті ${user.firstName}❤️`, ClientKeyboards.mainMenu())
  }

  private paymentHandler = async (ctx: BotContext) => {
    return ctx.reply('Тут будуть реквізити для оплати на першому етапі, потім підключим онлайн оплату')
  }

  private rulesHandler = async (ctx: BotContext) => {
    return ctx.reply('Якщо потрібні якісь правила, можна їх сюди вставити')
  }
}
