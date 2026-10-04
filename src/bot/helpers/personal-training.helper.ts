import { AuditLogActions, AuditLogTrigger, PersonalTrainingSignupStatusEnum, DATE_FORMAT } from '@app/libs'
import { DateTimeProvider } from '@app/infrastructure/providers'
import { PassSelectModel, PassTemplateSelectModel, StudioPriceSelectModel, UserProfileSelectModel } from '@app/infrastructure/database'
import { GetPersonalTrainingSignupListItem } from '../libs'
import { TextHelper } from './text.helper'
import { UserHelper } from './user.helper'
import { PassHelper } from './pass.helper'
import { BotHelper } from './bot.helper'
import { AuditLogHelper } from './audit-log.helper'
import { BotContext } from '../bot.context'
import { MESSAGES_SCENE } from '../static/messages'
import type { PersonalTrainingSignupService } from '@app/domain/personal-training-signup'
import type { PassService } from '@app/domain/pass'

/** What a trainer needs to know about one individual session: one-off (price + note) or pass session (pass + client). */
export interface IStaffPersonalSession {
  scheduledAt: string
  participantsNote: string | null
  studioPrice?: StudioPriceSelectModel | null
  pass?: { passTemplate: PassTemplateSelectModel } | null
  client?: { userProfile: Pick<UserProfileSelectModel, 'firstName' | 'lastName' | 'fullName'> | null } | null
}

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

  /** "✅ Мої активні записи" for an individual pass: planned (future, not cancelled) sessions, or null when none. */
  static getClientUpcomingMessage(signups: GetPersonalTrainingSignupListItem[], dateTimeProvider: DateTimeProvider): string | null {
    const now = Date.now()
    const upcoming = signups
      .filter((s) => s.status !== PersonalTrainingSignupStatusEnum.CANCELED && new Date(s.scheduledAt).getTime() >= now)
      .sort((a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime())

    if (!upcoming.length) {
      return null
    }

    const lines = upcoming.map((s) => this.formatLine(s, dateTimeProvider)).join('\n')
    return (
      `🤝 ${TextHelper.bold('Твої заплановані індивідуальні тренування:')}\n${lines}\n\n` +
      `<i>Змінити чи скасувати тренування можна через адміністратора</i> 🙏`
    )
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

  /** "DUO" / "INDIVIDUAL" — the one-off price name or the client's pass name. Raw text: escape it for HTML. */
  static getSessionTitle(session: IStaffPersonalSession): string {
    return session.studioPrice?.name ?? session.pass?.passTemplate.name ?? 'Індивідуальне'
  }

  /** Who the session is with: the one-off participants note or the client's name. Raw text: escape it for HTML. */
  static getSessionParticipants(session: IStaffPersonalSession): string {
    const userProfile = session.client?.userProfile
    const clientName = userProfile
      ? userProfile.fullName || [userProfile.firstName, userProfile.lastName].filter(Boolean).join(' ')
      : ''
    return session.participantsNote ?? (clientName || '—')
  }

  /** 📝 for a one-off's free-text note (names, wishes, anything), 👤 for a pass session's client. */
  static getSessionParticipantsIcon(session: IStaffPersonalSession): string {
    return session.participantsNote ? '📝' : '👤'
  }

  private static getSessionBlock(session: IStaffPersonalSession, dateTimeProvider: DateTimeProvider): string {
    const date = TextHelper.capitalize(dateTimeProvider.formatDateStringInTz(session.scheduledAt, DATE_FORMAT.TRAINING_DISPLAY))
    return (
      `💳 Заняття: ${TextHelper.bold(TextHelper.escapeHtml(this.getSessionTitle(session)))}\n` +
      `${this.getSessionParticipantsIcon(session)} ${session.participantsNote ? 'Нотатка' : 'Клієнт'}: ${TextHelper.bold(TextHelper.escapeHtml(this.getSessionParticipants(session)))}\n` +
      `🗓️ ${date}`
    )
  }

  /** Admin confirmation before registering a one-off session. */
  static getOneOffConfirmMessage(
    trainerName: string,
    session: IStaffPersonalSession & { studioPrice: StudioPriceSelectModel },
    dateTimeProvider: DateTimeProvider,
  ): string {
    return (
      `➕ ${TextHelper.bold('Підтвердження разового заняття:')}\n\n` +
      `👨‍🏫 Тренер: ${TextHelper.bold(trainerName)}\n` +
      `${this.getSessionBlock(session, dateTimeProvider)}\n` +
      `💰 Вартість: ${TextHelper.bold(PassHelper.toDisplayPrice(session.studioPrice.price))}`
    )
  }

  static getTrainerRegisteredMessage(session: IStaffPersonalSession, dateTimeProvider: DateTimeProvider): string {
    return `📌 ${TextHelper.bold('Вам зареєстровано індивідуальне заняття')}\n\n${this.getSessionBlock(session, dateTimeProvider)}`
  }

  static getTrainerCanceledMessage(session: IStaffPersonalSession, dateTimeProvider: DateTimeProvider): string {
    return `❌ ${TextHelper.bold('Індивідуальне заняття скасовано')}\n\n${this.getSessionBlock(session, dateTimeProvider)}`
  }

  /** Trainer's upcoming individual sessions (both kinds), or a placeholder when there are none. */
  static getStaffUpcomingMessage(
    trainerName: string,
    sessions: IStaffPersonalSession[],
    days: number,
    dateTimeProvider: DateTimeProvider,
  ): string {
    const header = `🤝 ${TextHelper.bold('Заплановані індивідуальні заняття')} — ${TextHelper.escapeHtml(trainerName)}\n<i>Найближчі ${days} днів. Далі — у «📅 Розклад студії».</i>`

    if (!sessions.length) {
      return `${header}\n\n<i>Запланованих занять немає</i>`
    }

    const lines = sessions
      .map((session) => {
        const date = dateTimeProvider.formatDateStringInTz(session.scheduledAt, 'EEEEEE, dd MMMM, HH:mm')
        const title = TextHelper.escapeHtml(this.getSessionTitle(session))
        const participants = TextHelper.escapeHtml(this.getSessionParticipants(session))
        return `• <b>${date}</b> — ${title}\n    ${this.getSessionParticipantsIcon(session)} <i>${participants}</i>`
      })
      .join('\n')

    return `${header}\n\n${lines}`
  }

  /**
   * Admin cancel of any individual session (one-off or pass), shared by the client and the trainer menus:
   * guards, cancel (a pass session's slot goes back to the pass), audit, and notifications to the client
   * (pass sessions) and the trainer. Returns the cancelled signup, or null when refused (an alert was shown).
   */
  static async cancelByAdmin(
    ctx: BotContext,
    signupId: string,
    services: { personalTrainingSignupService: PersonalTrainingSignupService; passService: PassService },
    dateTimeProvider: DateTimeProvider,
  ) {
    const signup = await services.personalTrainingSignupService.findById(signupId)

    if (!signup || signup.status !== PersonalTrainingSignupStatusEnum.SCHEDULED) {
      BotHelper.safeAnswerCbQuery(ctx, '⚠️ Це заняття більше недоступне або вже було скасоване', { show_alert: true })
      await BotHelper.safeDeleteMessage(ctx)
      return null
    }

    if (signup.staffMemberPayoutId) {
      BotHelper.safeAnswerCbQuery(ctx, '💰 Це заняття вже оплачене тренеру, його не можна скасувати', { show_alert: true })
      await BotHelper.safeDeleteMessage(ctx)
      return null
    }

    const [canceled, logOperations] = await services.personalTrainingSignupService.cancelTraining(signupId)
    AuditLogHelper.startAction(ctx, AuditLogActions.PERSONAL_TRAINING_CANCEL, AuditLogTrigger.ADMIN_ACTION, logOperations)

    BotHelper.safeAnswerCbQuery(
      ctx,
      canceled.passId ? MESSAGES_SCENE.PERSONAL_TRAINING_REGISTER.CANCEL_SUCCESS : MESSAGES_SCENE.ONE_OFF_TRAINING_REGISTER.CANCEL_SUCCESS,
      { show_alert: true },
    )

    if (signup.client?.userProfile) {
      const updatedPass = canceled.passId ? await services.passService.getPassById(canceled.passId) : null
      await BotHelper.safeSendMessage(
        ctx.telegram,
        signup.client.userProfile.telegramId,
        this.getClientCanceledMessage(canceled.scheduledAt, updatedPass?.availableSlots ?? 0, dateTimeProvider),
      )
    }

    if (signup.staffMember?.userProfile) {
      await BotHelper.safeSendMessage(
        ctx.telegram,
        signup.staffMember.userProfile.telegramId,
        this.getTrainerCanceledMessage(signup, dateTimeProvider),
      )
    }

    return signup
  }

  /** One session for the admin (studio schedule): trainer, kind, who, time, whether it's already paid out. */
  static getAdminSessionMessage(
    session: IStaffPersonalSession & {
      staffMemberPayoutId: string | null
      staffMember: { userProfile: UserProfileSelectModel | null } | null
    },
    dateTimeProvider: DateTimeProvider,
  ): string {
    const trainerName = UserHelper.getDisplayName(session.staffMember?.userProfile ?? null)
    const paid = session.staffMemberPayoutId ? `\n\n💰 <i>Вже оплачено тренеру</i>` : ''
    return (
      `🤝 ${TextHelper.bold(session.studioPrice ? 'Разове заняття' : 'Заняття з абонемента')}\n\n` +
      `👨‍🏫 Тренер: ${TextHelper.bold(TextHelper.escapeHtml(trainerName))}\n` +
      `${this.getSessionBlock(session, dateTimeProvider)}${paid}`
    )
  }

  /** Client reminder a few hours before a pass session (same tone as the group training reminder). */
  static getClientReminderMessage(
    clientFirstName: string,
    trainerName: string,
    scheduledAt: string,
    dateTimeProvider: DateTimeProvider,
  ): string {
    const time = dateTimeProvider.formatDateStringInTz(scheduledAt, DATE_FORMAT.TIME_MAIN)
    return (
      `Привіт, ${TextHelper.escapeHtml(clientFirstName)}!🌸\n` +
      `Нагадуємо про твоє індивідуальне тренування об ${TextHelper.bold(time)} з тренером ${TextHelper.bold(TextHelper.escapeHtml(trainerName))}\n` +
      `До зустрічі 💖`
    )
  }

  /** Trainer reminder a few hours before any of their individual sessions. */
  static getTrainerReminderMessage(session: IStaffPersonalSession, dateTimeProvider: DateTimeProvider): string {
    return `⏰ ${TextHelper.bold('Нагадування: скоро індивідуальне заняття')}\n\n${this.getSessionBlock(session, dateTimeProvider)}`
  }
}
