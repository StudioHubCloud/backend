import { Inject, Injectable } from '@nestjs/common'
import { PinoLogger } from 'nestjs-pino'
import { Telegraf } from 'telegraf'
import { BotContext } from '../bot.context'
import { BOT_INSTANCE } from '../bot.instance'
import { UserProfileSelectModel } from '@app/infrastructure/database'
import { DateTimeProvider, DateTimeProviderInjector } from '@app/infrastructure/providers'
import { DATE_FORMAT } from '@app/libs'
import { BIRTHDAY_MESSAGE } from '../static/messages'

export interface NotificationResult {
  success: number
  failed: number
  errors: Array<{ userId: string; error: string }>
}

interface ITrainingReminderInput {
  name: string
  groupName: string
  date: string
  telegramId: string
}

@Injectable()
export class BotNotificationService {
  constructor(
    private readonly logger: PinoLogger,
    @Inject(BOT_INSTANCE) private readonly bot: Telegraf<BotContext>,
    @DateTimeProviderInjector() private readonly dateTimeProvider: DateTimeProvider,
  ) {
    this.logger.setContext(BotNotificationService.name)
  }

  async sendBirthdayNotifications(users: UserProfileSelectModel[]): Promise<NotificationResult> {
    const results: NotificationResult = {
      success: 0,
      failed: 0,
      errors: [],
    }

    for (const user of users) {
      try {
        if (!user.telegramId) {
          this.logger.warn(`User ${user.id} has no telegramId, skipping`)
          results.failed++
          continue
        }

        await this.bot.telegram.sendMessage(user.telegramId, BIRTHDAY_MESSAGE, {
          parse_mode: 'HTML',
        })

        results.success++
        this.logger.debug(`Birthday message sent to user ${user.id}`)
      } catch (error) {
        results.failed++
        const errorMessage = error instanceof Error ? error.message : 'Unknown error'
        results.errors.push({ userId: user.id, error: errorMessage })
        this.logger.error(`Failed to send birthday message to user ${user.id}: ${errorMessage}`)
      }
    }
    return results
  }

  async sendTrainingReminderNotification({ name, groupName, date, telegramId }: ITrainingReminderInput): Promise<void> {
    try {
      const message = this.generateTrainingReminderMessage(name, date, groupName)
      await this.bot.telegram.sendMessage(telegramId, message, {
        parse_mode: 'HTML',
      })
      this.logger.debug(`Training reminder sent to user ${telegramId}`)
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      this.logger.error(`Failed to send training reminder to user ${telegramId}: ${errorMessage}`)
    }
  }

  async sendPassExpirationNotification(userProfile: UserProfileSelectModel, expirationDate: string): Promise<void> {
    const message = this.generatePassExpirationMessage(userProfile.firstName, expirationDate)
    try {
      await this.bot.telegram.sendMessage(userProfile.telegramId, message, {
        parse_mode: 'HTML',
      })
      this.logger.debug(`Pass expiration notification sent to ${userProfile.telegramId}`)
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      this.logger.error(`Failed to send pass expiration notification to ${userProfile.telegramId}: ${errorMessage}`)
    }
  }

  async sendCustomNotification(bot: Telegraf<BotContext>, chatId: string | number, message: string, options?: any) {
    try {
      await bot.telegram.sendMessage(chatId, message, options)
      this.logger.debug(`Custom notification sent to ${chatId}`)
      return { success: true }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      this.logger.error(`Failed to send custom notification to ${chatId}: ${errorMessage}`)
      return { success: false, error: errorMessage }
    }
  }

  private generateTrainingReminderMessage(name: string, workoutTime: string, groupName: string): string {
    workoutTime = this.dateTimeProvider.formatDateStringInTz(workoutTime, DATE_FORMAT.TIME_MAIN)
    return `⏰ Привіт, ${name}!\nНагадуємо, що о ${workoutTime} на тебе чекає тренування в групі ${groupName}!\nДо зустрічі в студії! 💃✨`
  }

  private generatePassExpirationMessage(name: string, expirationDate: string): string {
    expirationDate = this.dateTimeProvider.formatDateStringInTz(expirationDate, DATE_FORMAT.DATE_NOTIFICATION)
    return `⚠️ Привіт, ${name}!\nНагадуємо, що твій абонемент закінчується ${expirationDate}.\nНе забудь продовжити його, щоб не пропустити улюблені тренування! 🏋️‍♂️💪`
  }
}
