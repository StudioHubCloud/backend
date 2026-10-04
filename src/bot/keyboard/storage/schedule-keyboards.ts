import { InlineKeyboardButton } from '@telegraf/types'
import { addDays, format, parse } from 'date-fns'
import { KeyboardHelper, PersonalTrainingHelper, RegexHelper, ScheduleHelper } from '@app/bot/helpers'
import type { TScheduleItem } from '@app/bot/helpers'
import { CALLBACK_PREFIX, TReplyInlineKeyboard } from '@app/bot/libs'
import { BUTTON_PATTERNS } from '@app/bot/static/button-patterns'
import { PersonalTrainingSignupSelectModel } from '@app/infrastructure/database'
import { DateTimeProvider } from '@app/infrastructure/providers'
import { DATE_FORMAT, PersonalTrainingSignupStatusEnum } from '@app/libs'
import { COMMON_BUTTONS } from './common-keyboards'
import { CurrentSessionKeyboards } from './current-session-keyboards'

const PREFIX = CALLBACK_PREFIX.STAFF.SCHEDULE
const ITEMS_PER_ROW = 3
const MAX_PARTICIPANTS_LENGTH = 30

/** "📅 Розклад студії": the day timeline → group menu / session menu. Dates are yyyy-MM-dd (studio time zone). */
export class ScheduleKeyboards {
  /**
   * The day's items (a group training → that training's menu, an individual session → its menu): one row per group style
   * (the same direction at different hours, up to ITEMS_PER_ROW) in time order, then one row per individual session
   * in time order; then ◀️ previous day · Сьогодні · next day ▶️, "📅 Обрати дату" and "✖️ Закрити" (a root menu).
   */
  static day(date: string, items: TScheduleItem[], dateTimeProvider: DateTimeProvider): TReplyInlineKeyboard {
    // Items are already in time order, so a Map keeps the rows ordered by each style's first item
    const groupButtonsByStyle = new Map<number, InlineKeyboardButton[]>()
    const sessionRows: InlineKeyboardButton[][] = []

    for (const item of items) {
      const time = dateTimeProvider.formatDateStringInTz(item.start, DATE_FORMAT.TIME_MAIN)
      if (item.training) {
        // This training's menu (not the group's): the date is already chosen. The schedule origin travels with it,
        // so its "Назад" (and every action in it) leads back to this day
        const button: InlineKeyboardButton = {
          // The group name's own schedule "(Пн/Чт 17:00)" is dropped: the time is already there
          text: `${item.training.isCancelled ? '❌ ' : ''}${time} ${item.training.group.name.replace(/\s*\([^)]*\)\s*$/, '')}`,
          callback_data: RegexHelper.createButtonActionCallbackData(CALLBACK_PREFIX.STAFF.TRAINING.BACK_TO_MANAGE, item.training.id, this.toOrigin(date)),
        }
        const styleId = item.training.group.groupStyleId
        // Sessions in colour, navigation and actions plain; a cancelled training stays plain
        const styled = item.training.isCancelled ? button : KeyboardHelper.withStyle(button, 'primary')
        groupButtonsByStyle.set(styleId, [...(groupButtonsByStyle.get(styleId) ?? []), styled])
      } else {
        // Full width: the title and participants don't fit a third of a row (a one-off's note can be long)
        const participants = PersonalTrainingHelper.getSessionParticipants(item.session)
        const shortParticipants = participants.length > MAX_PARTICIPANTS_LENGTH ? `${participants.slice(0, MAX_PARTICIPANTS_LENGTH - 1)}…` : participants
        sessionRows.push([
          KeyboardHelper.withStyle(
            {
              text: `🤝 ${time} ${PersonalTrainingHelper.getSessionTitle(item.session)} · ${shortParticipants}`,
              callback_data: RegexHelper.createButtonActionCallbackData(PREFIX.PERSONAL, item.session.id),
            },
            'primary',
          ),
        ])
      }
    }

    const rows: InlineKeyboardButton[][] = []
    for (const buttons of groupButtonsByStyle.values()) {
      for (let i = 0; i < buttons.length; i += ITEMS_PER_ROW) {
        rows.push(buttons.slice(i, i + ITEMS_PER_ROW))
      }
    }
    rows.push(...sessionRows)

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
    return { text: BUTTON_PATTERNS.BACK, callback_data: RegexHelper.createButtonActionCallbackData(PREFIX.DAY, date) }
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

  /** Back to the day for a flow opened from the schedule, undefined otherwise (the menu keeps its own back button). */
  static backButtonForOrigin(value?: string | null): InlineKeyboardButton | undefined {
    const date = this.parseOrigin(value)
    return date ? this.backToDayButton(date) : undefined
  }

  /**
   * One session, until it is paid out: confirm (admins and the session's trainer), edit the note (one-offs only) and
   * cancel (scheduled, before the start; maintainers any time) for admins; back to the day's list.
   */
  static session(
    session: PersonalTrainingSignupSelectModel,
    dateTimeProvider: DateTimeProvider,
    options: { canManage: boolean; canConfirm: boolean; isMaintainer: boolean },
  ): TReplyInlineKeyboard {
    const date = dateTimeProvider.formatDateStringInTz(session.scheduledAt, DATE_FORMAT.DATE_MAIN)
    const rows: InlineKeyboardButton[][] = []
    const isOpen = !session.staffMemberPayoutId

    if (options.canConfirm) {
      rows.push(...CurrentSessionKeyboards.confirmRows(session, true))
    }
    if (options.canManage && isOpen && session.studioPriceId) {
      rows.push([{ text: BUTTON_PATTERNS.EDIT_NOTE, callback_data: RegexHelper.createButtonActionCallbackData(PREFIX.PERSONAL_NOTE, session.id) }])
    }
    // Before the start (a maintainer: any time), see PersonalTrainingHelper.canCancel
    const canCancel = options.isMaintainer || new Date(session.scheduledAt).getTime() > Date.now()
    if (options.canManage && isOpen && canCancel && session.status === PersonalTrainingSignupStatusEnum.SCHEDULED) {
      rows.push([{ text: BUTTON_PATTERNS.CANCEL_PERSONAL_TRAINING, callback_data: RegexHelper.createButtonActionCallbackData(PREFIX.PERSONAL_CANCEL, session.id) }])
    }
    rows.push([{ text: BUTTON_PATTERNS.BACK, callback_data: RegexHelper.createButtonActionCallbackData(PREFIX.DAY, date) }])
    rows.push([COMMON_BUTTONS.CLOSE])

    return KeyboardHelper.createInlineKeyboard(rows)
  }
}
