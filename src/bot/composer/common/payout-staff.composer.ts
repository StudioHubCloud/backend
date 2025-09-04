import { BotContext } from '@app/bot/bot.context'
import { MESSAGES_COMMON } from '@app/bot/static/messages'
import { BUTTON_PATTERNS } from '@app/bot/static/button-patterns'
import { Injectable } from '@nestjs/common'
import { Composer } from 'telegraf'

@Injectable()
export class PayoutStaffComposer {
  private readonly composer: Composer<BotContext>
  constructor() {
    this.composer = new Composer<BotContext>()
    this.initComposerHandlers()
  }

  middleware() {
    return this.composer.middleware()
  }

  initComposerHandlers() {}
}
