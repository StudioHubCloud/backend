import { PassHelper } from '@app/bot/helpers'
import { PassTemplateSelectModel, UserProfileSelectModel } from '@app/infrastructure/database'

export interface IVerifyClientSceneState {
  userProfile: UserProfileSelectModel
  passTemplate: PassTemplateSelectModel
  startDate: string
  endDate: string
}

export class VerifyClientSceneHelper {
  static getInfoMessageForConfirm(data: IVerifyClientSceneState): string {
    const { userProfile, passTemplate, startDate, endDate } = data
    return (
      `Ви підтверджуєте реєстрацію клієнта:\n\n` +
      `👤 Ім'я: <b>${userProfile.firstName} ${userProfile.lastName}</b>\n` +
      `📞 Номер телефону: <b>${userProfile.phoneNumber}</b>\n` +
      `🎂 Дата народження: <b>${userProfile.dateOfBirth}</b>\n\n` +
      `🎫 Абонемент:\n\n` +
      `➡️ Назва: <b>${passTemplate.name}</b>\n` +
      `💰 Ціна: <b>${PassHelper.toDisplayPrice(passTemplate.price)}</b>\n` +
      `➡️ Кількість тренувань: <b>${passTemplate.length}</b>\n` +
      `➡️ Тип: <b>${PassHelper.getPassTemplateTypeLabel(passTemplate.type)}</b>\n` +
      `📅 Початок дії: <b>${startDate}</b>\n` +
      `📅 Закінчення дії: <b>${endDate}</b>`
    )
  }

  static getClientInfoMessage(data: IVerifyClientSceneState): string {
    const { userProfile, passTemplate, startDate, endDate } = data
    return (
      `🎉 Вітаємо, ${userProfile.firstName}! 🎉\n\n` +
      `Ваш абонемент активовано!\n\n` +
      `🎫 Інформація про ваш абонемент:\n\n` +
      `➡️ Назва: <b>${passTemplate.name}</b>\n` +
      `➡️ Кількість тренувань: <b>${passTemplate.length}</b>\n` +
      `📅 Початок дії: <b>${startDate}</b>\n` +
      `🗓 Закінчення дії: <b>${endDate}</b>\n\n` +
      `Чекаємо вас на тренуваннях! 💪`
    )
  }
}
