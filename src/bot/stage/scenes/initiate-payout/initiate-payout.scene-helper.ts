import { PassHelper, UserHelper } from '@app/bot/helpers'
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

  static getConfirmPayoutMessage(data: IInitiatePayoutSceneState): string {
    const { staffUserProfile, payoutDate, payoutAmount, payoutStatistics } = data
    return (
      `💼 Підтвердження виплати:\n\n` +
      `👤 Працівник: <b>${UserHelper.getDisplayName(staffUserProfile)}</b>\n` +
      `📅 Дата виплати: <b>${payoutDate}</b>\n` +
      this.getPayoutBreakdown(payoutStatistics) +
      `💰 Сума виплати: <b>${PassHelper.toDisplayPrice(payoutAmount)}</b>\n`
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
    const personalLine = personalTrainingCount
      ? `🤝 Індивідуальні: ${personalTrainingCount} зан. • ${PassHelper.toDisplayPrice(personalPayout)}\n`
      : ''
    return groupLine + personalLine
  }
}
