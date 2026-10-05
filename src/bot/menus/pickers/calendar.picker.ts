import { addMonths, format, getDaysInMonth, getISODay, parse } from 'date-fns'
import { uk } from 'date-fns/locale'
import { InlineKeyboardButton } from '@telegraf/types'
import { BotContext } from '@app/bot/bot.context'
import { BotHelper, KeyboardHelper, RegexHelper, TextHelper } from '@app/bot/helpers'
import { CALLBACK_DATA, CALLBACK_PREFIX, TPickerItemStateResolver, TReplyInlineKeyboard } from '@app/bot/libs'
import { BUTTON_PATTERNS } from '@app/bot/static/button-patterns'
import { DATE_FORMAT } from '@app/libs'
import { PickerItemHelper } from './picker-item.helper'

const PREFIX = CALLBACK_PREFIX.PICKER.CALENDAR
const MONTH_FORMAT = 'yyyy-MM'
const WEEKDAYS = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Нд']
const MONTHS = ['Січ', 'Лют', 'Бер', 'Кві', 'Тра', 'Чер', 'Лип', 'Сер', 'Вер', 'Жов', 'Лис', 'Гру']
const YEARS_PER_PAGE = 12
const GRID_COLUMNS = 4

export type TCalendarPickerOptions = {
  /** Adds "⬅️ Назад"; pressing it makes handle() return { type: 'back' } */
  withBackButton?: boolean
  /** Adds "✖️ Закрити" (a root menu outside scenes); closing is handled globally */
  withCloseButton?: boolean
  /** States of the shown month's days (keys yyyy-MM-dd): colour, marker, or disabled (can't be picked). */
  resolveDays?: TPickerItemStateResolver
  /**
   * Year → month → day for far dates (date of birth): the month title opens the year's months, their title a page of
   * years. Navigation stays within the range; the calendar opens on the years page holding `toYear`.
   */
  yearRange?: { fromYear: number; toYear: number }
  /** Hides "📅 Сьогодні" (e.g. a date of birth) */
  withoutToday?: boolean
}

export type TCalendarPickerResult = { type: 'selected'; date: string } | { type: 'navigated' } | { type: 'back' } | null

/**
 * Reusable inline calendar (month grid, ◀️/▶️ navigation, "Сьогодні"; with `yearRange` also year → month).
 * Stateless: the shown month and the picked day travel in callback_data, so it works in scenes and
 * composers alike and survives restarts. A picked date is returned in DATE_FORMAT.DATE_INPUT — the same
 * string TextHelper.validateDateInput returns for typed input, so both paths share the caller's code.
 *
 * `today` is the studio-local date in DATE_FORMAT.DATE_MAIN:
 * `dateTimeProvider.getTodayDateStringInTz(DATE_FORMAT.DATE_MAIN)`.
 * Pass the same `options` to keyboard() and handle() so month navigation keeps them; build them per update
 * (not once per scene) when `resolveDays` depends on the user's state.
 */
export class CalendarPicker {
  static async keyboard(today: string, options: TCalendarPickerOptions = {}, month?: string): Promise<TReplyInlineKeyboard> {
    if (!month && options.yearRange) {
      return this.yearsKeyboard(options, this.getYearsPageStart(options.yearRange.toYear, options.yearRange))
    }
    return this.daysKeyboard(today, options, month ?? today.slice(0, MONTH_FORMAT.length))
  }

  private static async daysKeyboard(today: string, options: TCalendarPickerOptions, month: string): Promise<TReplyInlineKeyboard> {
    const monthStart = parse(`${month}-01`, DATE_FORMAT.DATE_MAIN, new Date())
    const dates = Array.from({ length: getDaysInMonth(monthStart) }, (_, i) => `${month}-${String(i + 1).padStart(2, '0')}`)
    const dayStates = await PickerItemHelper.resolve(options.resolveDays, dates)
    const title = TextHelper.capitalize(format(monthStart, 'LLLL yyyy', { locale: uk }))

    const { yearRange } = options
    const prevMonth = addMonths(monthStart, -1)
    const nextMonth = addMonths(monthStart, 1)
    const rows: InlineKeyboardButton[][] = [
      [
        !yearRange || prevMonth.getFullYear() >= yearRange.fromYear ? this.navButton('◀️', prevMonth) : this.noopButton(' '),
        // With a year range the title goes up to the year's months
        yearRange ? this.monthsButton(`${title} 🔼`, monthStart.getFullYear()) : this.noopButton(title),
        !yearRange || nextMonth.getFullYear() <= yearRange.toYear ? this.navButton('▶️', nextMonth) : this.noopButton(' '),
      ],
      WEEKDAYS.map((day) => this.noopButton(day)),
    ]

    // Monday-first grid: pad the first week up to the month's first weekday
    let week: InlineKeyboardButton[] = Array.from({ length: getISODay(monthStart) - 1 }, () => this.noopButton(' '))
    dates.forEach((date, index) => {
      const day = index + 1
      const dayButton: InlineKeyboardButton = {
        text: date === today ? `[${day}]` : String(day),
        callback_data: RegexHelper.createButtonActionCallbackData(PREFIX.DAY, date),
      }
      // Colours come only from the day states (e.g. trainer availability); today is shown by the brackets
      week.push(PickerItemHelper.apply(dayButton, dayStates[date]))
      if (week.length === WEEKDAYS.length) {
        rows.push(week)
        week = []
      }
    })
    if (week.length) {
      rows.push([...week, ...Array.from({ length: WEEKDAYS.length - week.length }, () => this.noopButton(' '))])
    }

    if (!options.withoutToday) {
      rows.push([{ text: '📅 Сьогодні', callback_data: RegexHelper.createButtonActionCallbackData(PREFIX.DAY, today) }])
    }

    return KeyboardHelper.createInlineKeyboard([...rows, ...this.footerRows(options)])
  }

