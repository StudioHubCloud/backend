import { Inject, Injectable } from '@nestjs/common'
import { format, addMonths, startOfMonth, endOfMonth, eachDayOfInterval, parse, endOfDay } from 'date-fns'
import { formatInTimeZone, fromZonedTime , toZonedTime } from 'date-fns-tz'
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

  toUtcString(dateString: string): string {
    console.log(dateString, 'dateString')
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

  parseAndFormatDate(options: { date: string; dateFormat?: TDateFormats; parseFormat?: TDateFormats }): string {
    const { date, dateFormat = DATE_FORMAT.DATE_MAIN, parseFormat = DATE_FORMAT.DATE_INPUT } = options
    const parsedDate = parse(date, parseFormat, new Date())
    return format(parsedDate, dateFormat)
  }

  getNextMonthDateInterval(): { start: Date; end: Date } {
    const nextMonth = addMonths(fromZonedTime(new Date(), this.time_zone), 0)
    const startDate = startOfMonth(nextMonth)
    const endDate = endOfMonth(nextMonth)

    return { start: startDate, end: endDate }
  }

  getEachDayOfIntervalForDayIndex(options: { start: Date; end: Date }, dayIndex: number): Date[] {
    return eachDayOfInterval(options).filter((date) => date.getDay() === dayIndex)
  }
}

//fromZonedTime()	Бере локальний час в заданій зоні, і перетворює в UTC
//toZonedTime()	Бере UTC-дату і показує, як вона виглядає в іншому часовому поясі
