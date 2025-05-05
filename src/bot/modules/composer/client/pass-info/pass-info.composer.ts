import { BotContext } from '@app/bot/bot.context'
import { CLIENT_PATTERNS } from '@app/bot/static/patterns'
import { Injectable } from '@nestjs/common'
import { Composer } from 'telegraf'

@Injectable()
export class PassInfoComposer {
  private readonly composer: Composer<BotContext>
  constructor() {
    this.composer = new Composer<BotContext>()
    this.initComposer()
  }

  getComposer() {
    return this.composer
  }

  initComposer() {
    this.composer.hears(CLIENT_PATTERNS.PASS_INFO, this.passInfoHandler)
  }

  private passInfoHandler = async (ctx: BotContext) => {
    await ctx.reply('Pass info handler works')
  }
}
