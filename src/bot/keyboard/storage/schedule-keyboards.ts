import { InlineKeyboardButton } from '@telegraf/types'
import { addDays, format, parse } from 'date-fns'
import { KeyboardHelper, PersonalTrainingHelper, RegexHelper, ScheduleHelper } from '@app/bot/helpers'
import type { TScheduleItem } from '@app/bot/helpers'
import { CALLBACK_PREFIX, TReplyInlineKeyboard } from '@app/bot/libs'
import { BUTTON_PATTERNS } from '@app/bot/static/button-patterns'
import { PersonalTrainingSignupSelectModel } from '@app/infrastructure/database'
import { DateTimeProvider } from '@app/infrastructure/providers'
import { DATE_FORMAT } from '@app/libs'
import { COMMON_BUTTONS } from './common-keyboards'

const PREFIX = CALLBACK_PREFIX.STAFF.SCHEDULE
const ITEMS_PER_ROW = 3

/** "📅 Розклад студії": the day timeline → group menu / session menu. Dates are yyyy-MM-dd (studio time zone). */
export class ScheduleKeyboards {
  /**
   * The day's items (a group → its group menu, an individual session → its menu): one row per group style
   * (the same direction at different hours, up to ITEMS_PER_ROW), individual sessions in their own rows,
   * rows in time order; then ◀️ previous day · Сьогодні · next day ▶️, "📅 Обрати дату" and "✖️ Закрити" (a root menu).
   */
  static day(date: string, items: TScheduleItem[], dateTimeProvider: DateTimeProvider): TReplyInlineKeyboard {
    // Items are already in time order, so a Map keeps the rows ordered by each style's first item
    const buttonsByRow = new Map<string, InlineKeyboardButton[]>()

    for (const item of items) {
      const time = dateTimeProvider.formatDateStringInTz(item.start, DATE_FORMAT.TIME_MAIN)
      const [rowKey, button]: [string, InlineKeyboardButton] = item.training
        ? [
            `style:${item.training.group.groupStyleId}`,
            {
              // The group name's own schedule "(Пн/Чт 17:00)" is dropped: the time is already there
              text: `${item.training.isCancelled ? '❌ ' : ''}${time} ${item.training.group.name.replace(/\s*\([^)]*\)\s*$/, '')}`,
              callback_data: RegexHelper.createButtonActionCallbackData(PREFIX.GROUP, item.training.groupId, date),
            },
          ]
        : [
            'personal',
            {
              text: `🤝 ${time} ${PersonalTrainingHelper.getSessionTitle(item.session)}`,
              callback_data: RegexHelper.createButtonActionCallbackData(PREFIX.PERSONAL, item.session.id),
            },
          ]
      buttonsByRow.set(rowKey, [...(buttonsByRow.get(rowKey) ?? []), button])
    }

    const rows: InlineKeyboardButton[][] = []
    for (const buttons of buttonsByRow.values()) {
      for (let i = 0; i < buttons.length; i += ITEMS_PER_ROW) {
        rows.push(buttons.slice(i, i + ITEMS_PER_ROW))
      }
    }

    const day = parse(date, DATE_FORMAT.DATE_MAIN, new Date())
    const previousDay = format(addDays(day, -1), DATE_FORMAT.DATE_MAIN)
    const nextDay = format(addDays(day, 1), DATE_FORMAT.DATE_MAIN)
    const today = dateTimeProvider.getTodayDateStringInTz(DATE_FORMAT.DATE_MAIN)

    rows.push([
      { text: `◀️ ${ScheduleHelper.getShortDate(previousDay)}`, callback_data: RegexHelper.createButtonActionCallbackData(PREFIX.DAY, previousDay) },
      { text: 'Сьогодні', callback_data: RegexHelper.createButtonActionCallbackData(PREFIX.DAY, today) },
      { text: `${ScheduleHelper.getShortDate(nextDay)} ▶️`, callback_data: RegexHelper.createButtonActionCallbackData(PREFIX.DAY, nextDay) },
    ])
    rows.push([{ text: '📅 Обрати дату', callback_data: RegexHelper.createButtonActionCallbackData(PREFIX.CALENDAR, date.slice(0, 7)) }])
    rows.push([COMMON_BUTTONS.CLOSE])

    return KeyboardHelper.createInlineKeyboard(rows)
  }

  /** "⬅️ Назад до дня" that replaces "Назад до списку груп" in the group menu opened from the schedule. */
  static backToDayButton(date: string): InlineKeyboardButton {
    return { text: '⬅️ Назад до дня', callback_data: RegexHelper.createButtonActionCallbackData(PREFIX.DAY, date) }
  }

  /**
   * Marks a group → trainings → training flow opened from a schedule day ("sd2026-10-04"). It travels in the callback
   * slot that otherwise carries staffUserId ("Персонал" → trainer → groups), so every "Назад" in that flow keeps it.
   */
  static toOrigin(date: string): string {
    return `sd${date}`
  }

  /** The day (yyyy-MM-dd) of a schedule origin, or null for anything else (e.g. a staff user id). */
  static parseOrigin(value?: string | null): string | null {
    return value?.match(/^sd(\d{4}-\d{2}-\d{2})$/)?.[1] ?? null
  }

  /** "Назад до дня" for a flow opened from the schedule, undefined otherwise (the menu keeps its own back button). */
  static backButtonForOrigin(value?: string | null): InlineKeyboardButton | undefined {
    const date = this.parseOrigin(value)
    return date ? this.backToDayButton(date) : undefined
  }

  /** One session: edit the note (one-offs only) and cancel for admins (read-only for trainers), back to the day's list. */
  static session(session: PersonalTrainingSignupSelectModel, dateTimeProvider: DateTimeProvider, canManage: boolean): TReplyInlineKeyboard {
    const date = dateTimeProvider.formatDateStringInTz(session.scheduledAt, DATE_FORMAT.DATE_MAIN)
    const rows: InlineKeyboardButton[][] = []

    if (canManage && session.studioPriceId) {
      rows.push([{ text: BUTTON_PATTERNS.EDIT_NOTE, callback_data: RegexHelper.createButtonActionCallbackData(PREFIX.PERSONAL_NOTE, session.id) }])
    }
    if (canManage) {
      rows.push([{ text: BUTTON_PATTERNS.CANCEL_PERSONAL_TRAINING, callback_data: RegexHelper.createButtonActionCallbackData(PREFIX.PERSONAL_CANCEL, session.id) }])
    }
    rows.push([{ text: '⬅️ Назад до дня', callback_data: RegexHelper.createButtonActionCallbackData(PREFIX.DAY, date) }])
    rows.push([COMMON_BUTTONS.CLOSE])

    return KeyboardHelper.createInlineKeyboard(rows)
  }
}
