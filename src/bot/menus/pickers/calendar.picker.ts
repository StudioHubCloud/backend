import { addMonths, format, getDaysInMonth, getISODay, parse } from 'date-fns'
import { uk } from 'date-fns/locale'
import { InlineKeyboardButton } from '@telegraf/types'
import { BotContext } from '@app/bot/bot.context'
import { BotHelper, KeyboardHelper, RegexHelper, TextHelper } from '@app/bot/helpers'
import { CALLBACK_PREFIX, TReplyInlineKeyboard } from '@app/bot/libs'
import { BUTTON_PATTERNS } from '@app/bot/static/button-patterns'
import { DATE_FORMAT } from '@app/libs'

const PREFIX = CALLBACK_PREFIX.PICKER.CALENDAR
const MONTH_FORMAT = 'yyyy-MM'
const WEEKDAYS = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Нд']

export type TCalendarPickerOptions = {
  /** Adds "⬅️ Назад"; pressing it makes handle() return { type: 'back' } */
  withBackButton?: boolean
}

export type TCalendarPickerResult = { type: 'selected'; date: string } | { type: 'navigated' } | { type: 'back' } | null

/**
 * Reusable inline calendar (month grid, ◀️/▶️ navigation, "Сьогодні").
 * Stateless: the shown month and the picked day travel in callback_data, so it works in scenes and
 * composers alike and survives restarts. A picked date is returned in DATE_FORMAT.DATE_INPUT — the same
 * string TextHelper.validateDateInput returns for typed input, so both paths share the caller's code.
 *
 * `today` is the studio-local date in DATE_FORMAT.DATE_MAIN:
 * `dateTimeProvider.getTodayDateStringInTz(DATE_FORMAT.DATE_MAIN)`.
 * Pass the same `options` to keyboard() and handle() so month navigation keeps them.
 */
export class CalendarPicker {
  static keyboard(today: string, options: TCalendarPickerOptions = {}, month: string = today.slice(0, MONTH_FORMAT.length)): TReplyInlineKeyboard {
    const monthStart = parse(`${month}-01`, DATE_FORMAT.DATE_MAIN, new Date())
    const title = TextHelper.capitalize(format(monthStart, 'LLLL yyyy', { locale: uk }))

    const rows: InlineKeyboardButton[][] = [
      [
        this.navButton('◀️', addMonths(monthStart, -1)),
        this.noopButton(title),
        this.navButton('▶️', addMonths(monthStart, 1)),
      ],
      WEEKDAYS.map((day) => this.noopButton(day)),
    ]

    // Monday-first grid: pad the first week up to the month's first weekday
    let week: InlineKeyboardButton[] = Array.from({ length: getISODay(monthStart) - 1 }, () => this.noopButton(' '))
    for (let day = 1; day <= getDaysInMonth(monthStart); day++) {
      const date = `${month}-${String(day).padStart(2, '0')}`
      const dayButton: InlineKeyboardButton = {
        text: date === today ? `[${day}]` : String(day),
        callback_data: RegexHelper.createButtonActionCallbackData(PREFIX.DAY, date),
      }
      week.push(date === today ? KeyboardHelper.withStyle(dayButton, 'primary') : dayButton)
      if (week.length === WEEKDAYS.length) {
        rows.push(week)
        week = []
      }
    }
    if (week.length) {
      rows.push([...week, ...Array.from({ length: WEEKDAYS.length - week.length }, () => this.noopButton(' '))])
    }

    rows.push([
      KeyboardHelper.withStyle(
        { text: '📅 Сьогодні', callback_data: RegexHelper.createButtonActionCallbackData(PREFIX.DAY, today) },
        'primary',
      ),
    ])

    if (options.withBackButton) {
      rows.push([{ text: BUTTON_PATTERNS.BACK, callback_data: PREFIX.PREVIOUS_STEP }])
    }

    return KeyboardHelper.createInlineKeyboard(rows)
  }

  /** Handles this picker's callbacks: navigation edits the message in place; returns null for other updates. */
  static async handle(ctx: BotContext, today: string, options: TCalendarPickerOptions = {}): Promise<TCalendarPickerResult> {
    const { textPayload, isCallbackQueryUpdate } = BotHelper.getUpdatePayload(ctx)

    if (!isCallbackQueryUpdate) {
      return null
    }

    if (textPayload === PREFIX.NOOP) {
      BotHelper.safeAnswerCbQuery(ctx)
      return { type: 'navigated' }
    }

    if (textPayload === PREFIX.PREVIOUS_STEP) {
      BotHelper.safeAnswerCbQuery(ctx)
      return { type: 'back' }
    }

    const navMatch = RegexHelper.getMatchValue(PREFIX.NAV, textPayload)
    if (navMatch) {
      BotHelper.safeAnswerCbQuery(ctx)
      await BotHelper.safeEditMessageReplyMarkup(ctx, this.keyboard(today, options, navMatch[0]).reply_markup)
      return { type: 'navigated' }
    }

    const dayMatch = RegexHelper.getMatchValue(PREFIX.DAY, textPayload)
    if (dayMatch) {
      BotHelper.safeAnswerCbQuery(ctx)
      const date = format(parse(dayMatch[0], DATE_FORMAT.DATE_MAIN, new Date()), DATE_FORMAT.DATE_INPUT)
      return { type: 'selected', date }
    }

    return null
  }

  private static navButton(text: string, month: Date): InlineKeyboardButton {
    return { text, callback_data: RegexHelper.createButtonActionCallbackData(PREFIX.NAV, format(month, MONTH_FORMAT)) }
  }

  private static noopButton(text: string): InlineKeyboardButton {
    return { text, callback_data: PREFIX.NOOP }
  }
}
