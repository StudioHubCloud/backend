import {
  PassActivationRequestTypeEnum,
  TPayoutStatistics,
  TrainingSignupStatusEnum,
  TrainingSignupTypeEnum,
  TSalaryPayoutResult,
  UserProfileRoleEnum,
  UserProfileStatusEnum,
} from '@app/libs'
import { TextHelper } from './text.helper'
import { GetGroupByIdResponse, GetTrainingByIdResponse, IRegisterSceneState, PassTemplateWithAgeRestrictions } from '../libs'
import {
  GroupAgeRestrictionSelectModel,
  PassTemplateAgeRestrictionSelectModel,
  PassTemplateSelectModel,
  TrainingSignupSelectModel,
  UserProfileSelectModel,
} from '@app/infrastructure/database'
import { PassHelper } from './pass.helper'
import { DateTimeProvider } from '@app/infrastructure/providers'
import { UserHelper } from './user.helper'
import { BUTTON_PATTERNS } from '../static/button-patterns'

export class MessageHelper {
  static getAgeRestrictionMessage(minAge: number | null = null, maxAge: number | null = null): string {
    const minAgeText = minAge ? `від ${minAge} років` : ''
    const maxAgeText = maxAge ? ` до ${maxAge} років` : ''
    return `📢 <i>Увага!</i>\n💖 Для цієї групи є вікові обмеження: <b>${minAgeText}${maxAgeText}</b>`
  }

  static getAgeRestrictionsMessageShort(minAge: number | null = null, maxAge: number | null = null): string {
    if (minAge && maxAge) {
      return `${minAge}-${maxAge}`
    }
    if (maxAge) {
      return `${maxAge}+`
    }
    return ''
  }

  static getVerifyRequestMessage(
    data: Partial<IRegisterSceneState>,
    { completed = false, role }: { completed?: boolean; role: UserProfileRoleEnum },
  ) {
    const { firstName, date_of_birth, lastName, phone, telegramUsername, isCashPayment, groupName } = data
    const modeText = completed
      ? `${role === UserProfileRoleEnum.CLIENT ? 'Клієнт' : 'Тренер'} відправив запит на реєстрацію: ✅\n\n`
      : `🔍 Перевір, чи все вірно:\n\n`

    const mainContent = `👤 Ім'я: ${TextHelper.bold(`${UserHelper.getFullName(firstName!, lastName)}\n`)}${date_of_birth ? `\n➡️ Дата народження: ${TextHelper.bold(date_of_birth)}` : ''}${phone ? `\n➡️ Номер телефону: ${TextHelper.bold(phone)}` : ''}${telegramUsername ? `\n➡️ Telegram: ${TextHelper.bold(`@${telegramUsername}`)}` : ''}${groupName ? `\n👯‍♀️ Група: ${TextHelper.bold(TextHelper.escapeHtml(groupName))}` : ''}${isCashPayment ? `\n\n💵 <b>Оплата готівкою</b>` : ''}`

    return !completed
      ? `${modeText}${mainContent}\n\n👌 Якщо все правильно — тисни “✅ Підтвердити”\n❌ А якщо щось хочеш змінити — просто натисни “⬅️ Назад”`
      : `${modeText}${mainContent}`
  }

  static getClientPassPaymentRequestMessage(
    userProfile: UserProfileSelectModel,
    passTemplate: PassTemplateSelectModel,
    requestType: PassActivationRequestTypeEnum,
    groupName?: string | null,
  ) {
    const fullName = UserHelper.getDisplayName(userProfile)
    const price = PassHelper.toDisplayPrice(passTemplate.price)
    const requestTypeText = requestType === PassActivationRequestTypeEnum.PURCHASE ? 'Активацію' : 'Поновлення'
    return `Запит на <b><i>${requestTypeText} абонементу</i></b>\n\n👤 Клієнт: <i>${TextHelper.bold(fullName)}</i>\n\n📜 Назва: ${TextHelper.bold(passTemplate.name)}\n💰 Ціна: ${TextHelper.bold(price)}\n🎫 Кількість: ${TextHelper.bold(`${passTemplate.length} тренувань`)}\n${PassHelper.getGroupLine(passTemplate, groupName)}`
  }

