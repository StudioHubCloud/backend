import { Injectable } from '@nestjs/common'
import { Cron, CronExpression } from '@nestjs/schedule'
import { add, format, parseISO, startOfMonth, subDays } from 'date-fns'
import { formatInTimeZone } from 'date-fns-tz'
import { PinoLogger } from 'nestjs-pino'
import { BotNotificationService } from '@app/bot/services'
import { TrainingService } from '@app/domain/training'
import { UserProfileService } from '@app/domain/user-profile'
import { PassService } from '@app/domain/pass'
import { STATIC_CONFIG } from '../config/config.helper'
import { FeedbackNotificationService } from '@app/domain/feedback-notifications'
import { AuditLogActions, AuditLogTrigger, DATE_FORMAT, TrainingSignupTypeEnum, UserProfileStatusEnum } from '@app/libs'
import { AuditLogService } from '../audit-log'
import { AuditLogHelper } from '@app/bot/helpers/audit-log.helper'
import { MetricsService } from '../metrics'
import { StaffMemberPayoutService } from '@app/domain/staff-member-payout'
import { PersonalTrainingSignupService } from '@app/domain/personal-training-signup'
import { TypedConfigService } from '../config'
import { UserProfileSelectModel } from '../database'
import { DateTimeProvider, DateTimeProviderInjector } from '../providers'
import { MessageHelper, PersonalTrainingHelper, UserHelper } from '@app/bot/helpers'
import { AdminKeyboards } from '@app/bot/keyboard/storage'
import { InitiatePayoutSceneHelper } from '@app/bot/stage/scenes/initiate-payout/initiate-payout.scene-helper'

@Injectable()
export class CronService {
  constructor(
    private readonly logger: PinoLogger,
    private readonly trainingService: TrainingService,
    private readonly userProfileService: UserProfileService,
    private readonly passService: PassService,
    private readonly botNotificationService: BotNotificationService,
    private readonly feedbackNotificationService: FeedbackNotificationService,
    private readonly auditLogService: AuditLogService,
    private readonly metricsService: MetricsService,
    private readonly staffMemberPayoutService: StaffMemberPayoutService,
    private readonly configService: TypedConfigService,
    private readonly personalTrainingSignupService: PersonalTrainingSignupService,
    @DateTimeProviderInjector() private readonly dateTimeProvider: DateTimeProvider,
  ) {
    this.logger.setContext(CronService.name)
  }

  // @Cron(CronExpression.EVERY_10_SECONDS, {
  //   name: 'feedback-notification',
  //   timeZone: STATIC_CONFIG.timeZone,
  // })
  // async handleFeedbackNotificationCron() {
  //   this.logger.debug('Feedback Notification Cron job executed at 6 PM')

  //   const dueNotifications = await this.feedbackNotificationService.getUserProfilesForFeedbackNotification()
  //   this.logger.debug(`Found ${dueNotifications.length} due feedback notifications`)

  //   let successCount = 0
  //   let failureCount = 0

  //   for (const notification of dueNotifications) {
  //     try {
  //       const { userProfile } = notification
  //       await this.botNotificationService.sendFeedbackNotificationToUser(userProfile)
  //       await this.feedbackNotificationService.markNotificationAsSent(notification.id)
  //       successCount++
  //       this.logger.debug(`Feedback notification sent to user ${userProfile.firstName} (${userProfile.telegramId})`)
  //     } catch (error) {
  //       failureCount++
  //       const errorMessage = error instanceof Error ? error.message : 'Unknown error'
  //       this.logger.error(`Failed to process feedback notification ${notification.id}: ${errorMessage}`)
  //     }
  //   }

  //   this.logger.debug(`Feedback Notification Cron completed: ${successCount} sent, ${failureCount} failed`)
  // }

  @Cron(CronExpression.EVERY_1ST_DAY_OF_MONTH_AT_MIDNIGHT, {
    name: 'add-trainings',
    timeZone: STATIC_CONFIG.timeZone,
  })
  async addTrainingsCron() {
    await this.metricsService.runJob('add-trainings', async () => {
      this.logger.debug('ADD TRAININGS Cron job executed on the first day of the month at midnight')
      const result = await this.trainingService.addTrainingsForActiveGroups()
      this.logger.debug(`ADD TRAININGS Cron job completed. Total added records: ${result.length}`)
    })
  }

