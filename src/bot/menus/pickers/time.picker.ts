import { InlineKeyboardButton } from '@telegraf/types'
import { BotContext } from '@app/bot/bot.context'
import { BotHelper, KeyboardHelper, RegexHelper } from '@app/bot/helpers'
import { CALLBACK_PREFIX, TReplyInlineKeyboard } from '@app/bot/libs'
import { BUTTON_PATTERNS } from '@app/bot/static/button-patterns'

const PREFIX = CALLBACK_PREFIX.PICKER.TIME
const HOURS = { FROM: 7, TO: 22 }
const MINUTES = ['00', '15', '30', '45']
const HOURS_PER_ROW = 6

export type TTimePickerOptions = {
  /** Adds "⬅️ Назад" under the hours; pressing it makes handle() return { type: 'back' } */
  withBackButton?: boolean
}

export type TTimePickerResult = { type: 'selected'; time: string } | { type: 'navigated' } | { type: 'back' } | null

/**
 * Reusable inline time picker: hour grid → minutes (:00/:15/:30/:45), edited in place.
 * Stateless (the hour travels in callback_data; "HH:mm" is split into value/subvalue because
 * callback values can't contain ':'). A picked time is returned as DATE_FORMAT.TIME_MAIN ("HH:mm"),
 * the same string TextHelper.validateTimeInput returns for typed input.
 * Pass the same `options` to keyboard() and handle() so "⬅️ Інша година" restores them.
 */
export class TimePicker {
  static keyboard(options: TTimePickerOptions = {}): TReplyInlineKeyboard {
    const hours = Array.from({ length: HOURS.TO - HOURS.FROM + 1 }, (_, i) => String(HOURS.FROM + i).padStart(2, '0'))
    const rows: InlineKeyboardButton[][] = []

    for (let i = 0; i < hours.length; i += HOURS_PER_ROW) {
      rows.push(
        hours.slice(i, i + HOURS_PER_ROW).map((hour) => ({
          text: hour,
          callback_data: RegexHelper.createButtonActionCallbackData(PREFIX.HOUR, hour),
        })),
      )
    }

    if (options.withBackButton) {
      rows.push([{ text: BUTTON_PATTERNS.BACK, callback_data: PREFIX.PREVIOUS_STEP }])
    }

    return KeyboardHelper.createInlineKeyboard(rows)
  }

  static minutesKeyboard(hour: string): TReplyInlineKeyboard {
    return KeyboardHelper.createInlineKeyboard([
      MINUTES.map((minute) => ({
        text: `${hour}:${minute}`,
        callback_data: RegexHelper.createButtonActionCallbackData(PREFIX.MINUTE, hour, minute),
      })),
      [{ text: '⬅️ Інша година', callback_data: PREFIX.BACK }],
    ])
  }

  /** Handles this picker's callbacks: hour/back edit the message in place; returns null for other updates. */
  static async handle(ctx: BotContext, options: TTimePickerOptions = {}): Promise<TTimePickerResult> {
    const { textPayload, isCallbackQueryUpdate } = BotHelper.getUpdatePayload(ctx)

    if (!isCallbackQueryUpdate) {
      return null
    }

    if (textPayload === PREFIX.PREVIOUS_STEP) {
      BotHelper.safeAnswerCbQuery(ctx)
      return { type: 'back' }
    }

    if (textPayload === PREFIX.BACK) {
      BotHelper.safeAnswerCbQuery(ctx)
      await BotHelper.safeEditMessageReplyMarkup(ctx, this.keyboard(options).reply_markup)
      return { type: 'navigated' }
    }

    const hourMatch = RegexHelper.getMatchValue(PREFIX.HOUR, textPayload)
    if (hourMatch) {
      BotHelper.safeAnswerCbQuery(ctx)
      await BotHelper.safeEditMessageReplyMarkup(ctx, this.minutesKeyboard(hourMatch[0]).reply_markup)
      return { type: 'navigated' }
    }

    const minuteMatch = RegexHelper.getMatchValue(PREFIX.MINUTE, textPayload)
    if (minuteMatch) {
      BotHelper.safeAnswerCbQuery(ctx)
      return { type: 'selected', time: `${minuteMatch[0]}:${minuteMatch[1]}` }
    }

    return null
  }
}
