import { PassHelper, TextHelper, UserHelper } from '@app/bot/helpers'
import { BUTTON_PATTERNS } from '@app/bot/static/button-patterns'
import { PassTemplateSelectModel, UserProfileSelectModel } from '@app/infrastructure/database'
import { PassGroupModeEnum, PassTemplateTypeEnum } from '@app/libs'

export interface IVerifyClientSceneState {
  userProfile: UserProfileSelectModel
  passTemplate: PassTemplateSelectModel
  saleDate: string
  /** Groups a FIXED pass is bound to (picked at registration, confirmed or changed by the admin; several for PRO) */
  groupIds?: number[]
  groupNames?: string[]
  /** The group the client picked at registration (first and green in the list) */
  suggestedGroupId?: number | null
  /** Open inline group list, removed when leaving the step */
  groupListMessageId?: number | null
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
      `➡️ Тип: <b>${PassHelper.getPassTemplateTypeLabel(passTemplate.type)}</b>\n` +
      PassHelper.getGroupLine(data.passTemplate, data.groupNames ?? [])
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
      `${PassHelper.getActivationInfo(passTemplate)}\n\n` +
      this.getClientGroupInfo(data)
    )
  }

  /** What the client can sign up for with the new pass. */
  private static getClientGroupInfo({ passTemplate, groupNames = [] }: IVerifyClientSceneState): string {
    if (passTemplate.type !== PassTemplateTypeEnum.GROUP) {
      return `Вперед створювати свою найкращу версію разом з нами! 🌸`
    }
    if (passTemplate.groupMode === PassGroupModeEnum.FLEX) {
      return `З цим абонементом можна ходити в будь-яку групу — обирай напрямок і вперед створювати свою найкращу версію разом з нами! 🌸`
    }
    return (
      `👯‍♀️ ${PassHelper.getClientGroupsText(groupNames)}\n` +
      `Записуйся на тренування через «${BUTTON_PATTERNS.SCHEDULE}» і вперед створювати свою найкращу версію разом з нами! 🌸`
    )
  }
}
