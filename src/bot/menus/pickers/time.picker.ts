import { InlineKeyboardButton } from '@telegraf/types'
import { BotContext } from '@app/bot/bot.context'
import { BotHelper, KeyboardHelper, RegexHelper } from '@app/bot/helpers'
import { CALLBACK_PREFIX, TPickerItemState, TPickerItemStateResolver, TReplyInlineKeyboard } from '@app/bot/libs'
import { BUTTON_PATTERNS } from '@app/bot/static/button-patterns'
import { PickerItemHelper } from './picker-item.helper'

const PREFIX = CALLBACK_PREFIX.PICKER.TIME
const HOURS = { FROM: 7, TO: 22 }
const MINUTES = ['00', '15', '30', '45']
const HOURS_PER_ROW = 6
// Hours always open (the minutes decide what can be picked); colour only shows how much of the hour is taken.
// Telegram has no yellow style, so "partly taken" is blue.
const FULL_HOUR_STATE: TPickerItemState = { style: 'danger' }
const PARTIAL_HOUR_STATE: TPickerItemState = { style: 'primary' }

export type TTimePickerOptions = {
  /** Adds "⬅️ Назад" under the hours; pressing it makes handle() return { type: 'back' } */
  withBackButton?: boolean
  /**
   * States of minute slots (keys HH:mm). Hours are derived and always open: every slot disabled → red,
   * some disabled → blue.
   */
  resolveTimes?: TPickerItemStateResolver
}

export type TTimePickerResult = { type: 'selected'; time: string } | { type: 'navigated' } | { type: 'back' } | null

/**
 * Reusable inline time picker: hour grid → minutes (:00/:15/:30/:45), edited in place.
 * Stateless (the hour travels in callback_data; "HH:mm" is split into value/subvalue because
 * callback values can't contain ':'). A picked time is returned as DATE_FORMAT.TIME_MAIN ("HH:mm"),
 * the same string TextHelper.validateTimeInput returns for typed input.
 * Pass the same `options` to keyboard() and handle() so "⬅️ Інша година" restores them; build them per update
 * (not once per scene) when `resolveTimes` depends on the user's state (e.g. the picked date).
 */
export class TimePicker {
  static async keyboard(options: TTimePickerOptions = {}): Promise<TReplyInlineKeyboard> {
    const hours = Array.from({ length: HOURS.TO - HOURS.FROM + 1 }, (_, i) => String(HOURS.FROM + i).padStart(2, '0'))
    const hourStates = await this.resolveHours(hours, options)
    const rows: InlineKeyboardButton[][] = []

    for (let i = 0; i < hours.length; i += HOURS_PER_ROW) {
      rows.push(
        hours.slice(i, i + HOURS_PER_ROW).map((hour) =>
          PickerItemHelper.apply(
            { text: hour, callback_data: RegexHelper.createButtonActionCallbackData(PREFIX.HOUR, hour) },
            hourStates[hour],
          ),
        ),
      )
    }

    if (options.withBackButton) {
      rows.push([{ text: BUTTON_PATTERNS.BACK, callback_data: PREFIX.PREVIOUS_STEP }])
    }

    return KeyboardHelper.createInlineKeyboard(rows)
  }

  static async minutesKeyboard(hour: string, options: TTimePickerOptions = {}): Promise<TReplyInlineKeyboard> {
    const times = MINUTES.map((minute) => `${hour}:${minute}`)
    const timeStates = await PickerItemHelper.resolve(options.resolveTimes, times)

    return KeyboardHelper.createInlineKeyboard([
      MINUTES.map((minute) =>
        PickerItemHelper.apply(
          { text: `${hour}:${minute}`, callback_data: RegexHelper.createButtonActionCallbackData(PREFIX.MINUTE, hour, minute) },
          timeStates[`${hour}:${minute}`],
        ),
      ),
      [{ text: '⬅️ Інша година', callback_data: PREFIX.BACK }],
    ])
  }

  /** Hour states from their minute slots, resolved in one call. */
  private static async resolveHours(hours: string[], options: TTimePickerOptions): Promise<Record<string, TPickerItemState | undefined>> {
    if (!options.resolveTimes) {
      return {}
    }

    const timeStates = await options.resolveTimes(hours.flatMap((hour) => MINUTES.map((minute) => `${hour}:${minute}`)))

    return Object.fromEntries(
      hours.map((hour) => {
        const states = MINUTES.map((minute) => timeStates[`${hour}:${minute}`])
        const disabledCount = states.filter((state) => state?.disabled).length

        if (disabledCount === MINUTES.length) {
          return [hour, FULL_HOUR_STATE]
        }
        return [hour, disabledCount > 0 ? PARTIAL_HOUR_STATE : undefined]
      }),
    )
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
      await BotHelper.safeEditMessageReplyMarkup(ctx, (await this.keyboard(options)).reply_markup)
      return { type: 'navigated' }
    }

    const hourMatch = RegexHelper.getMatchValue(PREFIX.HOUR, textPayload)
    if (hourMatch) {
      const [hour] = hourMatch
      BotHelper.safeAnswerCbQuery(ctx)
      await BotHelper.safeEditMessageReplyMarkup(ctx, (await this.minutesKeyboard(hour, options)).reply_markup)
      return { type: 'navigated' }
    }

    const minuteMatch = RegexHelper.getMatchValue(PREFIX.MINUTE, textPayload)
    if (minuteMatch) {
      const time = `${minuteMatch[0]}:${minuteMatch[1]}`
      if (await PickerItemHelper.rejectIfDisabled(ctx, options.resolveTimes, time)) {
        return { type: 'navigated' }
      }
      BotHelper.safeAnswerCbQuery(ctx)
      return { type: 'selected', time }
    }

    return null
  }
}
