import { InlineKeyboardButton } from '@telegraf/types'
import { CurrentSessionHelper, KeyboardHelper, RegexHelper } from '@app/bot/helpers'
import type { TAttendanceSignup, TScheduleItem } from '@app/bot/helpers'
import { CALLBACK_PREFIX, TReplyInlineKeyboard } from '@app/bot/libs'
import { DateTimeProvider } from '@app/infrastructure/providers'
import { DATE_FORMAT, PersonalTrainingSignupStatusEnum } from '@app/libs'
import { COMMON_BUTTONS } from './common-keyboards'

const PREFIX = CALLBACK_PREFIX.STAFF.CURRENT
const MAX_NAME_LENGTH = 40 // one person per row, full width
export const NEW_MESSAGE = 'n' // subvalue of TRAINING / SESSION: reply with a new message instead of editing
export const FROM_CARD = 's' // CONFIRM code suffix: tapped in the schedule's session card, redraw that card

type TNeighbours = { previous?: TScheduleItem; next?: TScheduleItem }

/** "⏱ Поточне заняття": people of a group training (🔴 / 🟢), an individual session's confirmation, ◀️ / ▶️. */
export class CurrentSessionKeyboards {
  /** One button per person: 🔴 not confirmed yet, 🟢 came (✅ too, for clients without button colours). */
  static training(
    trainingId: number,
    signups: TAttendanceSignup[],
    neighbours: TNeighbours,
    options: { isAdmin: boolean; isPaidOut: boolean },
    dateTimeProvider: DateTimeProvider,
  ): TReplyInlineKeyboard {
    const rows: InlineKeyboardButton[][] = signups.map((signup) => {
      const name = CurrentSessionHelper.getSignupName(signup)
      const shortName = name.length > MAX_NAME_LENGTH ? `${name.slice(0, MAX_NAME_LENGTH - 1)}…` : name
      const button = {
        text: signup.confirmedAt ? `✅ ${shortName}` : shortName,
        callback_data: RegexHelper.createButtonActionCallbackData(PREFIX.ATTENDANCE, signup.id, signup.confirmedAt ? 0 : 1),
      }
      return [KeyboardHelper.withStyle(button, signup.confirmedAt ? 'success' : 'danger')]
    })

    if (options.isAdmin && !options.isPaidOut) {
      rows.push([{ text: '➕ Разовий відвідувач', callback_data: RegexHelper.createButtonActionCallbackData(PREFIX.ADD_VISITOR, trainingId) }])
    }

    const refresh = RegexHelper.createButtonActionCallbackData(PREFIX.TRAINING, trainingId)
    return this.withFooter(rows, refresh, neighbours, dateTimeProvider)
  }

  /** ✅ Відбулося / 🚫 Неявка for a scheduled session, "↩️ Змінити статус" for a confirmed one (until paid out). */
  static session(
    session: { id: string; status: PersonalTrainingSignupStatusEnum; staffMemberPayoutId: string | null },
    neighbours: TNeighbours,
    dateTimeProvider: DateTimeProvider,
  ): TReplyInlineKeyboard {
    const rows = this.confirmRows(session)
    const refresh = RegexHelper.createButtonActionCallbackData(PREFIX.SESSION, session.id)
    return this.withFooter(rows, refresh, neighbours, dateTimeProvider)
  }

  /**
   * ✅ Відбулося / 🚫 Неявка for a scheduled session, "↩️ Змінити статус" for a confirmed one; nothing once paid out.
   * `inScheduleCard`: the buttons sit in the schedule's session card, which is redrawn after a tap (code + FROM_CARD).
   */
  static confirmRows(
    session: { id: string; status: PersonalTrainingSignupStatusEnum; staffMemberPayoutId: string | null },
    inScheduleCard = false,
  ): InlineKeyboardButton[][] {
    if (session.staffMemberPayoutId) {
      return []
    }
    const confirm = (code: 'c' | 'n' | 'u') =>
      RegexHelper.createButtonActionCallbackData(PREFIX.CONFIRM, session.id, inScheduleCard ? `${code}${FROM_CARD}` : code)

    return session.status === PersonalTrainingSignupStatusEnum.SCHEDULED
      ? [
          [
            KeyboardHelper.withStyle({ text: '✅ Відбулося', callback_data: confirm('c') }, 'success'),
            KeyboardHelper.withStyle({ text: '🚫 Неявка', callback_data: confirm('n') }, 'danger'),
          ],
        ]
      : [[{ text: '↩️ Змінити статус', callback_data: confirm('u') }]] // back to pending: both choices again
  }

  /**
   * "☑️ Відмітити присутніх" in a training's menu: opens the same view as "⏱ Поточне заняття" (the people don't fit the
   * menu), as a new message so the menu stays. ✅ is for results only, never for a button that asks to act.
   */
  static openTrainingButton(trainingId: number): InlineKeyboardButton {
    return { text: '☑️ Відмітити присутніх', callback_data: RegexHelper.createButtonActionCallbackData(PREFIX.TRAINING, trainingId, NEW_MESSAGE) }
  }

  static empty(): TReplyInlineKeyboard {
    return KeyboardHelper.createInlineKeyboard([[COMMON_BUTTONS.CLOSE]])
  }

  /** "⬅️ До заняття" after adding a one-time visitor in the scene. */
  static backToTraining(trainingId: number): TReplyInlineKeyboard {
    return KeyboardHelper.createInlineKeyboard([
      [{ text: '⬅️ До заняття', callback_data: RegexHelper.createButtonActionCallbackData(PREFIX.TRAINING, trainingId) }],
    ])
  }

  /** ◀️ previous · 🔄 · next ▶️ and "✖️ Закрити" (a root menu). */
  private static withFooter(
    rows: InlineKeyboardButton[][],
    refreshCallbackData: string,
    neighbours: TNeighbours,
    dateTimeProvider: DateTimeProvider,
  ): TReplyInlineKeyboard {
    const navigation: InlineKeyboardButton[] = []
    if (neighbours.previous) {
      navigation.push({ text: `◀️ ${this.getShortStart(neighbours.previous, dateTimeProvider)}`, callback_data: this.openItem(neighbours.previous) })
    }
    navigation.push({ text: '🔄', callback_data: refreshCallbackData })
    if (neighbours.next) {
      navigation.push({ text: `${this.getShortStart(neighbours.next, dateTimeProvider)} ▶️`, callback_data: this.openItem(neighbours.next) })
    }
    rows.push(navigation)
    rows.push([COMMON_BUTTONS.CLOSE])

    return KeyboardHelper.createInlineKeyboard(rows)
  }

  private static openItem(item: TScheduleItem): string {
    return item.training
      ? RegexHelper.createButtonActionCallbackData(PREFIX.TRAINING, item.training.id)
      : RegexHelper.createButtonActionCallbackData(PREFIX.SESSION, item.session.id)
  }

  /** "нд 19:00" for ◀️ / ▶️ (the day too: the neighbour may be on another day). */
  private static getShortStart(item: TScheduleItem, dateTimeProvider: DateTimeProvider): string {
    const time = dateTimeProvider.formatDateStringInTz(item.start, DATE_FORMAT.TIME_MAIN)
    const day = dateTimeProvider.formatDateStringInTz(item.start, 'EEEEEE')
    return `${day} ${time}`
  }
}
