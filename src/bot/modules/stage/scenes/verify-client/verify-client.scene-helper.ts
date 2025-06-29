import { PassHelper } from '@app/bot/helpers'
import { PassTemplateSelectModel, UserProfileSelectModel } from '@app/infrastructure/database'

export interface IVerifyClientSceneState {
  userProfile: UserProfileSelectModel
  passTemplate: PassTemplateSelectModel
  saleDate: string
}

export class VerifyClientSceneHelper {
  static getInfoMessageForConfirm(data: IVerifyClientSceneState): string {
    const { userProfile, passTemplate } = data
    return (
      `Ви підтверджуєте реєстрацію клієнта:\n\n` +
      `👤 Ім'я: <b>${userProfile.firstName} ${userProfile.lastName}</b>\n` +
      `📞 Номер телефону: <b>${userProfile.phoneNumber}</b>\n` +
      `🎂 Дата народження: <b>${userProfile.dateOfBirth}</b>\n\n` +
      `🎫 Абонемент:\n` +
      `➡️ Назва: <b>${passTemplate.name}</b>\n` +
      `💰 Ціна: <b>${PassHelper.toDisplayPrice(passTemplate.price)}</b>\n` +
      `➡️ Кількість тренувань: <b>${passTemplate.length}</b>\n` +
      `➡️ Тип: <b>${PassHelper.getPassTemplateTypeLabel(passTemplate.type)}</b>\n`
    )
  }

  static getClientInfoMessage(data: IVerifyClientSceneState): string {
    const { userProfile, passTemplate, saleDate } = data
    return (
      `🎉 Вітаємо, ${userProfile.firstName}! 🎉\n\n` +
      `Твій абонемент чекає на тебе! 💫\n\n` +
      `➡️ Назва: <b>${passTemplate.name}</b>\n` +
      `➡️ Кількість тренувань: <b>${passTemplate.length}</b>\n` +
      `📅 Дата покупки: <b>${saleDate}</b>\n\n` +
      `💫 <b>Як це працює:</b>\n` +
      `🕐 Маєш <b>7 днів</b> на старт\n` +
      `✨ Абонемент «оживе» з першим заняттям\n` +
      `⏰ Або сам активується через тиждень\n` +
      `📆 Діятиме <b>30 днів</b> з моменту активації\n\n` +
      `🔥 Обирай напрямок і вперед — створювати свою найкращу версію!`
    )
  }
}
