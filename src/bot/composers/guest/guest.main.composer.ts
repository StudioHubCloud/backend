import { BotContext } from '@app/bot/bot.context'
import { Injectable } from '@nestjs/common'
import { Composer } from 'grammy'

@Injectable()
export class GuestMainComposer extends Composer<BotContext> {
  constructor() {
    super()
  }
}
