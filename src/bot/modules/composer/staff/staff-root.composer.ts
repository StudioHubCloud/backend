import { Composer } from 'telegraf'
import { Injectable } from '@nestjs/common'
import { BotContext } from '@app/bot/bot.context'
import { KeyboardHelper } from '@app/bot/helpers'
import { UnverifiedGuard } from '@app/bot/guards'

@Injectable()
export class StaffRootComposer {
  private readonly composer: Composer<BotContext>

  constructor() {
    this.composer = new Composer<BotContext>()

    this.composer.use(UnverifiedGuard)

    this.initComposer()
  }

  getComposer() {
    return this.composer
  }

  initComposer() {
    this.composer.start((ctx) => {
      ctx.reply('Welcome from Staff!', KeyboardHelper.removeReplyMarkupKeyboard())
    })
  }
}
