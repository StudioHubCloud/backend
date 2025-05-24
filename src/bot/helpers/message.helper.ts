import { UserProfileRoleEnum } from '@app/libs'
import { TextHelper } from './text.helper'
import { IRegisterSceneState } from '../libs'

export class MessageHelper {
  static getAgeRestrictionMessage(minAge: number | null = null, maxAge: number | null = null): string {
    const minAgeText = minAge ? `від ${minAge} років` : ''
    const maxAgeText = maxAge ? ` до ${maxAge} років` : ''
    return `📢 Увага!\n\n💖 Для цієї групи є вікові обмеження:${minAgeText}${maxAgeText}`
  }

  static getVerifyRequestMessage(
    data: Partial<IRegisterSceneState>,
    { completed = false, role }: { completed?: boolean; role: UserProfileRoleEnum },
  ) {
    const { firstName, date_of_birth, lastName, phone } = data
    const modeText = completed
      ? `${role === UserProfileRoleEnum.CLIENT ? 'Клієнт' : 'Тренер'} відправив запит на реєстрацію: ✅\n\n`
      : `Підтвердіть дані: ✅\n\n`
    return (
      modeText +
      `➡️ Ім'я: ${TextHelper.bold(`${firstName}${lastName ? ` ${lastName}` : ''}`)}${phone ? `\n➡️ Номер телефону: ${TextHelper.bold(phone)}` : ''}${date_of_birth ? `\n➡️ Дата народження: ${TextHelper.bold(date_of_birth)}` : ''}`
    )
  }
}
