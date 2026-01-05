import { Inject, Injectable } from '@nestjs/common'
import { PinoLogger } from 'nestjs-pino'
import { Telegraf } from 'telegraf'
import { BotContext } from '../bot.context'
import { BOT_INSTANCE } from '../bot.instance'
import { UserProfileSelectModel } from '@app/infrastructure/database'
import { DateTimeProvider, DateTimeProviderInjector } from '@app/infrastructure/providers'
import { API, DATE_FORMAT } from '@app/libs'
import { MESSAGES_COMMON } from '../static/messages'
import { TypedConfigService } from '@app/infrastructure/config'
import { MessageHelper } from '../helpers/message.helper'
import { BotHelper } from '../helpers'

export interface NotificationResult {
  success: number
  failed: number
  errors: Array<{ userId: string; error: string }>
}

interface ITrainingReminderInput {
  name: string
  groupStyle: string
  date: string
  telegramId: string
  min: number | null
  max: number | null
}

@Injectable()
export class BotNotificationService {
  constructor(
    private readonly logger: PinoLogger,
    private readonly configService: TypedConfigService,
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

        await BotHelper.safeSendMessage(this.bot.telegram, user.telegramId, MESSAGES_COMMON.BIRTHDAY_MESSAGE)

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

  async sendTrainingReminderNotification({ name, groupStyle, date, telegramId, min, max }: ITrainingReminderInput): Promise<void> {
    try {
      const message = this.generateTrainingReminderMessage(name, date, groupStyle, min, max)
      await BotHelper.safeSendMessage(this.bot.telegram, telegramId, message)
      this.logger.debug(`Training reminder sent to user ${telegramId}`)
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      this.logger.error(`Failed to send training reminder to user ${telegramId}: ${errorMessage}`)
    }
  }

  async sendPassExpirationNotification(userProfile: UserProfileSelectModel, expirationDate: string): Promise<void> {
    const message = this.generatePassExpirationMessage(userProfile.firstName, expirationDate)
    try {
      await BotHelper.safeSendMessage(this.bot.telegram, userProfile.telegramId, message)
      this.logger.debug(`Pass expiration notification sent to ${userProfile.telegramId}`)
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      this.logger.error(`Failed to send pass expiration notification to ${userProfile.telegramId}: ${errorMessage}`)
    }
  }

  async sendCustomNotification(chatId: string | number, message: string, options?: any) {
    try {
      await BotHelper.safeSendMessage(this.bot.telegram, chatId, message, options)
      this.logger.debug(`Custom notification sent to ${chatId}`)
      return { success: true }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      this.logger.error(`Failed to send custom notification to ${chatId}: ${errorMessage}`)
      return { success: false, error: errorMessage }
    }
  }

  async sendFeedbackNotificationToUser(userProfile: UserProfileSelectModel): Promise<void> {
    const googleReviewUrl = `${API.GOOGLE_REVIEW_URL}${this.configService.get('GOOGLE_PLACE_ID')}`
    const keyboard = {
      reply_markup: {
        inline_keyboard: [
          [
            {
              text: '⭐ Залишити відгук',
              url: googleReviewUrl,
            },
            {
              text: '⏰ Нагадати пізніше',
              callback_data: 'feedback_remind_later',
            },
          ],
        ],
      },
    }

    await this.sendCustomNotification(userProfile.telegramId, this.generateFeedbackMessage(userProfile.firstName), {
      parse_mode: 'HTML',
      ...keyboard,
    })
  }

  private generateTrainingReminderMessage(
    name: string,
    workoutTime: string,
    groupStyle: string,
    min: number | null,
    max: number | null,
  ): string {
    workoutTime = this.dateTimeProvider.formatDateStringInTz(workoutTime, DATE_FORMAT.TIME_MAIN)
    const ageRestrictions = MessageHelper.getAgeRestrictionsMessageShort(min, max)
    const grouptitle = ageRestrictions ? `${groupStyle} (${ageRestrictions})` : groupStyle
    return `Привіт, ${name}!🌸\nМи вже чекаємо тебе на тренуванні групи ${grouptitle} об ${workoutTime}\nДо зустрічі 💖`
  }

  private generatePassExpirationMessage(name: string, expirationDate: string): string {
    expirationDate = this.dateTimeProvider.formatDateStringInTz(expirationDate, DATE_FORMAT.DATE_NOTIFICATION)
    return `Привіт, ${name}!⚠️\nНагадуємо, що твій абонемент закінчується ${expirationDate}.\nНе забудь продовжити його, щоб не пропустити улюблені тренування! 💖`
  }

  private generateFeedbackMessage(firstName: string): string {
    return (
      `Привіт, ${firstName}! 💫\n` +
      `Ми дуже хочемо почути твою думку — залиш, будь ласка, відгук про тренування або студію загалом.\n` +
      `Твої слова допомагають нам ставати кращими! 🙌💖`
    )
  }
}
