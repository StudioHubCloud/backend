import { UserProfileWithClient, PassTemplateWithAgeRestrictions } from '@app/bot/libs'
import { TextHelper, MessageHelper } from '@app/bot/helpers'
import { PassTemplateAgeRestrictionSelectModel, PassTemplateSelectModel } from '@app/infrastructure/database'

export interface IPassOpenSceneState {
  userProfile: UserProfileWithClient
  passTemplate: PassTemplateWithAgeRestrictions
  saleDate: string
}

export class PassOpenSceneHelper {
  static getInfoMessageForConfirm(data: IPassOpenSceneState): string {
    const { userProfile, passTemplate, saleDate } = data

    const passInfo = MessageHelper.constructPassSelectMessage(passTemplate)
    const userInfo = `👤 ${TextHelper.bold('Клієнт:')}\n${userProfile.firstName} ${userProfile.lastName}\n📱 ${userProfile.phoneNumber}\n📅 ${userProfile.dateOfBirth}`
    const saleDateInfo = `📅 ${TextHelper.bold('Дата продажу:')}\n${saleDate}`

    return `${userInfo}\n\n${passInfo}\n\n${saleDateInfo}\n\n${TextHelper.bold('Підтвердити відкриття абонементу?')}`
  }

  static getClientInfoMessage(data: IPassOpenSceneState): string {
    const { userProfile, passTemplate, saleDate } = data

    const passInfo = MessageHelper.constructPassSelectMessage(passTemplate)
    const userInfo = `👤 ${TextHelper.bold('Вітаємо!')}\n${userProfile.firstName} ${userProfile.lastName}`
    const saleDateInfo = `📅 ${TextHelper.bold('Дата відкриття:')}\n${saleDate}`

    return `${userInfo}\n\n${passInfo}\n\n${saleDateInfo}\n\n${TextHelper.bold('Ваш абонемент успішно відкрито! 🎉')}`
  }
}
