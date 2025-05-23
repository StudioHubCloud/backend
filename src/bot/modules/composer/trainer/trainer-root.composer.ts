import { Composer } from 'telegraf'
import { Injectable } from '@nestjs/common'
import { BotContext } from '@app/bot/bot.context'
import { KeyboardHelper, UserHelper } from '@app/bot/helpers'

@Injectable()
export class TrainerRootComposer {
  private readonly composer: Composer<BotContext>

  constructor() {
    this.composer = new Composer<BotContext>()

    this.composer.start(async (ctx) => {
      const role = UserHelper.getUserRole(ctx)
      ctx.reply('Welcome to the trainer panel!', KeyboardHelper.getRoleBasedMainMenuKeyboard(role))
    })
  }

  middleware() {
    return this.composer.middleware()
  }
}
