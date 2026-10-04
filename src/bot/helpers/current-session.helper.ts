import { TrainingSignupSelectModel, UserProfileSelectModel } from '@app/infrastructure/database'
import { DateTimeProvider } from '@app/infrastructure/providers'
import { DATE_FORMAT, TRAINING_CONFIG } from '@app/libs'
import { TextHelper } from './text.helper'
import { UserHelper } from './user.helper'
import { PersonalTrainingHelper } from './personal-training.helper'
import type { TScheduleItem, TScheduleSession, TScheduleTraining } from './schedule.helper'

const MINUTE_MS = 60 * 1000

export type TAttendanceSignup = TrainingSignupSelectModel & { userProfile: UserProfileSelectModel | null }

/**
 * "⏱ Поточне заняття": which session to open and its texts. Sessions last TRAINING_CONFIG.DURATION_MINUTES; from
 * CONFIRM_LEAD_MINUTES before a start the next session takes over, so with back-to-back sessions (18:00, 19:00)
 * 18:00 is shown until 18:30 and 19:00 from then on (◀️ / ▶️ still reach both).
 */
export class CurrentSessionHelper {
  /** A not cancelled group training or a not cancelled individual session, by id, for callbacks. */
  static getItemKey(item: TScheduleItem): string {
    return item.training ? `t${item.training.id}` : `s${item.session.id}`
  }

  /**
   * The current session: the next one if it starts within the lead time, else the running one, else the next one.
   * Items must be in time order: a trainer's own, or the whole studio's for admins (one hall, no parallel sessions).
   */
  static pick(items: TScheduleItem[], now = Date.now()): TScheduleItem | null {
    const { soon, running, upcoming } = this.split(items, now)
    return soon[0] ?? running.at(-1) ?? upcoming[0] ?? null
  }

  /** The items before and after `key` in time order, for ◀️ / ▶️. */
  static getNeighbours(items: TScheduleItem[], key: string): { previous?: TScheduleItem; next?: TScheduleItem } {
    const index = items.findIndex((item) => this.getItemKey(item) === key)
    return index < 0 ? {} : { previous: items[index - 1], next: items[index + 1] }
  }

  /** Attendance can be confirmed from CONFIRM_LEAD_MINUTES before the start (until the trainer is paid). */
  static canConfirmYet(start: string, now = Date.now()): boolean {
    return new Date(start).getTime() - now <= TRAINING_CONFIG.CONFIRM_LEAD_MINUTES * MINUTE_MS
  }

  /** The training's trainer for this date: the substitute if any, else the group's trainer. */
  static getTrainerStaffMemberId(training: { trainerId: string | null; group: { staffMemberId: string | null } }): string | null {
    return training.trainerId ?? training.group.staffMemberId
  }

  static getTrainingMessage(
    training: TScheduleTraining,
    signups: TAttendanceSignup[],
    dateTimeProvider: DateTimeProvider,
    now = Date.now(),
  ): string {
    const confirmed = signups.filter((signup) => signup.confirmedAt).length
    const lines = [
      `⏱ ${TextHelper.bold('Поточне заняття')}`,
      '',
      `👯‍♀️ ${TextHelper.bold(TextHelper.escapeHtml(training.group.name))}`,
      `🗓 ${this.formatStart(training.date, dateTimeProvider)}`,
      `👤 Тренер: ${this.getTrainerName(training.trainer ?? training.group.trainer)}`,
      '',
      // String(): TextHelper.bold drops a falsy 0
      signups.length ? `✅ Підтверджено: ${TextHelper.bold(String(confirmed))} з ${signups.length}` : '<i>Записів немає</i>',
    ]

    const hint = this.getLockHint(training.date, !!training.staffMemberPayoutId, 'присутність', dateTimeProvider, now)
    // A blank line sets the hint apart from the counts
    if (hint) {
      lines.push('', hint)
    } else if (signups.length) {
      lines.push('', '<i>Натисніть на людину: 🟢 є на занятті, ще раз — зняти відмітку</i>')
    }

    return lines.join('\n')
  }

  static getSessionMessage(session: TScheduleSession, dateTimeProvider: DateTimeProvider, now = Date.now()): string {
    const participantsLabel = session.participantsNote ? 'Нотатка' : 'Клієнт'
    const lines = [
      `⏱ ${TextHelper.bold('Поточне заняття')}`,
      '',
      `🤝 ${TextHelper.bold(TextHelper.escapeHtml(PersonalTrainingHelper.getSessionTitle(session)))}`,
      `🗓 ${this.formatStart(session.scheduledAt, dateTimeProvider)}`,
      `${PersonalTrainingHelper.getSessionParticipantsIcon(session)} ${participantsLabel}: ${TextHelper.escapeHtml(PersonalTrainingHelper.getSessionParticipants(session))}`,
      `👤 Тренер: ${this.getTrainerName(session.staffMember)}`,
      '',
      `Статус: ${PersonalTrainingHelper.getStatusLabel(session.status, !!session.staffMemberPayoutId)}`,
    ]

    const hint = this.getLockHint(session.scheduledAt, !!session.staffMemberPayoutId, 'заняття', dateTimeProvider, now)
    if (hint) {
      lines.push('', hint)
    }

    return lines.join('\n')
  }

  static getEmptyMessage(): string {
    return `⏱ ${TextHelper.bold('Поточне заняття')}\n\n<i>Найближчих занять немає</i>`
  }

  static getSignupName(signup: TAttendanceSignup): string {
    return UserHelper.getSignupDisplayName(signup)
  }

  private static split(items: TScheduleItem[], now: number) {
    const durationMs = TRAINING_CONFIG.DURATION_MINUTES * MINUTE_MS
    const leadMs = TRAINING_CONFIG.CONFIRM_LEAD_MINUTES * MINUTE_MS
    const startOf = (item: TScheduleItem) => new Date(item.start).getTime()

    return {
      soon: items.filter((item) => startOf(item) > now && startOf(item) - now <= leadMs),
      running: items.filter((item) => startOf(item) <= now && now < startOf(item) + durationMs),
      upcoming: items.filter((item) => startOf(item) > now),
    }
  }

  /** `what`: what gets confirmed, "присутність" (group) or "заняття" (individual), so the hint isn't ambiguous. */
  private static getLockHint(start: string, isPaidOut: boolean, what: string, dateTimeProvider: DateTimeProvider, now: number): string | null {
    if (isPaidOut) {
      return '🔒 <i>Заняття вже включене у виплату тренеру — зміни заборонені</i>'
    }
    if (!this.canConfirmYet(start, now)) {
      const from = new Date(new Date(start).getTime() - TRAINING_CONFIG.CONFIRM_LEAD_MINUTES * MINUTE_MS).toISOString()
      return `<i>Підтвердити ${what} можна з ${dateTimeProvider.formatDateStringInTz(from, DATE_FORMAT.TIME_MAIN)} (за ${TRAINING_CONFIG.CONFIRM_LEAD_MINUTES} хв до початку)</i>`
    }
    return null
  }

  /** "Неділя, 4 жовтня, 18:00". */
  private static formatStart(start: string, dateTimeProvider: DateTimeProvider): string {
    return TextHelper.capitalize(dateTimeProvider.formatDateStringInTz(start, DATE_FORMAT.TRAINING_DISPLAY))
  }

  private static getTrainerName(trainer: { userProfile: UserProfileSelectModel | null } | null): string {
    const userProfile = trainer?.userProfile ?? null
    return TextHelper.escapeHtml(userProfile?.firstName || UserHelper.getDisplayName(userProfile))
  }
}
