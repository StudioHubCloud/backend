import { Injectable } from '@nestjs/common'
import { Context } from 'grammy'

@Injectable()
export class StartHandler {
  welcomeHandler(ctx: Context) {
    console.log(ctx.message)
    ctx.reply('Hello! I am a bot that can help you with something. Please, type /help to see what I can do.')
  }
}
