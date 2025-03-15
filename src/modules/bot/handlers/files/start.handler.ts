import { Injectable } from '@nestjs/common'
import { Context } from 'grammy'

@Injectable()
export class StartHandler {
  welcomeHandler(ctx: Context) {
    const studioName = ctx.message?.text?.split(' ')[1]
    if (!studioName) {
      return ctx.reply('Wrong link')
    }
    ctx.reply(studioName)
  }
}