  static constructPassSelectMessage(data: PassTemplateWithAgeRestrictions, withoutHeader?: boolean) {
    const { name, price, length, passTemplateAgeRestriction, durationDays } = data

    const ageRestrictionInfo = passTemplateAgeRestriction
      ? `👶 Вікові обмеження: ${TextHelper.bold(`${passTemplateAgeRestriction.minAge}-${passTemplateAgeRestriction.maxAge} років`)}`
      : '👶 Вікові обмеження відсутні'

    return (
      `${withoutHeader ? '' : `🎫 Інформація про абонемент "${TextHelper.italic(name)}":\n\n`}` +
      `💰 Ціна: ${TextHelper.bold(PassHelper.toDisplayPrice(price))}\n` +
      `🎫 Кількість: ${TextHelper.bold(`${length} тренувань`)}\n` +
      `📅 Тривалість: ${TextHelper.bold(`${durationDays} днів`)}\n` +
      `${ageRestrictionInfo}`
    )
  }

  static constructGroupSelectMessage(group: GetGroupByIdResponse) {
    const { name, groupStyle, groupAgeRestrictions } = group

    const ageRestrictionInfo = groupAgeRestrictions ? `\n${this.makeGroupAgeRestrictionMessage(groupAgeRestrictions, '🔹')}` : ''

    return `📌 Обрана група: <b>${name}</b>\n\n` + `🔹 Стиль: <b>${groupStyle.title}</b>\n` + `${ageRestrictionInfo}`
  }

  static constructTrainingSelectMessage(
    training: GetTrainingByIdResponse,
    group: GetGroupByIdResponse,
    dateTimeProvider: DateTimeProvider,
  ): string {
    const formattedDate = dateTimeProvider.formatDateStringInTz(training.date, 'dd MMMM')
    const formattedTime = dateTimeProvider.formatDateStringInTz(training.date, 'HH:mm')
    const formattedDay =
      dateTimeProvider.formatDateStringInTz(training.date, 'EEEE').charAt(0).toUpperCase() +
      dateTimeProvider.formatDateStringInTz(training.date, 'EEEE').slice(1)

    const { activeSignUpsCount, cancelledSignupsCount } = training.trainingSignups.reduce(
      (acc, signup) => {
        if (signup.status === TrainingSignupStatusEnum.ACTIVE) {
          acc.activeSignUpsCount += 1
        } else if (signup.status === TrainingSignupStatusEnum.CANCELED) {
          acc.cancelledSignupsCount += 1
        }
        return acc
      },
      { activeSignUpsCount: 0, cancelledSignupsCount: 0 },
    )

    const groupTrainer = group.trainer?.userProfile ? UserHelper.getDisplayName(group.trainer.userProfile) : null
    const trainingTrainer = training.trainer?.userProfile ? UserHelper.getDisplayName(training.trainer.userProfile) : null

    const assignedTrainer = trainingTrainer || groupTrainer

    const statusString = training.isCancelled ? '🚫 Тренування Скасоване' : '✅ Тренування Активне'
    const countString = training.isCancelled
      ? `📍 Скасованих Записів: <b>${cancelledSignupsCount}</b>\n\n`
      : `📍 Активних Записів: <b>${activeSignUpsCount}</b>\n\n`

    const trainerString = assignedTrainer
      ? `👤 Тренер: <b>${assignedTrainer}</b>${trainingTrainer ? ` <i>(Заміна)</i>` : ''}\n\n`
      : ''

    return (
      `<b>${statusString}</b>\n\n` +
      `${group.groupStyle.emoji ?? '⚪️'} Cтиль: <b>${group.groupStyle.title}</b>\n` +
      `${training.groupSchedule?.groupStyleVariant ? `🎇 Тип: <b>${training.groupSchedule.groupStyleVariant.title}</b>\n` : '\n'}` +
      `${countString}` +
      `${trainerString}` +
      `📅 Дата: <b>${formattedDate}</b> (<i>${formattedDay})</i>\n` +
      `🕓 Час: <b>${formattedTime}</b>\n`
    )
  }

