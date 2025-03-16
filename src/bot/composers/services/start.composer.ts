import { Injectable } from '@nestjs/common'
import { Composer } from 'grammy'
import { StartHandler } from '../../handlers'
import { BotContext } from '@app/bot/bot.context'

@Injectable()
export class StartComposer extends Composer<BotContext> {
  constructor(private readonly startHandler: StartHandler) {
    super()
    this.on(':text', this.startHandler.welcomeHandler)
  }
}
