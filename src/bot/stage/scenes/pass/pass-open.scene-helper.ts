import { UserProfileWithClient, PassTemplateWithAgeRestrictions } from '@app/bot/libs'
import { TextHelper, MessageHelper, PassHelper } from '@app/bot/helpers'
import { PassSelectModel, PassTemplateSelectModel, UserProfileSelectModel } from '@app/infrastructure/database'
import { PassGroupModeEnum, PassTemplateTypeEnum } from '@app/libs'

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
  /** Group a FIXED group pass is bound to */
  groupId?: number | null
  groupName?: string
}

export class PassOpenSceneHelper {
  static getInfoMessageForConfirm(data: IPassOpenSceneState): string {
    const { userProfile, passTemplate } = data

    const userInfo = `👤 Клієнт: ${userProfile.firstName} ${userProfile.lastName}`
    const passInfo = MessageHelper.constructPassSelectMessage(passTemplate, true)

    const groupLine = PassHelper.getGroupLine(passTemplate, data.groupName)

    return `${TextHelper.bold('❓ Підтвердити відкриття абонементу?')}\n\n${userInfo}\n\n${passInfo}\n${groupLine}\nℹ️ <i>При підтврердженні клієнт отримає сповіщення про відкриття абонементу.</i>`
  }

  static getClientInfoMessage(data: IPassOpenSceneState): string {
    const { passTemplate, groupName } = data
    const { length, name } = passTemplate
    const passInfo = `ℹ️ Назва абонементу "${TextHelper.bold(name)}"\n🎫 Кількість: ${TextHelper.bold(`${length} тренувань`)}`
    return `${TextHelper.bold('🔥🎉 У тебе новий абонемент!')}\n\n${passInfo}${this.getClientGroupLine(passTemplate, groupName)}\n\n${PassHelper.getActivationInfo(passTemplate)}`
  }

  /** Where the client can train with the new pass. */
  private static getClientGroupLine(passTemplate: IPassOpenSceneState['passTemplate'], groupName?: string): string {
    if (passTemplate.type !== PassTemplateTypeEnum.GROUP) {
      return ''
    }
    return passTemplate.groupMode === PassGroupModeEnum.FLEX
      ? `\n👯‍♀️ Можна ходити в будь-яку групу`
      : `\n👯‍♀️ Твоя група — ${TextHelper.bold(TextHelper.escapeHtml(groupName ?? ''))}`
  }
}
