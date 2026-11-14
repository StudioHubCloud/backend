import { UserProfileWithClient, PassTemplateWithAgeRestrictions } from '@app/bot/libs'
import { TextHelper, MessageHelper, PassHelper, UserHelper } from '@app/bot/helpers'
import { PassSelectModel, PassTemplateSelectModel, UserProfileSelectModel } from '@app/infrastructure/database'
import { PassGroupModeEnum, PassTemplateTypeEnum } from '@app/libs'
import { MESSAGES_SCENE } from '@app/bot/static/messages'

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
  /** Groups a FIXED group pass is bound to: one, or several for a multi_group template (PRO) */
  groupIds?: number[]
  groupNames?: string[]
  /** Admin tapped "👀 Показати всі групи": the group list isn't limited by the client's age */
  showAllGroups?: boolean
  /** Picked groups outside the client's age: opening the pass adds an exception for each */
  ageExceptionIds?: number[]
}

export class PassOpenSceneHelper {
  static getInfoMessageForConfirm(data: IPassOpenSceneState): string {
    const { userProfile, passTemplate } = data

    const userInfo = `👤 Клієнт: ${UserHelper.getDisplayName(userProfile)}`
    const passInfo = MessageHelper.constructPassSelectMessage(passTemplate, true)

    const groupLine =
      PassHelper.getGroupLine(passTemplate, data.groupNames ?? []) +
      (data.ageExceptionIds?.length ? `\n${MESSAGES_SCENE.PASS_GROUP.AGE_EXCEPTION}\n` : '')

    return `${TextHelper.bold('❓ Підтвердити відкриття абонементу?')}\n\n${userInfo}\n\n${passInfo}\n${groupLine}\nℹ️ <i>При підтврердженні клієнт отримає сповіщення про відкриття абонементу.</i>`
  }

  static getClientInfoMessage(data: IPassOpenSceneState): string {
    const { passTemplate, groupNames = [] } = data
    const { length, name } = passTemplate
    const passInfo = `ℹ️ Назва абонементу "${TextHelper.bold(name)}"\n🎫 Кількість: ${TextHelper.bold(`${length} тренувань`)}`
    return `${TextHelper.bold('🔥🎉 У тебе новий абонемент!')}\n\n${passInfo}${this.getClientGroupLine(passTemplate, groupNames)}\n\n${PassHelper.getActivationInfo(passTemplate)}`
  }

  /** Where the client can train with the new pass. */
  private static getClientGroupLine(passTemplate: IPassOpenSceneState['passTemplate'], groupNames: string[]): string {
    if (passTemplate.type !== PassTemplateTypeEnum.GROUP) {
      return ''
    }
    return passTemplate.groupMode === PassGroupModeEnum.FLEX
      ? `\n👯‍♀️ Можна ходити в будь-яку групу`
      : `\n👯‍♀️ ${PassHelper.getClientGroupsText(groupNames)}`
  }
}
