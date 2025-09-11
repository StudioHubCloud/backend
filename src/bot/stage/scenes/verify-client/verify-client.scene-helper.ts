import { PassHelper, UserHelper } from '@app/bot/helpers'
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
      `👤 Ім'я: <b>${UserHelper.getDisplayName(userProfile)}</b>\n` +
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
      `🎉 Вітаємо, ${userProfile.firstName}! 🎉\n` +
      `Твій абонемент чекає на тебе! 💫\n\n` +
      `➡️ Назва: <b>${passTemplate.name}</b>\n` +
      `➡️ Кількість тренувань: <b>${passTemplate.length}</b>\n` +
      `📅 Дата покупки: <b>${saleDate}</b>\n\n` +
      `Як це працює:\n` +
      `🕐 У тебе є <b>7 днів</b>, щоб розпочати\n` +
      `✨ Абонемент активується з першого заняття, або автоматично через тиждень\n` +
      `📆 Після активації діятиме <b>30 днів</b>\n\n` +
      `Обирай напрямок і вперед створювати свою найкращу версію разом з нами! 🌸`
    )
  }
}
