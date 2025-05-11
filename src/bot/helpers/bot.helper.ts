import { deunionize } from 'telegraf'
import { BotContext } from '../bot.context'
import { User } from '@telegraf/types'

export class BotHelper {
  static getFrom(ctx: BotContext) {
    const update = deunionize(ctx.update)
    let from: User

    if (update.callback_query) {
      from = update.callback_query.from
    } else if (update.message) {
      from = update.message.from
    } else {
      return null
    }
    return from
  }

  static getUpdatePayload(ctx: BotContext): string {
    const update = deunionize(ctx.update)
    let messageText: string | null = ''

    switch (true) {
      case !!update.callback_query:
        messageText = deunionize(ctx.callbackQuery)?.data ?? ''
        break
      case !!update.message:
        messageText = deunionize(ctx.message)?.text ?? ''
        break
      case !!update.inline_query:
        messageText = deunionize(ctx.inlineQuery)?.query ?? ''
        break
      default:
        break
    }
    return messageText
  }
}
