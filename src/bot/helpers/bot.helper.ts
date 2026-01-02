import { deunionize, Telegram } from 'telegraf'
import { BotContext } from '../bot.context'
import { User } from '@telegraf/types'
import { FmtString } from 'telegraf/typings/format'
import { ExtraAnswerCbQuery, ExtraReplyMessage } from 'telegraf/typings/telegram-types'
import { PassActivationFileTypeEnum } from '@app/libs'

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

  static getUpdatePayload(ctx: BotContext): {
    textPayload: string
    fileId: string | null
    fileType: PassActivationFileTypeEnum | null
    isTextUpdate: boolean
    isCallbackQueryUpdate: boolean
    isInlineQueryUpdate: boolean
    isFileUpdate: boolean
  } {
    const update = deunionize(ctx.update)

    let textPayload = ''
    let fileId: string | null = null
    let isTextUpdate = false
    let isCallbackQueryUpdate = false
    let isInlineQueryUpdate = false
    let isFileUpdate = false
    let fileType: PassActivationFileTypeEnum | null = null

    switch (true) {
      case !!update.callback_query:
        textPayload = deunionize(ctx.callbackQuery)?.data ?? ''
        isCallbackQueryUpdate = true
        break
      case !!update.message:
        const message = deunionize(ctx.message)
        textPayload = message?.text ?? ''
        isTextUpdate = !!textPayload

        // Check for files
        if (message?.document) {
          fileId = message.document.file_id
          isFileUpdate = true
          fileType = PassActivationFileTypeEnum.DOCUMENT
        } else if (message?.photo && message.photo.length) {
          fileId = message.photo[message.photo.length - 1].file_id
          isFileUpdate = true
          fileType = PassActivationFileTypeEnum.PHOTO
        }
        break
      case !!update.inline_query:
        textPayload = deunionize(ctx.inlineQuery)?.query ?? ''
        isInlineQueryUpdate = true
        break
      default:
        break
    }

    return {
      textPayload: textPayload.trim(),
      fileId,
      fileType,
      isTextUpdate,
      isCallbackQueryUpdate,
      isInlineQueryUpdate,
      isFileUpdate,
    }
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

  static async safeSendMessage(telegram: Telegram, chatId: number | string, text: string | FmtString, options?: ExtraReplyMessage) {
    try {
      await telegram.sendMessage(chatId, text, options)
    } catch (error) {
      console.error('Error sending message:', error.message, chatId, text)
    }
  }
}
