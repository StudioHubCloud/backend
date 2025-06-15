import { Composer } from 'telegraf'
import { Injectable } from '@nestjs/common'
import { BotContext } from '@app/bot/bot.context'
import { KeyboardHelper, UserHelper } from '@app/bot/helpers'
import { PATTERNS_ADMIN } from '@app/bot/static/patterns'

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