  static makeGroupAgeRestrictionMessage(groupAgeRestriction: GroupAgeRestrictionSelectModel | null, emoji = '👶'): string {
    if (!groupAgeRestriction) {
      return `${emoji} Вікові обмеження відсутні`
    }
    const { minAge, maxAge } = groupAgeRestriction

    if (minAge === null && maxAge === null) {
      return `${emoji} Вікові обмеження відсутні`
    }
    if (minAge === null) {
      return `${emoji} Вікові обмеження: ${TextHelper.bold(`до ${maxAge} років`)}`
    }
    if (maxAge === null) {
      return `${emoji} Вікові обмеження: ${TextHelper.bold(`від ${minAge} років`)}`
    }
    if (minAge === maxAge) {
      return `${emoji} Вікові обмеження: ${TextHelper.bold(`${minAge} років`)}`
    }

    return `${emoji} Вікові обмеження: ${TextHelper.bold(`${minAge}-${maxAge} років`)}`
  }

  static constructSignupListMessage(
    trainingSignup: (TrainingSignupSelectModel & { userProfile: UserProfileSelectModel | null })[],
    status: TrainingSignupStatusEnum.ACTIVE | TrainingSignupStatusEnum.CANCELED,
  ): string {
    const replyMessage =
      status === TrainingSignupStatusEnum.ACTIVE ? '✅ Активні записи на тренування:' : '❌ Скасовані записи на тренування:'

    const noSignupMessage =
      status === TrainingSignupStatusEnum.ACTIVE
        ? '📋 Немає активних записів на тренування'
        : '📋 Немає скасованих записів на тренування'

    if (!trainingSignup.length) {
      return noSignupMessage
    }

    const signups = trainingSignup.map((signup) => {
      const { type } = signup

      let emoji = ``

      switch (type) {
        case TrainingSignupTypeEnum.TRIAL:
          emoji = '🆕'
          break
        case TrainingSignupTypeEnum.RESERVE:
          emoji = '⏳'
          break
        case TrainingSignupTypeEnum.SPECIAL:
          emoji = '⚠️'
          break
        default:
          emoji = '🔘'
      }

      const user = UserHelper.getSignupDisplayName(signup)
      return `${emoji} ${TextHelper.bold(user)}`
    })

    return `${replyMessage}\n\n${signups.join('\n')}`
  }

  static constructTrainingCancelMessage(
    { date, groupName }: { date: string; groupName: string },
    dateTimeProvider: DateTimeProvider,
  ): string {
    const formattedDate = dateTimeProvider.formatDateStringInTz(date, 'dd MMMM')
    return `🚫 Тренування в групі "${groupName}" на ${formattedDate} скасовано.`
  }

  static constructTrainingSignoutByAdminMessage(
    { date, groupName }: { date: string; groupName: string },
    dateTimeProvider: DateTimeProvider,
  ): string {
    const formattedDate = dateTimeProvider.formatDateStringInTz(date, 'dd MMMM')
    return `🚫 Вас було виписано з тренування\n\n📌 Група: ${groupName}\n📅 Дата: ${formattedDate}`
  }

  static constructTrainingSigninByAdminMessage(
    { date, groupName }: { date: string; groupName: string },
    dateTimeProvider: DateTimeProvider,
  ): string {
    const formattedDate = dateTimeProvider.formatDateStringInTz(date, 'dd MMMM')
    return `✅ Вас було записано на тренування\n\n📌 Група: ${groupName}\n📅 Дата: ${formattedDate}`
  }

