import { deunionize } from 'telegraf'
import { BotContext } from '../bot.context'
import { User } from '@telegraf/types'
import { ExtraAnswerCbQuery } from 'telegraf/typings/telegram-types'

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

  static getUpdatePayload(
    ctx: BotContext,
  ): [string, { isTextUpdate: boolean; isCallbackQueryUpdate: boolean; isInlineQueryUpdate: boolean }] {
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
    return [payloadData.trim(), { isTextUpdate, isCallbackQueryUpdate, isInlineQueryUpdate }]
  }

  static async safeAnswerCbQuery(ctx: BotContext, text?: string, options?: ExtraAnswerCbQuery) {
    const { callbackQuery } = ctx
    if (!callbackQuery) return false

    try {
      await ctx.answerCbQuery(text, options)
      return true
    } catch (error: any) {
      if (error.description?.includes('query is too old') || error.description?.includes('query ID is invalid')) {
        console.error('Callback query expired or invalid:', error.message)
      } else {
        console.error('Error answering callback query:', error.message)
      }
      return false
    }
  }
}
