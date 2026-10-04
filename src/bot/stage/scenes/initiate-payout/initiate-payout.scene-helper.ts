import { MessageHelper, PassHelper, TextHelper, UserHelper } from '@app/bot/helpers'
import { UserProfileSelectModel } from '@app/infrastructure/database'
import { TPayoutStatistics } from '@app/libs'

export interface IInitiatePayoutSceneState {
  staffUserProfile: UserProfileSelectModel
  staffUserId: string
  payoutDate: string
  payoutAmount: number
  trainingIds: number[]
  personalTrainingIds: string[]
  payoutStatistics: TPayoutStatistics
}

export class InitiatePayoutSceneHelper {
  static getPayoutDescriptionMessage(data: IInitiatePayoutSceneState): string {
    const { staffUserProfile, payoutDate, payoutAmount, payoutStatistics } = data
    return (
      `💼 Інформація про виплату:\n\n` +
      `👤 Працівник: <b>${UserHelper.getDisplayName(staffUserProfile)}</b>\n` +
      `📅 Дата виплати: <b>${payoutDate}</b>\n` +
      this.getPayoutBreakdown(payoutStatistics) +
      `💰 Сума виплати: <b>${PassHelper.toDisplayPrice(payoutAmount)}</b>\n`
    )
  }

  static getStaffInfoMessage(data: IInitiatePayoutSceneState): string {
    const { payoutDate, payoutAmount, payoutStatistics } = data
    return (
      `💰 Вам нараховано зарплату!\n\n` +
      `📅 Дата нарахування: <b>${payoutDate}</b>\n` +
      this.getPayoutBreakdown(payoutStatistics) +
      `💸 Сума до виплати: <b>${PassHelper.toDisplayPrice(payoutAmount)}</b>\n`
    )
  }

  /** Shown to the admin after a manual payout: who, the period, the breakdown, and that the trainer was notified. */
  static getPayoutDoneMessage(data: IInitiatePayoutSceneState): string {
    const { staffUserProfile, payoutDate, payoutAmount, payoutStatistics } = data
    return (
      `✅ <b>Зарплату виплачено</b>\n\n` +
      `👤 ${UserHelper.getDisplayName(staffUserProfile)}\n` +
      `📅 Період до <b>${payoutDate}</b>\n` +
      this.getPayoutBreakdown(payoutStatistics) +
      `💰 Сума: <b>${PassHelper.toDisplayPrice(payoutAmount)}</b>\n\n` +
      `📨 <i>Тренеру надіслано повідомлення</i>`
    )
  }

  static getConfirmPayoutMessage(data: IInitiatePayoutSceneState): string {
    const { staffUserProfile, payoutDate, payoutAmount, payoutStatistics } = data
    return (
      `💼 Підтвердження виплати:\n\n` +
      `👤 Працівник: <b>${UserHelper.getDisplayName(staffUserProfile)}</b>\n` +
      `📅 Дата виплати: <b>${payoutDate}</b>\n` +
      this.getPayoutBreakdown(payoutStatistics) +
      `💰 Сума виплати: <b>${PassHelper.toDisplayPrice(payoutAmount)}</b>\n` +
      (payoutStatistics ? MessageHelper.getPayoutPendingWarning(payoutStatistics).replace(/^\n/, '') : '')
    )
  }

  /** "👥 Групові: 12 трен. • 3910 ₴" and "🤝 Індивідуальні: 3 зан. • 1275 ₴" lines; empty parts are skipped. */
  private static getPayoutBreakdown(statistics?: TPayoutStatistics): string {
    if (!statistics) {
      return ''
    }
    const { totalTrainings, groupPayout, personalTrainingCount, personalPayout } = statistics
    const groupLine = totalTrainings
      ? `👥 Групові: ${totalTrainings} трен. • ${PassHelper.toDisplayPrice(groupPayout)}\n`
      : ''
    const noShows = statistics.personalNoShowCount ?? 0
    const noShowNote = noShows ? ` (+ 🚫 ${noShows} ${TextHelper.pluralize(noShows, ['неявка', 'неявки', 'неявок'])})` : ''
    const personalLine =
      personalTrainingCount || noShows
        ? `🤝 Індивідуальні: ${personalTrainingCount} зан.${noShowNote} • ${PassHelper.toDisplayPrice(personalPayout)}\n`
        : ''
    const bonusLine = statistics.bonus ? `🎁 Бонус: ${PassHelper.toDisplayPrice(statistics.bonus)}\n` : ''
    return groupLine + bonusLine + personalLine
  }
}