  static constructTrainingActivateMessage(
    { date, groupName }: { date: string; groupName: string },
    dateTimeProvider: DateTimeProvider,
  ): string {
    const formattedDate = dateTimeProvider.formatDateStringInTz(date, 'dd MMMM')
    return `✅ Тренування в групі "${groupName}" на ${formattedDate} знову активне.`
  }

  static constructAddReviewMessage(name: string) {
    return `Привіт, ${name}! 👋\nМи дуже хочемо почути твою думку — залиш, будь ласка, відгук про тренування або студію загалом.\nТвої слова допомагають нам ставати кращими!\n🙌💖`
  }

  static makeTrainerVerifySuccessMessage(fullName: string): string {
    return `Верифікація пройшла успішно 💫`
  }

  static makeClientGreetingsMessage(firstName: string): string {
    return `Вітаємо в особистому кабінеті ${firstName}❤️`
  }

  static getStaffMemberMessages(role: UserProfileRoleEnum, messageType: 'noOptions' | 'prompt' | 'trainings') {
    const messages: Record<typeof messageType, Record<string, string>> = {
      noOptions: {
        [UserProfileRoleEnum.ADMIN]: '⚠️ Поки що немає активних груп для керування.',
        [UserProfileRoleEnum.MAINTAINER]: '⚠️ Поки що немає активних груп для керування.',
        [UserProfileRoleEnum.TRAINER]: `🤷‍♂️ У вас ще не призначено жодної групи.\n💬 Будь ласка, зверніться до адміністратора.`,
      },
      prompt: {
        [UserProfileRoleEnum.ADMIN]: '📋 Оберіть групу для керування:',
        [UserProfileRoleEnum.MAINTAINER]: '📋 Оберіть групу для керування:',
        [UserProfileRoleEnum.TRAINER]: '📋 Ваші групи:',
      },
      trainings: {
        [UserProfileRoleEnum.ADMIN]: '📝 В цій групі ще немає доступних тренувань.',
        [UserProfileRoleEnum.MAINTAINER]: '📝 В цій групі ще немає доступних тренувань.',
        [UserProfileRoleEnum.TRAINER]: '📝 У вас немає заплановanih тренувань в цій групі.',
      },
    }
    return messages[messageType][role]
  }

  static getStaffPayoutDetailsMessage(result: TSalaryPayoutResult, dateTimeProvider: DateTimeProvider): string {
    const groupMessages = Object.values(result.groups).map((group) => {
      const trainingLines = group.trainings
        .map((training) => {
          const date = dateTimeProvider.formatDateStringInTz(training.date, 'dd MMMM yyyy')
          const confirmed = training.trainingSignups.length
          const payout = PassHelper.toDisplayPrice(training.payout)
          // signupCount is missing in results cached before confirmations existed
          const attendance = confirmed
            ? `✅ ${confirmed} з ${training.signupCount ?? confirmed}`
            : `🔴 0 з ${training.signupCount ?? 0}, не відмічено`
          return `• ${date} | ${attendance} | ${payout}`
        })
        .join('\n')

      return `🔹 <b><i><u>${group.groupName}</u></i></b>
🔸 ${group.trainingCount} ${TextHelper.pluralize(group.trainingCount, ['тренування', 'тренування', 'тренувань'])} • ${PassHelper.toDisplayPrice(group.groupPayout)}
${trainingLines}`
    })

    const bonus = result.statistics.bonus ?? 0
    const bonusBlock = bonus > 0 ? `\n\n🎁 <b>Бонус</b> за середнє ${result.statistics.averageSignups} людей: <b>+${PassHelper.toDisplayPrice(bonus)}</b>` : ''
    return `${groupMessages.join('\n\n')}${bonusBlock}`
  }

