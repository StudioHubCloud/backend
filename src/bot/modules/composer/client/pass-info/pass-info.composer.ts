import { BotContext } from '@app/bot/bot.context'
import { PATTERNS_CLIENT } from '@app/bot/static/patterns'
import { Injectable } from '@nestjs/common'
import { Composer } from 'telegraf'

@Injectable()
export class PassInfoComposer {
  private readonly composer: Composer<BotContext>
  constructor() {
    this.composer = new Composer<BotContext>()
    this.initComposerHandlers()
  }

  middleware() {
    return this.composer.middleware()
  }

  initComposerHandlers() {
    this.composer.hears(PATTERNS_CLIENT.PASS_INFO, this.passInfoHandler)
  }

  private passInfoHandler = async (ctx: BotContext) => {
    await ctx.reply('Pass info handler works')
  }
}