  /** A year's 12 months (3 × 4); the title goes up to the page of years. */
  private static monthsKeyboard(options: TCalendarPickerOptions, year: number): TReplyInlineKeyboard {
    const range = options.yearRange!
    const rows: InlineKeyboardButton[][] = [
      [
        year > range.fromYear ? this.monthsButton('◀️', year - 1) : this.noopButton(' '),
        this.yearsButton(`${year} 🔼`, this.getYearsPageStart(year, range)),
        year < range.toYear ? this.monthsButton('▶️', year + 1) : this.noopButton(' '),
      ],
      ...this.chunk(
        MONTHS.map((name, index) => ({
          text: name,
          callback_data: RegexHelper.createButtonActionCallbackData(PREFIX.NAV, `${year}-${String(index + 1).padStart(2, '0')}`),
        })),
      ),
    ]
    return KeyboardHelper.createInlineKeyboard([...rows, ...this.footerRows(options)])
  }

  /** A page of up to 12 years (3 × 4) starting at `pageStart`, clipped to the range. */
  private static yearsKeyboard(options: TCalendarPickerOptions, pageStart: number): TReplyInlineKeyboard {
    const range = options.yearRange!
    const pageEnd = pageStart + YEARS_PER_PAGE - 1
    const years = Array.from({ length: YEARS_PER_PAGE }, (_, i) => pageStart + i).filter(
      (year) => year >= range.fromYear && year <= range.toYear,
    )
    const rows: InlineKeyboardButton[][] = [
      [
        pageStart > range.fromYear ? this.yearsButton('◀️', pageStart - YEARS_PER_PAGE) : this.noopButton(' '),
        this.noopButton(`${Math.max(pageStart, range.fromYear)}–${Math.min(pageEnd, range.toYear)}`),
        pageEnd < range.toYear ? this.yearsButton('▶️', pageStart + YEARS_PER_PAGE) : this.noopButton(' '),
      ],
      ...this.chunk(years.map((year) => this.monthsButton(String(year), year))),
    ]
    return KeyboardHelper.createInlineKeyboard([...rows, ...this.footerRows(options)])
  }

  /** Pages end at `toYear`, so the latest years are on the first page shown. */
  private static getYearsPageStart(year: number, range: { toYear: number }): number {
    return range.toYear - YEARS_PER_PAGE + 1 - Math.floor((range.toYear - year) / YEARS_PER_PAGE) * YEARS_PER_PAGE
  }

  private static footerRows(options: TCalendarPickerOptions): InlineKeyboardButton[][] {
    const rows: InlineKeyboardButton[][] = []
    if (options.withBackButton) {
      rows.push([{ text: BUTTON_PATTERNS.BACK, callback_data: PREFIX.PREVIOUS_STEP }])
    }
    if (options.withCloseButton) {
      rows.push([{ text: BUTTON_PATTERNS.CLOSE, callback_data: CALLBACK_DATA.CLOSE_MENU }])
    }
    return rows
  }

  private static chunk(buttons: InlineKeyboardButton[]): InlineKeyboardButton[][] {
    return Array.from({ length: Math.ceil(buttons.length / GRID_COLUMNS) }, (_, i) =>
      buttons.slice(i * GRID_COLUMNS, (i + 1) * GRID_COLUMNS),
    )
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
      await BotHelper.safeEditMessageReplyMarkup(ctx, (await this.keyboard(today, options, navMatch[0])).reply_markup)
      return { type: 'navigated' }
    }

    const yearRange = options.yearRange
    const yearsMatch = yearRange ? RegexHelper.getMatchValue(PREFIX.YEARS, textPayload) : null
    if (yearsMatch) {
      BotHelper.safeAnswerCbQuery(ctx)
      await BotHelper.safeEditMessageReplyMarkup(ctx, this.yearsKeyboard(options, Number(yearsMatch[0])).reply_markup)
      return { type: 'navigated' }
    }

    const monthsMatch = yearRange ? RegexHelper.getMatchValue(PREFIX.MONTHS, textPayload) : null
    if (monthsMatch) {
      BotHelper.safeAnswerCbQuery(ctx)
      await BotHelper.safeEditMessageReplyMarkup(ctx, this.monthsKeyboard(options, Number(monthsMatch[0])).reply_markup)
      return { type: 'navigated' }
    }

    const dayMatch = RegexHelper.getMatchValue(PREFIX.DAY, textPayload)
    if (dayMatch) {
      if (await PickerItemHelper.rejectIfDisabled(ctx, options.resolveDays, dayMatch[0])) {
        return { type: 'navigated' }
      }
      BotHelper.safeAnswerCbQuery(ctx)
      const date = format(parse(dayMatch[0], DATE_FORMAT.DATE_MAIN, new Date()), DATE_FORMAT.DATE_INPUT)
      return { type: 'selected', date }
    }

    return null
  }

  private static navButton(text: string, month: Date): InlineKeyboardButton {
    return { text, callback_data: RegexHelper.createButtonActionCallbackData(PREFIX.NAV, format(month, MONTH_FORMAT)) }
  }

  private static monthsButton(text: string, year: number): InlineKeyboardButton {
    return { text, callback_data: RegexHelper.createButtonActionCallbackData(PREFIX.MONTHS, String(year)) }
  }

  private static yearsButton(text: string, pageStart: number): InlineKeyboardButton {
    return { text, callback_data: RegexHelper.createButtonActionCallbackData(PREFIX.YEARS, String(pageStart)) }
  }

  private static noopButton(text: string): InlineKeyboardButton {
    return { text, callback_data: PREFIX.NOOP }
  }
}
