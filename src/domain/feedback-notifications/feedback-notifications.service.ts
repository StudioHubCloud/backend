import { DatabaseService, feedbackNotification, userProfile } from '@app/infrastructure/database'
import { DateTimeProvider, DateTimeProviderInjector } from '@app/infrastructure/providers'
import { DATE_FORMAT, UserProfileStatusEnum } from '@app/libs'
import { Injectable } from '@nestjs/common'
import { addDays } from 'date-fns'
import { eq } from 'drizzle-orm'
import { PinoLogger } from 'nestjs-pino'

@Injectable()
export class FeedbackNotificationService {
  constructor(
    private readonly logger: PinoLogger,
    private readonly databaseService: DatabaseService,
    @DateTimeProviderInjector() private readonly dateTimeProvider: DateTimeProvider,
  ) {
    this.logger.setContext(FeedbackNotificationService.name)
  }

  async getUserProfilesForFeedbackNotification() {
    const now = new Date()
    const todayDateString = this.dateTimeProvider.formatDateStringInTz(now.toISOString(), DATE_FORMAT.DATE_MAIN)

    const result = await this.databaseService.drizzle.query.feedbackNotification.findMany({
      where: (feedbackNotification, { and, eq, exists, isNotNull }) =>
        and(
          eq(feedbackNotification.nextDueDate, todayDateString),
          eq(feedbackNotification.isActive, true),
          eq(feedbackNotification.feedbackGiven, false),
          exists(
            this.databaseService.drizzle
              .select()
              .from(userProfile)
              .where(
                and(
                  eq(userProfile.id, feedbackNotification.userProfileId),
                  eq(userProfile.status, UserProfileStatusEnum.ACTIVE),
                  isNotNull(userProfile.telegramId),
                ),
              ),
          ),
        ),
      with: {
        userProfile: true,
      },
    })
    return result
  }

  async markNotificationAsSent(notificationId: string) {
    const now = new Date()
    const today = this.dateTimeProvider.formatDateStringInTz(now.toISOString(), DATE_FORMAT.DATE_MAIN)

    const notification = await this.databaseService.drizzle.query.feedbackNotification.findFirst({
      where: (table, { eq }) => eq(table.id, notificationId),
    })

    if (!notification) {
      throw new Error(`Notification ${notificationId} not found`)
    }

    const nextDueDate = this.dateTimeProvider.formatDateStringInTz(
      addDays(now, notification.currentIntervalDays).toISOString(),
      DATE_FORMAT.DATE_MAIN,
    )

    await this.databaseService.drizzle
      .update(feedbackNotification)
      .set({
        lastSentDate: today,
        nextDueDate: nextDueDate,
      })
      .where(eq(feedbackNotification.id, notificationId))

    this.logger.debug(`Updated notification ${notificationId} - next due: ${nextDueDate}`)
  }
}
