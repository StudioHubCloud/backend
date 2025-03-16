import { BotContext } from '@app/bot/bot.context'
import { BusinessService } from '@app/domain/business'
import { Injectable } from '@nestjs/common'

@Injectable()
export class StartHandler {
  constructor() {}

  welcomeHandler = async (ctx: BotContext) => {
    console.log(ctx, 'ctx')
    ctx.reply(`Hello, ${ctx.state.user.fullName}!`)
  }
}
