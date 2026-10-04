import { addMinutes, format, parse } from 'date-fns'
import { formatInTimeZone, fromZonedTime } from 'date-fns-tz'
import type { TCalendarPickerOptions, TTimePickerOptions } from '@app/bot/menus'
import { TPickerItemState } from '@app/bot/libs'
import { DateTimeProvider } from '@app/infrastructure/providers'
import { DATE_FORMAT, TRAINING_CONFIG } from '@app/libs'

/** Something that occupies a trainer: starts at `start` (UTC ISO) and lasts TRAINING_CONFIG.DURATION_MINUTES. */
export type TBusyInterval = { start: string; label: string }
export type TBusyIntervalsLoader = (fromIso: string, toIso: string) => Promise<TBusyInterval[]>

// Telegram has no yellow style, so "partly busy" is blue
const PARTIAL_DAY_STATE: TPickerItemState = { style: 'primary' }

/**
 * Trainer availability for the date/time pickers. A new session (also DURATION_MINUTES long) conflicts with
 * a busy interval when the two overlap, so with a session at 16:30 the slots 15:45–17:15 are taken.
 */
export class StaffAvailabilityHelper {
  /** The busy interval a session starting at `startIso` would overlap, if any. */
  static findConflict(startIso: string, intervals: TBusyInterval[]): TBusyInterval | undefined {
    const start = new Date(startIso).getTime()
    const duration = TRAINING_CONFIG.DURATION_MINUTES * 60_000
    return intervals.find((interval) => {
      const busyStart = new Date(interval.start).getTime()
      return start < busyStart + duration && busyStart < start + duration
    })
  }

  /** "Група Jazz-Funk 16+ 16:30–17:30" in the studio time zone. */
  static describe(interval: TBusyInterval, dateTimeProvider: DateTimeProvider): string {
    const start = new Date(interval.start)
    const timeZone = dateTimeProvider.time_zone
    const from = formatInTimeZone(start, timeZone, DATE_FORMAT.TIME_MAIN)
    const to = formatInTimeZone(addMinutes(start, TRAINING_CONFIG.DURATION_MINUTES), timeZone, DATE_FORMAT.TIME_MAIN)
    return `${interval.label} ${from}–${to}`
  }

  /** Days (yyyy-MM-dd) with anything busy are blue: partly taken, still pickable. */
  static getDayStates(dates: string[], intervals: TBusyInterval[], dateTimeProvider: DateTimeProvider) {
    const busyDates = new Set(
      intervals.map((interval) => formatInTimeZone(new Date(interval.start), dateTimeProvider.time_zone, DATE_FORMAT.DATE_MAIN)),
    )
    return Object.fromEntries(dates.map((date) => [date, busyDates.has(date) ? PARTIAL_DAY_STATE : undefined]))
  }

  /** Time slots (HH:mm) on `date` (yyyy-MM-dd) that would overlap a busy interval: red and disabled, with the reason. */
  static getTimeStates(date: string, times: string[], intervals: TBusyInterval[], dateTimeProvider: DateTimeProvider) {
    return Object.fromEntries(
      times.map((time) => {
        const conflict = this.findConflict(this.toUtcIso(date, time, dateTimeProvider), intervals)
        const state: TPickerItemState | undefined = conflict
          ? { style: 'danger', disabled: true, reason: `⛔️ У тренера ${this.describe(conflict, dateTimeProvider)}` }
          : undefined
        return [time, state]
      }),
    )
  }

  /** Calendar options marking the trainer's busy days; `base` keeps the other options (e.g. withBackButton). */
  static calendarOptions(
    loadIntervals: TBusyIntervalsLoader,
    dateTimeProvider: DateTimeProvider,
    base: TCalendarPickerOptions = {},
  ): TCalendarPickerOptions {
    return {
      ...base,
      resolveDays: async (dates) => {
        const intervals = await loadIntervals(...this.getRange(dates[0], dates[dates.length - 1], dateTimeProvider))
        return this.getDayStates(dates, intervals, dateTimeProvider)
      },
    }
  }

  /** Time options disabling the trainer's busy slots on `date` (DATE_FORMAT.DATE_INPUT, as the scenes store it). */
  static timeOptions(
    loadIntervals: TBusyIntervalsLoader,
    date: string,
    dateTimeProvider: DateTimeProvider,
    base: TTimePickerOptions = {},
  ): TTimePickerOptions {
    const day = format(parse(date, DATE_FORMAT.DATE_INPUT, new Date()), DATE_FORMAT.DATE_MAIN)
    return {
      ...base,
      resolveTimes: async (times) => {
        const intervals = await loadIntervals(...this.getRange(day, day, dateTimeProvider))
        return this.getTimeStates(day, times, intervals, dateTimeProvider)
      },
    }
  }

  /** Warning for the confirm step when a session at `scheduledAt` overlaps something (typed time or a parallel registration). */
  static async getConflictWarning(loadIntervals: TBusyIntervalsLoader, scheduledAt: string, dateTimeProvider: DateTimeProvider) {
    const start = new Date(scheduledAt)
    const intervals = await loadIntervals(
      addMinutes(start, -TRAINING_CONFIG.DURATION_MINUTES).toISOString(),
      addMinutes(start, TRAINING_CONFIG.DURATION_MINUTES).toISOString(),
    )
    const conflict = this.findConflict(scheduledAt, intervals)
    return conflict ? `\n\n⚠️ <b>У тренера в цей час: ${this.describe(conflict, dateTimeProvider)}.</b> Перевірте перед підтвердженням.` : ''
  }

  /** UTC range covering whole studio-local days, widened by one duration so sessions running into the first day count. */
  private static getRange(firstDay: string, lastDay: string, dateTimeProvider: DateTimeProvider): [string, string] {
    const from = addMinutes(new Date(this.toUtcIso(firstDay, '00:00', dateTimeProvider)), -TRAINING_CONFIG.DURATION_MINUTES)
    const to = new Date(this.toUtcIso(lastDay, '23:59', dateTimeProvider))
    return [from.toISOString(), to.toISOString()]
  }

  private static toUtcIso(date: string, time: string, dateTimeProvider: DateTimeProvider): string {
    return fromZonedTime(`${date}T${time}:00`, dateTimeProvider.time_zone).toISOString()
  }
}
