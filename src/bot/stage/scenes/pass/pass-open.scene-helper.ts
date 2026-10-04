import { UserProfileWithClient, PassTemplateWithAgeRestrictions } from '@app/bot/libs'
import { TextHelper, MessageHelper, PassHelper } from '@app/bot/helpers'
import { PassSelectModel, PassTemplateSelectModel, UserProfileSelectModel } from '@app/infrastructure/database'
import { PassTemplateTypeEnum } from '@app/libs'

export interface IPassOpenSceneState {
  userProfile: UserProfileWithClient
  passTemplate: PassTemplateWithAgeRestrictions
  startMessageId: number
  mainMessageId: number
  saleDate: string
  selectedPassType: PassTemplateTypeEnum | null
  originalPass: PassSelectModel & {
    client: { userProfile: UserProfileSelectModel | null } | null
    passTemplate: PassTemplateSelectModel
  }
  newPassId: string
}

export class PassOpenSceneHelper {
  static getInfoMessageForConfirm(data: IPassOpenSceneState): string {
    const { userProfile, passTemplate } = data

    const userInfo = `👤 Клієнт: ${userProfile.firstName} ${userProfile.lastName}`
    const passInfo = MessageHelper.constructPassSelectMessage(passTemplate, true)

    return `${TextHelper.bold('❓ Підтвердити відкриття абонементу?')}\n\n${userInfo}\n\n${passInfo}\n\nℹ️ <i>При підтврердженні клієнт отримає сповіщення про відкриття абонементу.</i>`
  }

  static getClientInfoMessage(data: IPassOpenSceneState): string {
    const { passTemplate } = data
    const { length, name } = passTemplate
    const passInfo = `ℹ️ Назва абонементу "${TextHelper.bold(name)}"\n🎫 Кількість: ${TextHelper.bold(`${length} тренувань`)}`
    return `${TextHelper.bold('🔥🎉 Вам відкрито новий абонемент!')}\n\n${passInfo}\n\n${PassHelper.getActivationInfo(passTemplate)}`
  }
}
