import { Injectable } from '@nestjs/common'
import { Cron, CronExpression } from '@nestjs/schedule'
import { add } from 'date-fns'
import { PinoLogger } from 'nestjs-pino'
import { BotNotificationService } from '@app/bot/services'
import { TrainingService } from '@app/domain/training'
import { UserProfileService } from '@app/domain/user-profile'
import { PassService } from '@app/domain/pass'
import { STATIC_CONFIG } from '../config/config.helper'

@Injectable()
export class CronService {
  constructor(
    private readonly logger: PinoLogger,
    private readonly trainingService: TrainingService,
    private readonly userProfileService: UserProfileService,
    private readonly passService: PassService,
    private readonly botNotificationService: BotNotificationService,
  ) {
    this.logger.setContext(CronService.name)
  }

  @Cron(CronExpression.EVERY_1ST_DAY_OF_MONTH_AT_MIDNIGHT, {
    name: 'add-trainings',
    timeZone: STATIC_CONFIG.timeZone,
  })
  async addTrainingsCron() {
    this.logger.debug('ADD TRAININGS Cron job executed on the first day of the month at midnight')
    const result = await this.trainingService.addTrainingsForActiveGroups()
    this.logger.debug(`ADD TRAININGS Cron job completed. Total added records: ${result.length}`)
  }

  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT, {
    name: 'expire-all-past-passes',
    timeZone: STATIC_CONFIG.timeZone,
  })
  async expireAllPastPasses() {
    this.logger.debug('Expire All Past Passes Cron job executed on the first day of the month at midnight')
    const result = await this.passService.expireAllPastPasses()
    this.logger.debug(`Expire All Past Passes Cron job completed. Total expired passes: ${result.length}`)
  }

  @Cron(CronExpression.EVERY_DAY_AT_10AM, {
    name: 'happy-birthday',
    timeZone: STATIC_CONFIG.timeZone,
  })
  async handleHappyBirthdayCron() {
    this.logger.debug('Happy Birthday Cron job executed at 10 AM')
    const users = await this.userProfileService.findUsersWithBirthdayToday()
    this.logger.debug(`Sending birthday notifications to ${users.length} users`)
    const results = await this.botNotificationService.sendBirthdayNotifications(users)
    this.logger.debug(`Birthday notifications completed: ${results.success} sent, ${results.failed} failed`)
  }

  @Cron(CronExpression.EVERY_DAY_AT_NOON, {
    name: 'notify-pass-expiration',
    timeZone: STATIC_CONFIG.timeZone,
  })
  async handleNotifyForPassExpirationCron() {
    this.logger.debug('Notify For Pass Expiration Cron job executed at noon')
    const now = new Date()
    const threeDaysFromNow = add(now, { days: 3 }).toISOString()
    
    this.logger.debug(`Current time: ${now.toISOString()}, checking for pass expiration until: ${threeDaysFromNow}`)
    const expiringPasses = await this.passService.getExpiringPassesInDays(3)
    this.logger.debug(`Found ${expiringPasses.length} expiring passes in the next 3 days`)

    for (const pass of expiringPasses) {
      if(!pass.client?.userProfile) {
        this.logger.warn(`No user profile found for pass ID: ${pass.id}, skipping notification`)
        continue
      }
      await Promise.all([
        this.botNotificationService.sendPassExpirationNotification(pass.client.userProfile, pass.endDate),
        this.passService.updatePass(pass.id, { reminderSent: true }),
      ])
    }
    this.logger.debug('Notify For Pass Expiration Cron job completed')
  }

  @Cron(CronExpression.EVERY_10_MINUTES, {
    name: 'notify-upcoming-training',
    timeZone: STATIC_CONFIG.timeZone,
  })
  async handleNotifyForUpcomingTrainingCron() {
    this.logger.debug('Notify For Upcoming Training Cron job executed')

    const now = new Date()
    const fourHoursFromNow = add(now, { hours: 4 }).toISOString()
    this.logger.debug(`Current time: ${now.toISOString()}, checking for trainings until: ${fourHoursFromNow}`)

    const trainings = await this.trainingService.getTrainingListForReminder(fourHoursFromNow)
    this.logger.debug(`Found ${trainings.length} trainings for reminder`)

    for (const training of trainings) {
      this.logger.debug(`Processing training ID: ${training.id}, date: ${training.date}`)

      training.trainingSignups.forEach(async (signup) => {
        if (!signup.userProfile) {
          return this.logger.warn(`No user profile found for signup ID: ${signup.id} in training ID: ${training.id}`)
        }
        const name = signup.userProfile.firstName
        const groupName = signup.group.name
        const telegramId = signup.userProfile.telegramId
        await Promise.all([
          this.botNotificationService.sendTrainingReminderNotification({ name, groupName, date: training.date, telegramId }),
          this.trainingService.updateTraining(training.id, { reminderSent: true }),
        ])
      })

      this.logger.debug(`Training ID: ${training.id} - Notifications sent for ${training.trainingSignups.length} signups`)
    }

    this.logger.debug(`Notify For Upcoming Training Cron job completed`)
  }
}
