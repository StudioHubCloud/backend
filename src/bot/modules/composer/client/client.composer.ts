import { BotContext } from '@app/bot/bot.context'
import { KeyboardService } from '@app/bot/modules'
import { Injectable } from '@nestjs/common'
import { Composer } from 'telegraf'

@Injectable()
export class ClientComposer {
  private readonly composer: Composer<BotContext>
  constructor(private readonly keyboardService: KeyboardService) {
    this.composer = new Composer<BotContext>()
    this.initComposer()
  }

  getComposer() {
    return this.composer
  }

  initComposer() {
    this.composer.start((ctx) => {
      ctx.reply('Welcome from Client!', this.keyboardService.removeKeyboard())
    })
  }
}