  @Cron(CronExpression.EVERY_1ST_DAY_OF_MONTH_AT_NOON, {
    name: 'monthly-staff-payouts',
    timeZone: STATIC_CONFIG.timeZone,
  })
  async monthlyStaffPayoutsCron() {
    // The previous month: everything unpaid up to its last day (inclusive), dated that day
    const todayInTz = formatInTimeZone(new Date(), STATIC_CONFIG.timeZone, DATE_FORMAT.DATE_MAIN)
    return this.prepareMonthlyStaffPayouts(format(subDays(startOfMonth(parseISO(todayInTz)), 1), DATE_FORMAT.DATE_INPUT))
  }

  /**
   * Prepares (does not pay) the payouts of the period ending `payoutDate` (dd.MM.yyyy, inclusive), dated that day.
   * Each payout is stored as pending with a snapshot, its sessions locked; admins pay or cancel each one in the bot.
   */
  private async prepareMonthlyStaffPayouts(payoutDate: string) {
    await this.metricsService.runJob('monthly-staff-payouts', async () => {
      this.logger.debug(`Monthly staff payouts cron job executed, payout date: ${payoutDate}`)

      const staffUserProfiles = await this.userProfileService.getAllActiveStaffMembersUserProfiles()
      let preparedCount = 0
      const failures: string[] = []

      // One staff member's failure must not stop the others
      for (const staffUserProfile of staffUserProfiles) {
        try {
          const payout = await this.staffMemberPayoutService.preparePendingPayout(staffUserProfile.id, payoutDate, (salary) =>
            InitiatePayoutSceneHelper.getPayoutDescriptionMessage({
              staffUserProfile,
              staffUserId: staffUserProfile.id,
              payoutDate,
              payoutAmount: salary.statistics.totalPayout,
              trainingIds: salary.trainingIds,
              personalTrainingIds: salary.personalTrainingIds,
              payoutStatistics: salary.statistics,
            }),
          )
          if (payout) {
            preparedCount += 1
          }
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error'
          this.logger.error(`Monthly payout failed for user profile ${staffUserProfile.id}: ${errorMessage}`)
          failures.push(`${UserHelper.getDisplayName(staffUserProfile)}: ${errorMessage}`)
        }
      }

      if (preparedCount > 0) {
        await this.notifyAdminsAboutPendingPayouts()
      }

      if (failures.length > 0) {
        await this.botNotificationService.sendCustomNotification(
          this.configService.get('MAINTAINER_CHAT_ID'),
          `❌ Monthly staff payouts (${payoutDate}) failed for:\n${failures.join('\n')}`,
        )
      }

      this.logger.debug(`Monthly staff payouts completed: ${preparedCount} prepared, ${failures.length} failed`)
    })
  }

  /**
   * Every studio admin gets the list of prepared payouts (all still waiting, older ones too), one button per trainer.
   * Maintainers only in the test studio (it has no admin); in production salaries are the admins' business.
   */
  private async notifyAdminsAboutPendingPayouts() {
    const [admins, payouts] = await Promise.all([
      this.userProfileService.findStudioAdmins({ withMaintainers: !this.configService.isProduction() }),
      this.staffMemberPayoutService.findAllPendingPayouts(),
    ])
    const items = payouts
      .filter((payout) => payout.staffMember?.userProfile)
      .map((payout) => ({
        staffUserId: payout.staffMember!.userProfile.id,
        name: UserHelper.getDisplayName(payout.staffMember!.userProfile),
        amount: Number(payout.amount),
      }))
    const keyboard = AdminKeyboards.pendingPayoutsList(items)

    await Promise.all(
      admins.map((admin) =>
        this.botNotificationService.sendCustomNotification(admin.telegramId, MessageHelper.getPendingPayoutsListMessage(), {
          parse_mode: 'HTML',
          ...keyboard,
        }),
      ),
    )
  }

