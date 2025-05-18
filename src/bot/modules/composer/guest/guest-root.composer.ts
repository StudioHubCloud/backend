import { Injectable } from '@nestjs/common'
import { Composer } from 'telegraf'
import { BotContext } from '@app/bot/bot.context'
import { KeyboardHelper } from '@app/bot/helpers'
import { GuardComposer } from '../common/guard.composer'

@Injectable()
export class GuestRootComposer {
  private readonly composer: Composer<BotContext>

  constructor(private readonly guardComposer: GuardComposer) {
    this.composer = new Composer<BotContext>()
    this.composer.use(this.guardComposer.middleware())

    this.composer.start(async (ctx) => {
      return ctx.reply('Welcome from Guest!', KeyboardHelper.removeReplyMarkupKeyboard())
    })
  }

  middleware() {
    return this.composer.middleware()
  }
}
