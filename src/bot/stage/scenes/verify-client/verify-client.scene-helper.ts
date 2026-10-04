import { PassHelper, UserHelper } from '@app/bot/helpers'
import { PassTemplateSelectModel, UserProfileSelectModel } from '@app/infrastructure/database'
import { PassTemplateTypeEnum } from '@app/libs'

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
    const isGroupPass = passTemplate.type === PassTemplateTypeEnum.GROUP
    return (
      `🎉 Вітаємо, ${userProfile.firstName}! 🎉\n` +
      `Твій абонемент чекає на тебе! 💫\n\n` +
      `➡️ Назва: <b>${passTemplate.name}</b>\n` +
      `➡️ Кількість тренувань: <b>${passTemplate.length}</b>\n` +
      `📅 Дата покупки: <b>${saleDate}</b>\n\n` +
      `Як це працює:\n` +
      `${PassHelper.getActivationInfo(passTemplate)}\n\n` +
      (isGroupPass
        ? `Обирай напрямок і вперед створювати свою найкращу версію разом з нами! 🌸`
        : `Вперед створювати свою найкращу версію разом з нами! 🌸`)
    )
  }
}
