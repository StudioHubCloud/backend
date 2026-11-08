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
import { UserProfileService } from '@app/domain/user-profile'
import { ExtraReplyMessage } from 'telegraf/typings/telegram-types'

export interface NotificationResult {
  success: number
  failed: number
  errors: Array<{ userId: string; error: string }>
}

type TNotifiedProfile = Pick<UserProfileSelectModel, 'id' | 'telegramId' | 'firstName' | 'fullName'>

interface ITrainingReminderInput {
  userProfile: TNotifiedProfile
  groupStyle: string
  date: string
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
    private readonly userProfileService: UserProfileService,
  ) {
    this.logger.setContext(BotNotificationService.name)
  }

  /** A message for a client profile: own Telegram, or the parents of a child without Telegram (see `BotHelper.notifyClient`). */
  async notifyClient(userProfile: Pick<UserProfileSelectModel, 'id' | 'telegramId' | 'fullName'>, message: { text: string; extra?: ExtraReplyMessage; guardianText?: string }) {
    return BotHelper.notifyClient(this.bot.telegram, this.userProfileService, userProfile, message)
  }

  async sendBirthdayNotifications(users: UserProfileSelectModel[]): Promise<NotificationResult> {
    const results: NotificationResult = {
      success: 0,
      failed: 0,
      errors: [],
    }

    for (const user of users) {
      try {
        // A child without Telegram: the parents get a greeting about the child
        const recipients = await this.notifyClient(user, {
          text: MESSAGES_COMMON.BIRTHDAY_MESSAGE,
          guardianText: MessageHelper.getParentBirthday(user.fullName),
        })
        if (!recipients.length) {
          this.logger.warn(`User ${user.id} has no Telegram and no parent with Telegram, skipping`)
          results.failed++
          continue
        }

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

  async sendTrainingReminderNotification({ userProfile, groupStyle, date, min, max }: ITrainingReminderInput): Promise<void> {
    try {
      await this.notifyClient(userProfile, {
        text: this.generateTrainingReminderMessage(userProfile.firstName, date, groupStyle, min, max),
        guardianText: MessageHelper.getParentTrainingReminder(
          userProfile.fullName,
          this.getGroupTitle(groupStyle, min, max),
          this.dateTimeProvider.formatDateStringInTz(date, DATE_FORMAT.TIME_MAIN),
        ),
      })
      this.logger.debug(`Training reminder sent for user profile ${userProfile.id}`)
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      this.logger.error(`Failed to send training reminder for user profile ${userProfile.id}: ${errorMessage}`)
    }
  }

  async sendPassExpirationNotification(userProfile: TNotifiedProfile, expirationDate: string): Promise<void> {
    try {
      await this.notifyClient(userProfile, {
        text: this.generatePassExpirationMessage(userProfile.firstName, expirationDate),
        guardianText: MessageHelper.getParentPassExpiration(
          userProfile.fullName,
          this.dateTimeProvider.formatDateStringInTz(expirationDate, DATE_FORMAT.DATE_NOTIFICATION),
        ),
      })
      this.logger.debug(`Pass expiration notification sent for user profile ${userProfile.id}`)
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      this.logger.error(`Failed to send pass expiration notification for user profile ${userProfile.id}: ${errorMessage}`)
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
    // A Google review is asked from people with Telegram only (not from a parent on behalf of a child)
    if (!userProfile.telegramId) {
      return
    }
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
    const grouptitle = this.getGroupTitle(groupStyle, min, max)
    return `Привіт, ${name}!🌸\nМи вже чекаємо тебе на тренуванні групи ${grouptitle} об ${workoutTime}\nДо зустрічі 💖`
  }

  private getGroupTitle(groupStyle: string, min: number | null, max: number | null) {
    const ageRestrictions = MessageHelper.getAgeRestrictionsMessageShort(min, max)
    return ageRestrictions ? `${groupStyle} (${ageRestrictions})` : groupStyle
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
