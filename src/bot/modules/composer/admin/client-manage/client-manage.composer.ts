import { Composer } from 'telegraf'
import { Injectable } from '@nestjs/common'
import { BotContext } from '@app/bot/bot.context'
import { KeyboardHelper, UserHelper } from '@app/bot/helpers'

@Injectable()
export class ClientManageComposer {
  private readonly composer: Composer<BotContext>

  constructor() {
    this.composer = new Composer<BotContext>()
  }

  middleware() {
    return this.composer.middleware()
  }
}