  /** Individual sessions breakdown, sent as a separate message after the group details (Telegram 4096-char limit). */
  static getStaffPayoutPersonalDetailsMessage(result: TSalaryPayoutResult, dateTimeProvider: DateTimeProvider): string {
    const { personalTrainings, statistics } = result

    if (!personalTrainings?.length) {
      return ''
    }

    const sessionLines = personalTrainings
      .map((session) => {
        const date = dateTimeProvider.formatDateStringInTz(session.date, 'dd MMMM yyyy, HH:mm')
        const participants = TextHelper.escapeHtml(session.participants)
        const payoutLine = session.isNoShow
          ? `🚫 Неявка — <b>${PassHelper.toDisplayPrice(0)}</b>`
          : session.isUnconfirmed
            ? `⏳ Не підтверджено — <b>${PassHelper.toDisplayPrice(0)}</b>`
            : `${PassHelper.toDisplayPrice(session.price)} × ${statistics.personalPayoutPercentage}% = <b>${PassHelper.toDisplayPrice(session.payout)}</b>`
        // Participants on their own line: a one-off note can be long
        return `• ${date} | ${TextHelper.escapeHtml(session.title)}
    ${session.isNote ? '📝' : '👤'} <i>${participants}</i>
    ${payoutLine}`
      })
      .join('\n')

    const count = statistics.personalTrainingCount
    const noShows = statistics.personalNoShowCount ?? 0
    const noShowNote = noShows ? `, 🚫 ${noShows} ${TextHelper.pluralize(noShows, ['неявка', 'неявки', 'неявок'])}` : ''
    const unconfirmed = statistics.pendingPersonalCount ?? 0
    const unconfirmedNote = unconfirmed ? `, ⏳ ${unconfirmed} без підтвердження` : ''
    return `🤝 <b><i><u>Індивідуальні заняття</u></i></b>
🔸 ${count} ${TextHelper.pluralize(count, ['заняття', 'заняття', 'занять'])}${noShowNote}${unconfirmedNote} • ${PassHelper.toDisplayPrice(statistics.personalPayout)}
${sessionLines}`
  }

  static getStaffPayoutInfoMessage(statistics: TPayoutStatistics) {
    const { averagePayoutPerTraining, totalSignups, totalTrainings, groupPayout, personalTrainingCount, personalPayout, totalPayout } =
      statistics
    const noShows = statistics.personalNoShowCount ?? 0
    const personalInfo =
      personalTrainingCount || noShows
        ? `\n\n🤝 <b>Індивідуальні заняття</b>
- Відбулося: <i>${personalTrainingCount}</i>${noShows ? `\n- Неявки: <i>${noShows}</i> (0 ₴)` : ''}
- Сума: <i>${PassHelper.toDisplayPrice(personalPayout)}</i>`
        : ''

    return `👥 <b>Групові тренування</b>
- Кількість тренувань: <i>${totalTrainings}</i>
- Підтверджено людей: <i>${totalSignups}</i>${this.getAverageSignupsLine(statistics)}
- Середня виплата за тренування: <i>${PassHelper.toDisplayPrice(averagePayoutPerTraining)}</i>
- Сума: <i>${PassHelper.toDisplayPrice(groupPayout)}</i>${this.getBonusLine(statistics)}${personalInfo}

💵 <i>Сума до виплати: <b>${PassHelper.toDisplayPrice(totalPayout)}</b></i>${this.getPayoutPendingWarning(statistics)}`
  }

  /** "- Середня кількість людей: 9.4" (results cached before the bonus existed have no average). */
  private static getAverageSignupsLine(statistics: TPayoutStatistics): string {
    return statistics.averageSignups !== undefined && statistics.totalTrainings
      ? `\n- Середня кількість людей: <i>${statistics.averageSignups}</i>`
      : ''
  }

