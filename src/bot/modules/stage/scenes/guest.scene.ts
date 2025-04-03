import { Scenes } from 'telegraf'
import { Injectable } from '@nestjs/common'
import { BotContext } from '@app/bot/bot.context'
import { SCENES } from '@app/libs'

@Injectable()
export class GuestScene extends Scenes.BaseScene<BotContext> {
  constructor() {
    super(SCENES.GUEST.EXAMPLE)

    this.enter((ctx: BotContext) => {
      ctx.reply('You are now in the guest_example scene.  Send me something!')
    })

    this.leave((ctx: BotContext) => {
      ctx.reply('Leaving the guest_example scene.')
    })

    this.command('leave', (ctx: BotContext) => {
      ctx.scene.leave()
    })
  }
}
