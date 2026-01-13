import { TypedConfigService } from '@app/infrastructure/config'
import { APP, DATE_FORMAT, TDateFormats } from '@app/libs'
import { Inject, Injectable } from '@nestjs/common'
import {
  addMonths,
  differenceInYears,
  eachDayOfInterval,
  endOfDay,
  endOfMonth,
  format,
  parse,
  isBefore,
  isAfter,
  startOfDay,
  startOfMonth,
} from 'date-fns'
import { formatInTimeZone, fromZonedTime } from 'date-fns-tz'
import { uk } from 'date-fns/locale'

export const DateTimeProviderInjector = () => Inject(APP.PROVIDERS.DATE_TIME_PROVIDER)

@Injectable()
export class DateTimeProvider {
  public readonly time_zone: string
  constructor(private readonly configService: TypedConfigService) {
    this.time_zone = this.configService.get('TIME_ZONE')
  }

  toUtcString(dateString: string): string {
    return `${dateString}Z`
  }

  addTimeToDate(date: Date, time: string): Date {
    const [hours, minutes] = time.split(':').map(Number)
    const newDate = new Date(date)
    newDate.setHours(hours, minutes)
    return newDate
  }

  formatDate(options: { date?: Date | string; dateFormat?: TDateFormats } = {}): string {
    const { date = new Date(), dateFormat = DATE_FORMAT.DATE_MAIN } = options
    return format(date, dateFormat)
  }

  endOfDay(date: Date = new Date()): Date {
    return endOfDay(date)
  }

  roundToHours(date?: string): Date {
    const newDate = date ? new Date(date) : new Date()
    newDate.setMinutes(0, 0, 0)
    return newDate
  }

  formatDateStringInTz(dateString: string, dateFormat: TDateFormats): string {
    return formatInTimeZone(dateString, this.time_zone, dateFormat, { locale: uk })
  }

  getUtcString(date: Date = new Date()): string {
    return date.toISOString()
  }

  getUtcStringTz(date: Date = new Date()): string {
    //from zoned time assumes it gets feed a local date in specified timezone
    //so its valid for creating training record with some local time like 18:00 and that 18:00 will be assumed in specified timezone not a server timezone
    return fromZonedTime(date, this.time_zone).toISOString()
  }

  parseAndFormatDate(options: { date: string; outputDateFormat?: TDateFormats; inputDateFormat?: TDateFormats }): string {
    const { date, outputDateFormat = DATE_FORMAT.DATE_MAIN, inputDateFormat = DATE_FORMAT.DATE_INPUT } = options
    const parsedDate = parse(date, inputDateFormat, new Date())
    return format(parsedDate, outputDateFormat)
  }

  getNextTwoMonthDateInterval(): { start: Date; end: Date } {
    const currMonth = addMonths(fromZonedTime(new Date(), this.time_zone), 0)
    const nextMonth = addMonths(fromZonedTime(new Date(), this.time_zone), 1)
    const startDate = startOfMonth(currMonth)
    const endDate = endOfMonth(nextMonth)

    return { start: startDate, end: endDate }
  }

  getEachDayOfIntervalForDayIndex(options: { start: Date; end: Date }, dayIndex: number): Date[] {
    return eachDayOfInterval(options).filter((date) => date.getDay() === dayIndex)
  }

  getAgeFromBirthday(dateOfBirth: Date | string): number {
    const birthDate = new Date(dateOfBirth)
    const now = new Date()
    return differenceInYears(now, birthDate)
  }

  toEndOfDateTimeStamp(date?: string): string {
    const endOfDate = date ? endOfDay(new Date(date)) : endOfDay(new Date())
    return endOfDate.toISOString()
  }

  toStartOfDateTimeStamp(date?: string): string {
    const startOfDate = date ? startOfDay(new Date(date)) : startOfDay(new Date())
    return startOfDate.toISOString()
  }

  getTodayDateStringInTz(format: string = DATE_FORMAT.DATE_INPUT): string {
    return this.formatDateStringInTz(new Date().toISOString(), format)
  }

  isBefore(date1: Date | string, date2: Date | string): boolean {
    const d1 = typeof date1 === 'string' ? new Date(date1) : date1
    const d2 = typeof date2 === 'string' ? new Date(date2) : date2
    return isBefore(d1, d2)
  }

  isAfter(date1: Date | string, date2: Date | string): boolean {
    const d1 = typeof date1 === 'string' ? new Date(date1) : date1
    const d2 = typeof date2 === 'string' ? new Date(date2) : date2
    return isAfter(d1, d2)
  }
}

//fromZonedTime()	Бере локальний час в заданій зоні, і перетворює в UTC
//toZonedTime()	Бере UTC-дату і показує, як вона виглядає в іншому часовому поясі