  /** The group bonus: "+1000 ₴" once the average reaches the rule's threshold, else how far it is. */
  static getBonusLine(statistics: TPayoutStatistics): string {
    const { bonusThreshold, bonus = 0, totalTrainings } = statistics
    if (bonusThreshold === undefined || !totalTrainings) {
      return ''
    }
    return bonus > 0
      ? `\n- 🎁 Бонус за середнє ${bonusThreshold}+: <b>+${PassHelper.toDisplayPrice(bonus)}</b>`
      : `\n- 🎁 Бонус від середнього ${bonusThreshold} людей: <i>не досягнуто</i>`
  }

  /** The trainer's reminder on the last day of the month: individual sessions tomorrow's payout closes with 0 unless confirmed. */
  static getUnconfirmedSessionsReminder(unconfirmedSessions: number): string {
    const sessions = `${unconfirmedSessions} ${TextHelper.pluralize(unconfirmedSessions, ['індивідуальне заняття', 'індивідуальні заняття', 'індивідуальних занять'])}`
    return (
      `⏳ <b>Завтра о 12:00 — виплата за місяць</b>\n\n` +
      `Ще не підтверджено: ${sessions}.\n\n` +
      `Виплата закриє ${unconfirmedSessions === 1 ? 'його' : 'їх'} з 0 ₴. Підтвердити можна в «📅 Розклад студії» → день → заняття.`
    )
  }

  /** The admins' summary on the last day of the month: trainers with individual sessions nobody confirmed yet. */
  static getUnconfirmedSessionsAdminReminder(trainers: { name: string; count: number }[]): string {
    const lines = trainers.map(({ name, count }) => `- ${TextHelper.escapeHtml(name)}: ${count}`).join('\n')
    return (
      `⏳ <b>Завтра о 12:00 — виплати за місяць</b>\n\n` +
      `Непідтверджені індивідуальні заняття:\n${lines}\n\n` +
      `Виплата закриє їх з 0 ₴. Тренерам надіслано нагадування; підтвердити може і адмін: «📅 Розклад студії» → день → заняття.`
    )
  }

  /** Text of the list of payouts the monthly cron prepared (the cron's message to admins, and the list in the bot). */
  static getPendingPayoutsListMessage(): string {
    return (
      `💰 <b>Підготовлені виплати</b>\n\n` +
      `Дані зафіксовані, заняття цих виплат заблоковані. Відкрийте тренера й перевірте: ` +
      `<b>💸 Оплатити</b> або <b>❌ Відмінити</b> (тоді виплату робите вручну).`
    )
  }

  /**
   * What the payout closes with 0 because nobody confirmed it (the whole period is closed): shown before a payout is
   * registered, so the trainer or the admin can still confirm. Empty when everything is confirmed.
   */
  static getPayoutPendingWarning(statistics: TPayoutStatistics): string {
    const pending = statistics.pendingPersonalCount ?? 0
    const unmarked = statistics.unmarkedTrainingCount ?? 0
    const lines = [
      pending
        ? `- ⏳ ${pending} ${TextHelper.pluralize(pending, ['індивідуальне', 'індивідуальні', 'індивідуальних'])} без підтвердження: ${pending === 1 ? 'закриється' : 'закриються'} з 0 ₴`
        : '',
      unmarked
        ? `- 🔴 ${unmarked} ${TextHelper.pluralize(unmarked, ['групове', 'групові', 'групових'])} без жодної відмітки: ${unmarked === 1 ? 'закриється' : 'закриються'} з 0 ₴`
        : '',
    ].filter(Boolean)

    return lines.length ? `\n\n⚠️ <b>Не підтверджено</b>\n${lines.join('\n')}` : ''
  }

