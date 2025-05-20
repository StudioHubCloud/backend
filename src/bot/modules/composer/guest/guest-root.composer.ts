import { Injectable } from '@nestjs/common'
import { Composer } from 'telegraf'
import { BotContext } from '@app/bot/bot.context'
import { KeyboardHelper } from '@app/bot/helpers'

@Injectable()
export class GuestRootComposer {
  private readonly composer: Composer<BotContext>

  constructor() {
    this.composer = new Composer<BotContext>()

    this.composer.start(async (ctx) => {
      return ctx.reply('Welcome from Guest!', KeyboardHelper.removeReplyMarkupKeyboard())
    })
  }

  middleware() {
    return this.composer.middleware()
  }
}
