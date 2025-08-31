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

  static getUpdatePayload(ctx: BotContext): [string, any] {
    const update = deunionize(ctx.update)

    let payloadData: string | null = ''

    let isTextUpdate = false
    let isCallbackQueryUpdate = false
    let isInlineQueryUpdate = false

    switch (true) {
      case !!update.callback_query:
        payloadData = deunionize(ctx.callbackQuery)?.data ?? ''
        isCallbackQueryUpdate = true
        break
      case !!update.message:
        payloadData = deunionize(ctx.message)?.text ?? ''
        isTextUpdate = true
        break
      case !!update.inline_query:
        payloadData = deunionize(ctx.inlineQuery)?.query ?? ''
        isInlineQueryUpdate = true
        break
      default:
        break
    }
    return [payloadData, { isTextUpdate, isCallbackQueryUpdate, isInlineQueryUpdate }]
  }
}