  /**
   * The evening before the monthly payouts are prepared (last day of the month, 18:00): each trainer with individual
   * sessions nobody confirmed gets a reminder, and the admins one summary, since the payout closes them with 0.
   * Group attendance has no "pending" (a person came or not), so no reminder for it. Runs daily, acts only when
   * tomorrow is the 1st.
   */
  @Cron(CronExpression.EVERY_DAY_AT_6PM, {
    name: 'remind-unconfirmed-sessions',
    timeZone: STATIC_CONFIG.timeZone,
  })
  async remindUnconfirmedSessionsCron() {
    const todayInTz = formatInTimeZone(new Date(), STATIC_CONFIG.timeZone, DATE_FORMAT.DATE_MAIN)
    if (add(parseISO(todayInTz), { days: 1 }).getDate() !== 1) {
      return
    }

    await this.metricsService.runJob('remind-unconfirmed-sessions', async () => {
      const payoutDate = format(parseISO(todayInTz), DATE_FORMAT.DATE_INPUT)
      const staffUserProfiles = await this.userProfileService.getAllActiveStaffMembersUserProfiles()
      const unconfirmedByTrainer: { name: string; count: number }[] = []

      for (const staffUserProfile of staffUserProfiles) {
        try {
          // A trainer whose previous payout still waits for an admin gets nothing new prepared tomorrow
          if (await this.staffMemberPayoutService.findPendingPayoutByUserProfileId(staffUserProfile.id)) {
            continue
          }
          const salary = await this.staffMemberPayoutService.calculateStaffPayoutSalary(staffUserProfile.id, payoutDate)
          const unconfirmedSessions = salary.statistics.pendingPersonalCount ?? 0

          if (unconfirmedSessions) {
            unconfirmedByTrainer.push({ name: UserHelper.getDisplayName(staffUserProfile), count: unconfirmedSessions })
            await this.botNotificationService.sendCustomNotification(
              staffUserProfile.telegramId,
              MessageHelper.getUnconfirmedSessionsReminder(unconfirmedSessions),
              { parse_mode: 'HTML' },
            )
          }
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error'
          this.logger.error(`Unconfirmed sessions reminder failed for user profile ${staffUserProfile.id}: ${errorMessage}`)
        }
      }

      if (unconfirmedByTrainer.length) {
        // Same recipients as the prepared payouts list (maintainers only in the test studio)
        const admins = await this.userProfileService.findStudioAdmins({ withMaintainers: !this.configService.isProduction() })
        const message = MessageHelper.getUnconfirmedSessionsAdminReminder(unconfirmedByTrainer)
        await Promise.all(
          admins.map((admin) => this.botNotificationService.sendCustomNotification(admin.telegramId, message, { parse_mode: 'HTML' })),
        )
      }
    })
  }

  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT, {
    name: 'expire-all-past-passes',
    timeZone: STATIC_CONFIG.timeZone,
  })
  async expireAllPastPasses() {
    await this.metricsService.runJob('expire-all-past-passes', async () => {
      this.logger.debug('Expire All Past Passes Cron job executed on the first day of the month at midnight')
      const [passes, logOperations] = await this.userProfileService.expireAllPastPasses()
      this.auditLogService.logAction(AuditLogHelper.startScheduledTaskAction(AuditLogActions.EXPIRE_PAST_PASSES, logOperations))
      this.logger.debug(`Expire All Past Passes Cron job completed. Total expired passes: ${passes.length}`)
    })
  }

  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT, {
    name: 'activate-inactive-passes-after-grace-period',
    timeZone: STATIC_CONFIG.timeZone,
  })
  async activatePassesAfterGracePeriod() {
    await this.metricsService.runJob('activate-inactive-passes-after-grace-period', async () => {
      this.logger.debug('Activate Inactive Passes Cron job executed at midnight')
      const [count, logOperations] = await this.passService.activatePassesAfterGracePeriod()
      this.auditLogService.logAction(
        AuditLogHelper.startScheduledTaskAction(AuditLogActions.ACTIVATE_PASSES_AFTER_GRACE_PERIOD, logOperations),
      )
      this.logger.debug(`Activate Inactive Passes Cron job completed. Total activated passes: ${count}`)
    })
  }

  @Cron(CronExpression.EVERY_DAY_AT_10AM, {
    name: 'happy-birthday',
    timeZone: STATIC_CONFIG.timeZone,
  })
  async handleHappyBirthdayCron() {
    await this.metricsService.runJob('happy-birthday', async () => {
      this.logger.debug('Happy Birthday Cron job executed at 10 AM')
      const users = await this.userProfileService.findUsersWithBirthdayToday()
      this.logger.debug(`Sending birthday notifications to ${users.length} users`)
      const results = await this.botNotificationService.sendBirthdayNotifications(users)
      this.logger.debug(`Birthday notifications completed: ${results.success} sent, ${results.failed} failed`)
    })
  }

  @Cron(CronExpression.EVERY_DAY_AT_NOON, {
    name: 'notify-pass-expiration',
    timeZone: STATIC_CONFIG.timeZone,
  })
  async handleNotifyForPassExpirationCron() {
    await this.metricsService.runJob('notify-pass-expiration', async () => {
      this.logger.debug('Notify For Pass Expiration Cron job executed at noon')
      const now = new Date()
      const threeDaysFromNow = add(now, { days: 3 }).toISOString()

      this.logger.debug(`Current time: ${now.toISOString()}, checking for pass expiration until: ${threeDaysFromNow}`)
      const expiringPasses = await this.passService.getExpiringPassesInDays(3)
      this.logger.debug(`Found ${expiringPasses.length} expiring passes in the next 3 days`)

      for (const pass of expiringPasses) {
        if (!pass.client?.userProfile) {
          this.logger.warn(`No user profile found for pass ID: ${pass.id}, skipping notification`)
          continue
        }
        if (!pass.endDate) {
          this.logger.warn(`No end date found for pass ID: ${pass.id}, skipping notification`)
          continue
        }
        const [updatePassResults] = await Promise.all([
          this.passService.updatePass(pass.id, { reminderSent: true }),
          this.botNotificationService.sendPassExpirationNotification(pass.client.userProfile, pass.endDate),
        ])
        this.auditLogService.logAction(AuditLogHelper.startScheduledTaskAction(AuditLogActions.PASS_REMINDER_SENT, updatePassResults[1]))
      }
      this.logger.debug('Notify For Pass Expiration Cron job completed')
    })
  }

  @Cron(CronExpression.EVERY_10_MINUTES, {
    name: 'notify-upcoming-training',
    timeZone: STATIC_CONFIG.timeZone,
  })
  async handleNotifyForUpcomingTrainingCron() {
    await this.metricsService.runJob('notify-upcoming-training', async () => {
      this.logger.debug('Notify For Upcoming Training Cron job executed')

      const now = new Date()
      const fourHoursFromNow = add(now, { hours: 4 }).toISOString()
      this.logger.debug(`Current time: ${now.toISOString()}, checking for trainings until: ${fourHoursFromNow}`)

      const trainings = await this.trainingService.getTrainingListForReminder(fourHoursFromNow)
      this.logger.debug(`Found ${trainings.length} trainings for reminder`)

      for (const training of trainings) {
        this.logger.debug(`Processing training ID: ${training.id}, date: ${training.date}`)

        training.trainingSignups
          .filter((s) => s.type !== TrainingSignupTypeEnum.SPECIAL)
          .forEach(async (signup) => {
            if (!signup.userProfile) {
              return this.logger.warn(`No user profile found for signup ID: ${signup.id} in training ID: ${training.id}`)
            }
            const name = signup.userProfile.firstName
            const groupStyle = signup.group.groupStyle.title
            const telegramId = signup.userProfile.telegramId
            await Promise.all([
              this.botNotificationService.sendTrainingReminderNotification({
                name,
                groupStyle,
                date: training.date,
                telegramId,
                min: signup.group.groupAgeRestrictions?.minAge || null,
                max: signup.group.groupAgeRestrictions?.maxAge || null,
              }),
              this.trainingService.updateTraining(training.id, { reminderSent: true }),
            ])
          })

        this.logger.debug(`Training ID: ${training.id} - Notifications sent for ${training.trainingSignups.length} signups`)
      }

      this.logger.debug(`Notify For Upcoming Training Cron job completed`)
    })
  }

  @Cron(CronExpression.EVERY_10_MINUTES, {
    name: 'notify-upcoming-personal-training',
    timeZone: STATIC_CONFIG.timeZone,
  })
  async handleNotifyForUpcomingPersonalTrainingCron() {
    await this.metricsService.runJob('notify-upcoming-personal-training', async () => {
      // Same window as group trainings: individual sessions starting in the next 4 hours
      const fourHoursFromNow = add(new Date(), { hours: 4 }).toISOString()
      const sessions = await this.personalTrainingSignupService.getSessionsForReminder(fourHoursFromNow)
      this.logger.debug(`Found ${sessions.length} individual sessions for reminder`)

      for (const session of sessions) {
        // Mark first: a parallel run (or a restart) must not send it twice
        if (!(await this.personalTrainingSignupService.markReminderSent(session.id))) {
          continue
        }

        const trainerUserProfile = session.staffMember?.userProfile
        const clientUserProfile = session.client?.userProfile

        if (clientUserProfile && clientUserProfile.status === UserProfileStatusEnum.ACTIVE) {
          await this.botNotificationService.sendCustomNotification(
            clientUserProfile.telegramId,
            PersonalTrainingHelper.getClientReminderMessage(
              clientUserProfile.firstName,
              UserHelper.getDisplayName(trainerUserProfile ?? null),
              session.scheduledAt,
              this.dateTimeProvider,
            ),
          )
        }

        if (trainerUserProfile) {
          await this.botNotificationService.sendCustomNotification(
            trainerUserProfile.telegramId,
            PersonalTrainingHelper.getTrainerReminderMessage(session, this.dateTimeProvider),
          )
        }
      }
    })
  }
}
