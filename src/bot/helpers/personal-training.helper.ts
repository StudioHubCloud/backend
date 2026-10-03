import { PersonalTrainingSignupStatusEnum, DATE_FORMAT } from '@app/libs'
import { DateTimeProvider } from '@app/infrastructure/providers'
import { PassSelectModel, PassTemplateSelectModel } from '@app/infrastructure/database'
import { GetPersonalTrainingSignupListItem } from '../libs'
import { TextHelper } from './text.helper'
import { UserHelper } from './user.helper'
import { PassHelper } from './pass.helper'

export class PersonalTrainingHelper {
  private static formatLine(signup: GetPersonalTrainingSignupListItem, dateTimeProvider: DateTimeProvider): string {
    const date = dateTimeProvider.formatDateStringInTz(signup.scheduledAt, 'dd MMMM, HH:mm')
    const trainerName = UserHelper.getDisplayName(signup.staffMember?.userProfile ?? null)
    return `• <i>${date}</i> — ${trainerName}`
  }

  /**
   * Splits signups into upcoming and past, dropping cancelled ones.
   * Shared by the client cabinet and the admin pass screen so both always agree.
   */
  private static buildHistoryBlock(
    signups: GetPersonalTrainingSignupListItem[],
    dateTimeProvider: DateTimeProvider,
  ): string {
    const active = signups.filter((s) => s.status !== PersonalTrainingSignupStatusEnum.CANCELED)

    if (!active.length) {
      return ''
    }

    const now = Date.now()
    const upcoming = active.filter((s) => new Date(s.scheduledAt).getTime() >= now)
    const past = active.filter((s) => new Date(s.scheduledAt).getTime() < now)

    const blocks: string[] = []

    if (upcoming.length) {
      const lines = [...upcoming]
        .sort((a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime())
        .map((s) => this.formatLine(s, dateTimeProvider))
        .join('\n')
      blocks.push(`🗓️ ${TextHelper.bold('Заплановані:')}\n${lines}`)
    }

    if (past.length) {
      const lines = past.map((s) => this.formatLine(s, dateTimeProvider)).join('\n')
      blocks.push(`🏅 ${TextHelper.bold('Відбулись:')}\n${lines}`)
    }

    return blocks.join('\n\n')
  }

  /** The client's individual-pass cabinet: pass header + session history. */
  static getClientCabinetMessage(
    pass: PassSelectModel & { passTemplate: PassTemplateSelectModel },
    signups: GetPersonalTrainingSignupListItem[],
    dateTimeProvider: DateTimeProvider,
  ): string {
    const header = PassHelper.getPassInfoMessage(pass, dateTimeProvider)
    const history = this.buildHistoryBlock(signups, dateTimeProvider)

    if (!history) {
      return `${header}\n\n<i>Індивідуальних тренувань поки немає</i>`
    }

    return `${header}\n\n${history}`
  }

  /** Same history block, appended to the admin's pass-manage screen. */
  static getAdminHistoryBlock(signups: GetPersonalTrainingSignupListItem[], dateTimeProvider: DateTimeProvider): string {
    const history = this.buildHistoryBlock(signups, dateTimeProvider)
    return history || `<i>Індивідуальних тренувань поки немає</i>`
  }

  static getRegisterConfirmMessage(
    clientName: string,
    trainerName: string,
    scheduledAt: string,
    dateTimeProvider: DateTimeProvider,
  ): string {
    const date = TextHelper.capitalize(dateTimeProvider.formatDateStringInTz(scheduledAt, DATE_FORMAT.TRAINING_DISPLAY))
    return (
      `🤝 ${TextHelper.bold('Підтвердження запису на індивідуальне тренування:')}\n\n` +
      `👤 Клієнт: ${TextHelper.bold(clientName)}\n` +
      `👨‍🏫 Тренер: ${TextHelper.bold(trainerName)}\n` +
      `🗓️ ${date}`
    )
  }

  static getClientRegisteredMessage(
    trainerName: string,
    scheduledAt: string,
    remainingSlots: number,
    dateTimeProvider: DateTimeProvider,
  ): string {
    const date = TextHelper.capitalize(dateTimeProvider.formatDateStringInTz(scheduledAt, DATE_FORMAT.TRAINING_DISPLAY))
    return (
      `🤝 ${TextHelper.bold('Тебе записано на індивідуальне тренування!')}\n\n` +
      `👨‍🏫 Тренер: ${TextHelper.bold(trainerName)}\n` +
      `🗓️ ${date}\n\n` +
      `📌 ${TextHelper.bold('Залишилось тренувань:')} ${remainingSlots}`
    )
  }

  static getClientCanceledMessage(scheduledAt: string, remainingSlots: number, dateTimeProvider: DateTimeProvider): string {
    const date = TextHelper.capitalize(dateTimeProvider.formatDateStringInTz(scheduledAt, DATE_FORMAT.TRAINING_DISPLAY))
    return (
      `❌ ${TextHelper.bold('Індивідуальне тренування скасовано')}\n\n` +
      `🗓️ ${date}\n\n` +
      `📌 ${TextHelper.bold('Залишилось тренувань:')} ${remainingSlots}\n\n` +
      `<i>За уточненнями звертайся до адміністратора</i> 🙏`
    )
  }
}
