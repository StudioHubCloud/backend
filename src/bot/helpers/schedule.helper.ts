import { format, parse } from 'date-fns'
import { uk } from 'date-fns/locale'
import { GroupSelectModel, PersonalTrainingSignupSelectModel, TrainingSelectModel, UserProfileSelectModel } from '@app/infrastructure/database'
import { DateTimeProvider } from '@app/infrastructure/providers'
import { DATE_FORMAT } from '@app/libs'
import { TextHelper } from './text.helper'
import { UserHelper } from './user.helper'
import { PersonalTrainingHelper, IStaffPersonalSession } from './personal-training.helper'

type TTrainerRef = { userProfile: UserProfileSelectModel | null } | null

export type TScheduleTraining = TrainingSelectModel & {
  group: GroupSelectModel & { trainer: TTrainerRef }
  trainer: TTrainerRef // substitute trainer
  trainingSignups: { id: string }[] // active signups
}

export type TScheduleSession = PersonalTrainingSignupSelectModel & IStaffPersonalSession & { staffMember: TTrainerRef }

/** One line of a studio schedule day, group training or individual session, in time order. */
export type TScheduleItem = { start: string; training: TScheduleTraining; session?: never } | { start: string; session: TScheduleSession; training?: never }

/** Studio schedule day ("📅 Розклад студії"): the day's group trainings and individual sessions as one timeline. */
export class ScheduleHelper {
  /** "Неділя, 4 жовтня 2026" for a yyyy-MM-dd date. */
  static getDayTitle(date: string): string {
    return TextHelper.capitalize(format(parse(date, DATE_FORMAT.DATE_MAIN, new Date()), 'EEEE, d MMMM yyyy', { locale: uk }))
  }

  /** "3 жовт." for the day arrows. */
  static getShortDate(date: string): string {
    return format(parse(date, DATE_FORMAT.DATE_MAIN, new Date()), 'd MMM', { locale: uk })
  }

  static getItems(trainings: TScheduleTraining[], sessions: TScheduleSession[]): TScheduleItem[] {
    const items: TScheduleItem[] = [
      ...trainings.map((training) => ({ start: training.date, training })),
      ...sessions.map((session) => ({ start: session.scheduledAt, session })),
    ]
    return items.sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime())
  }

  /** The day as a timeline: "17:00  👯‍♀️ K-Pop 10+ · Анна · 6 записів", "18:30  🤝 INDIVIDUAL · Юлія → Анна". */
  static getDayMessage(date: string, items: TScheduleItem[], dateTimeProvider: DateTimeProvider): string {
    const header = `📅 ${TextHelper.bold(this.getDayTitle(date))}`

    if (!items.length) {
      return `${header}\n\n<i>У цей день занять немає</i>`
    }

    const lines = items.map((item) => {
      const time = TextHelper.bold(dateTimeProvider.formatDateStringInTz(item.start, DATE_FORMAT.TIME_MAIN))

      if (item.training) {
        const { training } = item
        const name = TextHelper.escapeHtml(training.group.name)
        if (training.isCancelled) {
          return `${time}  ❌ ${TextHelper.strikethrough(name)} · скасовано`
        }
        const trainer = this.getTrainerName(training.trainer ?? training.group.trainer)
        const signups = training.trainingSignups.length
        return `${time}  👯‍♀️ ${name} · ${trainer} · ${signups} ${TextHelper.pluralize(signups, ['запис', 'записи', 'записів'])}`
      }

      const { session } = item
      const title = TextHelper.escapeHtml(PersonalTrainingHelper.getSessionTitle(session))
      const participants = TextHelper.escapeHtml(PersonalTrainingHelper.getSessionParticipants(session))
      return `${time}  🤝 ${title} · ${participants} → ${this.getTrainerName(session.staffMember)}`
    })

    return `${header}\n\n${lines.join('\n')}`
  }

  /** Short trainer name for a schedule line (first name, else the display name). HTML-escaped. */
  private static getTrainerName(trainer: TTrainerRef): string {
    const userProfile = trainer?.userProfile ?? null
    return TextHelper.escapeHtml(userProfile?.firstName || UserHelper.getDisplayName(userProfile))
  }
}
