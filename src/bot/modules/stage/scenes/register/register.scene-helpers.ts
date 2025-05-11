import { TextHelper } from '@app/bot/helpers'
import { UserProfileRoleEnum } from '@app/libs'

export interface IRegisterSceneState {
  firstName: string
  lastName?: string
  phone?: string
  date_of_birth?: string
}

export class RegisterSceneHelpers {
  static prepareInfoText = (
    data: Partial<IRegisterSceneState>,
    { completed = false, role }: { completed?: boolean; role: UserProfileRoleEnum },
  ) => {
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
