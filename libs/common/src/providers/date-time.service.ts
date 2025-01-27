import { Inject, Injectable } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { add, format, startOfToday, subDays } from 'date-fns'
import { APP, DATE_FORMAT } from '../constants'
import { TDateFormats } from '../types'

export const DateTimeServiceInjector = () => Inject(APP.PROVIDERS.DATE_TIME_SERVICE)

@Injectable()
export class DateTimeService {
  constructor(private readonly configService: ConfigService) {}

  addDaysToDate(days: number, date: Date = new Date()): Date {
    return add(date, { days })
  }

  addMinutesToDate(minutes: number, date: Date = new Date()): Date {
    return add(date, { minutes })
  }

  formatDate(options: { date?: Date; dateFormat?: TDateFormats } = {}): string {
    const { date = new Date(), dateFormat = DATE_FORMAT.DATE } = options
    return format(date, dateFormat)
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
}
