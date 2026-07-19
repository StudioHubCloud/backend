import { deunionize, Telegram } from 'telegraf'
import { BotContext } from '../bot.context'
import { User } from '@telegraf/types'
import { FmtString } from 'telegraf/typings/format'
import { ExtraAnswerCbQuery, ExtraEditMessageText, ExtraReplyMessage } from 'telegraf/typings/telegram-types'
import { FileTypeEnum } from '@app/libs'

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
    fileType: FileTypeEnum | null
    isTextUpdate: boolean
    isCallbackQueryUpdate: boolean
    isInlineQueryUpdate: boolean
    isFileUpdate: boolean
    isVoiceUpdate: boolean
    voiceFileId: string | null
    voiceDuration: number | null
  } {
    const update = deunionize(ctx.update)

    let textPayload = ''
    let fileId: string | null = null
    let isTextUpdate = false
    let isCallbackQueryUpdate = false
    let isInlineQueryUpdate = false
    let isFileUpdate = false
    let isVoiceUpdate = false
    let fileType: FileTypeEnum | null = null
    let voiceFileId: string | null = null
    let voiceDuration: number | null = null

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
          fileType = FileTypeEnum.DOCUMENT
        } else if (message?.photo && message.photo.length) {
          fileId = message.photo[message.photo.length - 1].file_id
          isFileUpdate = true
          fileType = FileTypeEnum.PHOTO
        } else if (message?.voice) {
          isVoiceUpdate = true
          voiceFileId = message.voice.file_id
          voiceDuration = message.voice.duration
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
      isVoiceUpdate,
      voiceFileId,
      voiceDuration,
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
      await telegram.sendMessage(chatId, text, { parse_mode: 'HTML', ...options })
    } catch (error: any) {
      console.error('Error sending message:', error?.message, chatId, text)
    }
  }

  static async safeEditMessageText(ctx: BotContext, text: string | FmtString, extra?: ExtraEditMessageText) {
    try {
      return await ctx.editMessageText(text, { parse_mode: 'HTML', ...extra })
    } catch (error: any) {
      console.error('Error editing message text:', error.message)
      // return original message
      if (error?.response?.error_code === 400 && error?.response?.description?.includes('message is not modified')) {
        return false
      }
      //rethrow for further handling
      throw error
    }
  }

  // For editing a message other than the one implied by the current update (e.g. a placeholder
  // sent earlier by ctx.reply()) — ctx.editMessageText()'s extra type deliberately excludes
  // message_id/inline_message_id, since it can only ever target "the current" message.
  static async safeEditMessageTextById(
    ctx: BotContext,
    chatId: number | string | undefined,
    messageId: number | undefined,
    text: string | FmtString,
  ) {
    try {
      return await ctx.telegram.editMessageText(chatId, messageId, undefined, text, { parse_mode: 'HTML' })
    } catch (error: any) {
      console.error('Error editing message text by id:', error.message)
      if (error?.response?.error_code === 400 && error?.response?.description?.includes('message is not modified')) {
        return false
      }
      throw error
    }
  }

  static async safeDeleteMessage(ctx: BotContext) {
    try {
      return await ctx.deleteMessage()
    } catch (error: any) {
      console.error('Error deleting message:', error.message)
      return false
    }
  }
}
