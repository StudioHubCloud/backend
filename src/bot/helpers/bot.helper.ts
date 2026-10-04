import { deunionize, Telegram } from 'telegraf'
import { BotContext } from '../bot.context'
import { InlineKeyboardMarkup, User } from '@telegraf/types'
import { FmtString } from 'telegraf/typings/format'
import { ExtraAnswerCbQuery, ExtraEditMessageText, ExtraReplyMessage } from 'telegraf/typings/telegram-types'
import { FileTypeEnum } from '@app/libs'

/** Telegram's limit is 4096 characters of text; the margin covers HTML tags counted by the raw length. */
const MESSAGE_LIMIT = 4000
/** A line that starts a new block (a group header or a list item); indented lines stay with their block. */
const BLOCK_START = /^(•|🔹|🤝|👯)/u

export class BotHelper {
  /**
   * Splits a long HTML message into parts under Telegram's limit, between blocks (a "🔹 group" header or a "• item"
   * with its indented lines), so one item is never torn apart. Each line must close its own tags.
   */
  static splitLongMessage(text: string, limit: number = MESSAGE_LIMIT): string[] {
    if (text.length <= limit) {
      return [text]
    }

    const blocks: string[] = []
    for (const line of text.split('\n')) {
      if (!blocks.length || BLOCK_START.test(line)) {
        blocks.push(line)
      } else {
        blocks[blocks.length - 1] += `\n${line}`
      }
    }

    const parts: string[] = []
    let current = ''
    for (const block of blocks) {
      // A single block over the limit (never expected) is cut by lines as a last resort
      const pieces = block.length > limit ? block.split('\n') : [block]
      for (const piece of pieces) {
        if (current && current.length + 1 + piece.length > limit) {
          parts.push(current.trimEnd())
          current = ''
        }
        current = current ? `${current}\n${piece}` : piece
      }
    }
    if (current.trim()) {
      parts.push(current.trimEnd())
    }

    return parts
  }

  /** Sends a possibly long HTML message as several messages (see splitLongMessage). */
  static async safeSendLongMessage(telegram: Telegram, chatId: number | string, text: string) {
    for (const part of this.splitLongMessage(text)) {
      await this.safeSendMessage(telegram, chatId, part)
    }
  }

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

  static async safeEditMessageReplyMarkup(ctx: BotContext, markup: InlineKeyboardMarkup | undefined) {
    try {
      return await ctx.editMessageReplyMarkup(markup)
    } catch (error: any) {
      console.error('Error editing message reply markup:', error.message)
      return false
    }
  }

  static async safeEditMessageText(ctx: BotContext, text: string | FmtString, extra?: ExtraEditMessageText) {
    try {
      return await ctx.editMessageText(text, { parse_mode: 'HTML', ...extra })
    } catch (error: any) {
      console.error('Error editing message text:', error.message)
      return false
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
      return false
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