  static getStaffPayoutClientInfoMessage(result: TSalaryPayoutResult, dateTimeProvider: DateTimeProvider): string {
    const groupMessages = Object.values(result.groups).map((group) => {
      const trainingLines = group.trainings
        .map((training) => {
          const date = dateTimeProvider.formatDateStringInTz(training.date, 'dd MMMM yyyy')

          const clientList = training.trainingSignups
            .map((signup, index) => {
              const name = UserHelper.getSignupDisplayName(
                signup as TrainingSignupSelectModel & { userProfile: UserProfileSelectModel | null },
              )
              return `    <i>${index + 1}. ${name}</i>`
            })
            .join('\n')

          return `• <b>${date}</b>
${clientList}`
        })
        .join('\n')

      return `🔹 <b><i><u>${group.groupName}</u></i></b>
${trainingLines}`
    })

    return `${groupMessages.join('\n\n')}`
  }

  static constructSubstituteTrainerMessage(
    action: 'assign' | 'deassign',
    group: GetGroupByIdResponse,
    training: GetTrainingByIdResponse,
    dateTimeProvider: DateTimeProvider,
  ): string {
    const formattedDate = dateTimeProvider.formatDateStringInTz(training.date, 'dd MMMM')
    const formattedTime = dateTimeProvider.formatDateStringInTz(training.date, 'HH:mm')
    const formattedDay =
      dateTimeProvider.formatDateStringInTz(training.date, 'EEEE').charAt(0).toUpperCase() +
      dateTimeProvider.formatDateStringInTz(training.date, 'EEEE').slice(1)

    if (action === 'assign') {
      const substituteTrainer = training.trainer?.userProfile ? UserHelper.getDisplayName(training.trainer.userProfile) : null

      return (
        `<b>🔄 Зміна Тренера</b>\n\n` +
        `${group.groupStyle.emoji ?? '⚪️'} <b>${group.groupStyle.title}</b>\n` +
        `📅 ${formattedDate} (${formattedDay})  ${formattedTime}\n\n` +
        `👤 Новий тренер: <b><u>${substituteTrainer}</u></b>`
      )
    } else {
      const regularTrainer = group.trainer?.userProfile ? UserHelper.getDisplayName(group.trainer.userProfile) : null

      return (
        `<b>✅ Скасування Заміни</b>\n\n` +
        `${group.groupStyle.emoji ?? '⚪️'} <b>${group.groupStyle.title}</b>\n` +
        `📅 ${formattedDate} (${formattedDay})  ${formattedTime}\n\n` +
        `👤 Тренер: <b><u>${regularTrainer}</u></b>`
      )
    }
  }

  static getClientManageHeaderMessage(userProfile: UserProfileSelectModel): string {
    const fullName = UserHelper.getDisplayName(userProfile)

    const phone = userProfile.phoneNumber ? `\n\n📞 Телефон: ${TextHelper.telLink(userProfile.phoneNumber, 'bold')}` : ''
    const telegram = userProfile.telegramUsername ? `\n✉️ Telegram: ${TextHelper.bold(`@${userProfile.telegramUsername}`)}` : ''
    const dateOfBirth = userProfile.dateOfBirth ? `\n🎂 Дата народження: ${TextHelper.bold(userProfile.dateOfBirth)}` : ''
    const statusMap: Record<string, string> = {
      [UserProfileStatusEnum.ACTIVE]: '✅ Активний',
      [UserProfileStatusEnum.ARCHIVED]: '📦 В архіві',
    }
    const status = statusMap[userProfile.status] || 'Невідомий статус'

    return `👤 Клієнт: ${TextHelper.bold(fullName)}\n\n` + `${status}` + `${phone}` + `${telegram}` + `${dateOfBirth}`
  }

  static getClientWithoutPassVerifySuccess(firstName: string): string {
    return (
      `🎉 Вітаємо, ${firstName}! 🎉\n` +
      `Твій клієнтський профіль активовано! 💫\n\n` +
      `Щоб розпочати тренування \- придбай абонемент. 💃\n\n` +
      `Тисни ${BUTTON_PATTERNS.CLIENT_PASS_BUY} і вперед створювати свою найкращу версію разом з нами! 🌸`
    )
  }
}
