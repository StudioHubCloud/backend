import { PassHelper, UserHelper } from '@app/bot/helpers'
import { UserProfileSelectModel } from '@app/infrastructure/database'

export interface IInitiatePayoutSceneState {
  staffUserProfile: UserProfileSelectModel
  staffUserId: string
  payoutDate: string
  payoutAmount: number
}

export class InitiatePayoutSceneHelper {
  static getPayoutDescriptionMessage(data: IInitiatePayoutSceneState): string {
    const { staffUserProfile, payoutDate, payoutAmount } = data
    return (
      `💼 Інформація про виплату:\n\n` +
      `👤 Працівник: <b>${UserHelper.getFullName(staffUserProfile.firstName, staffUserProfile.lastName)}</b>\n` +
      `📅 Дата виплати: <b>${payoutDate}</b>\n` +
      `💰 Сума виплати: <b>${PassHelper.toDisplayPrice(payoutAmount)}</b>\n`
    )
  }

  static getStaffInfoMessage(data: IInitiatePayoutSceneState): string {
    const { payoutDate, payoutAmount } = data
    return (
      `💰 Вам нараховано зарплату!\n\n` +
      `📅 Дата нарахування: <b>${payoutDate}</b>\n` +
      `💸 Сума до виплати: <b>${PassHelper.toDisplayPrice(payoutAmount)}</b>\n`
    )
  }

  static getConfirmPayoutMessage(data: IInitiatePayoutSceneState): string {
    const { staffUserProfile, payoutDate, payoutAmount } = data
    return (
      `💼 Підтвердження виплати:\n\n` +
      `👤 Працівник: <b>${UserHelper.getFullName(staffUserProfile.firstName, staffUserProfile.lastName)}</b>\n` +
      `📅 Дата виплати: <b>${payoutDate}</b>\n` +
      `💰 Сума виплати: <b>${PassHelper.toDisplayPrice(payoutAmount)}</b>\n`
    )
  }
}
