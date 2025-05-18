import { Inject, Injectable } from '@nestjs/common'
import { format, addMonths, startOfMonth, endOfMonth, eachDayOfInterval, parse } from 'date-fns'
import { formatInTimeZone, fromZonedTime } from 'date-fns-tz'
import { uk } from 'date-fns/locale'
import { APP, DATE_FORMAT, TDateFormats } from '@app/libs'
import { TypedConfigService } from '@app/infrastructure/config'

export const DateTimeProviderInjector = () => Inject(APP.PROVIDERS.DATE_TIME_PROVIDER)

@Injectable()
export class DateTimeProvider {
  public readonly time_zone: string
  constructor(private readonly configService: TypedConfigService) {
    this.time_zone = this.configService.get('TIME_ZONE')
  }

  getUtcDateString(dateString: string): string {
    return `${dateString}Z`
  }

  newTzDate(date = new Date()): Date {
    return fromZonedTime(date, this.time_zone)
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

  formatDateStringInTz(dateString: string, dateFormat: TDateFormats): string {
    const utcString = this.getUtcDateString(dateString)
    return formatInTimeZone(utcString, this.time_zone, dateFormat, { locale: uk })
  }

  toISOStringWithTz(date: Date): string {
    return fromZonedTime(date, this.time_zone).toISOString()
  }

  parseAndFormatDate(options: { date: string; dateFormat?: TDateFormats; parseFormat?: TDateFormats }): string {
    const { date, dateFormat = DATE_FORMAT.DATE_MAIN, parseFormat = DATE_FORMAT.DATE_INPUT } = options
    const parsedDate = parse(date, parseFormat, new Date())
    return format(parsedDate, dateFormat)
  }

  getNextMonthDateInterval(): { start: Date; end: Date } {
    const nextMonth = addMonths(fromZonedTime(new Date(), this.time_zone), 1)
    const startDate = startOfMonth(nextMonth)
    const endDate = endOfMonth(nextMonth)

    return { start: startDate, end: endDate }
  }

  getEachDayOfIntervalForDayIndex(options: { start: Date; end: Date }, dayIndex: number): Date[] {
    return eachDayOfInterval(options).filter((date) => date.getDay() === dayIndex)
  }
}
