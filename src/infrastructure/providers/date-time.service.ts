import { add, format, startOfToday, subDays, addMonths, startOfMonth, endOfMonth, eachDayOfInterval, parse } from 'date-fns'
import { Inject, Injectable } from '@nestjs/common'
import { TypedConfigService } from '@app/infrastructure/config'
import { APP, DATE_FORMAT, TDateFormats } from '@app/libs'
import { TZDate, tz} from '@date-fns/tz'

export const DateTimeServiceInjector = () => Inject(APP.PROVIDERS.DATE_TIME_SERVICE)

@Injectable()
export class DateTimeService {
  constructor(private readonly configService: TypedConfigService) {}

  addDaysToDate(days: number, date: Date = new Date()): Date {
    return add(date, { days })
  }

  addMinutesToDate(minutes: number, date: Date = new Date()): Date {
    return add(date, { minutes })
  }

  addTimeToDate(date: Date, time: string): Date {
    const [hours, minutes] = time.split(':').map(Number)
    const newDate = new Date(date)
    newDate.setHours(hours, minutes)
    return newDate
  }

  formatDate(options: { date?: Date; dateFormat?: TDateFormats } = {}): string {
    const { date = new Date(), dateFormat = DATE_FORMAT.DATE_MAIN } = options
    return format(date, dateFormat)
  }

  parseAndFormatDate(options: { date: string; dateFormat?: TDateFormats, parseFormat?: TDateFormats }): string {
    const { date, dateFormat = DATE_FORMAT.DATE_MAIN, parseFormat = DATE_FORMAT.DATE_INPUT } = options
    const parsedDate = parse(date, parseFormat, new Date())
    return format(parsedDate, dateFormat)
  }

  getDateNDaysAgo(days: number, date?: Date): Date {
    const todayLocalMidnight = date ?? startOfToday()
    return subDays(todayLocalMidnight, days)
  }

  getLatestDate(date1: Date, date2: Date): Date {
    return date1 > date2 ? date1 : date2
  }

  getStartOfTodayDate(): Date {
    return startOfToday()
  }


  toUTCString(date: Date): string {
    return date.toUTCString()
  }

  getNextMonthDateInterval(): { start: Date; end: Date } {
    const nextMonth = addMonths(new Date (), 1)
    const startDate = startOfMonth(nextMonth)
    const endDate = endOfMonth(nextMonth)

    return { start: startDate, end: endDate }
  }

  getEachDayOfIntervalForDayIndex(options: {start: Date, end: Date}, dayIndex: number): Date[] {
    return eachDayOfInterval(options).filter((date) => date.getDay() === dayIndex)
  }
}
