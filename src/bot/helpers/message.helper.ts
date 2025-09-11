import {
  TPayoutStatistics,
  TrainingSignupStatusEnum,
  TrainingSignupTypeEnum,
  TSalaryPayoutResult,
  UserProfileRoleEnum,
  UserProfileStatusEnum,
} from '@app/libs'
import { TextHelper } from './text.helper'
import { GetGroupByIdResponse, GetTrainingByIdResponse, IRegisterSceneState } from '../libs'
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
    const { firstName, date_of_birth, lastName, phone, telegramUsername } = data
    const modeText = completed
      ? `${role === UserProfileRoleEnum.CLIENT ? 'Клієнт' : 'Тренер'} відправив запит на реєстрацію: ✅\n\n`
      : `🔍 Перевір, чи все вірно:\n\n`

    const mainContent = `👤 Ім'я: ${TextHelper.bold(`${UserHelper.getFullName(firstName!, lastName)}\n`)}${date_of_birth ? `\n➡️ Дата народження: ${TextHelper.bold(date_of_birth)}` : ''}${phone ? `\n➡️ Номер телефону: ${TextHelper.bold(phone)}` : ''}${telegramUsername ? `\n➡️ Telegram: ${TextHelper.bold(`@${telegramUsername}`)}` : ''}`

    return !completed
      ? `${modeText}${mainContent}\n\n👌 Якщо все правильно — тисни “✅ Підтвердити”\n❌ А якщо щось хочеш змінити — просто натисни "⬅️ Назад"`
      : `${modeText}${mainContent}`
  }

  static constructPassSelectMessage(
    data: PassTemplateSelectModel & { passTemplateAgeRestriction: PassTemplateAgeRestrictionSelectModel | null },
  ) {
    const { name, price, length, passTemplateAgeRestriction } = data

    const ageRestrictionInfo = passTemplateAgeRestriction
      ? `👶 Вікові обмеження: ${TextHelper.bold(`${passTemplateAgeRestriction.minAge}-${passTemplateAgeRestriction.maxAge} років`)}`
      : '👶 Вікові обмеження відсутні'

    return (
      `🎫 Інформація про абонемент "${TextHelper.italic(name)}":\n\n` +
      `💰 Ціна: ${TextHelper.bold(PassHelper.toDisplayPrice(price))}\n` +
      `🎫 Кількість: ${TextHelper.bold(`${length} тренувань`)}\n` +
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

      const emoji = type === TrainingSignupTypeEnum.TRIAL ? '🆓' : type === TrainingSignupTypeEnum.RESERVE ? '⏳' : `🔘`
      const user = signup.userProfile ? `${UserHelper.getDisplayName(signup.userProfile)}` : 'Невідомий користувач'
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
          const signups = training.trainingSignups.length
          const payout = PassHelper.toDisplayPrice(training.payout)
          return `• ${date} | ${signups} запис${signups > 1 ? 'ів' : ''} | ${payout}`
        })
        .join('\n')

      return `🔹 <b><i><u>${group.groupName}</u></i></b>
🔸 ${group.trainingCount} тренува${group.trainingCount > 4 ? 'нь' : 'ння'} • ${PassHelper.toDisplayPrice(group.groupPayout)}
${trainingLines}`
    })

    return `${groupMessages.join('\n\n')}`
  }

  static getStaffPayoutInfoMessage({ averagePayoutPerTraining, totalSignups, totalTrainings, totalPayout }: TPayoutStatistics) {
    return `- Загальна кількість тренувань: <i>${totalTrainings}</i>
- Загальна кількість записів: <i>${totalSignups}</i>
- Середня виплата за тренування: <i>${PassHelper.toDisplayPrice(averagePayoutPerTraining)}</i>

💵 <i>Сума до виплати: <b>${PassHelper.toDisplayPrice(totalPayout)}</b></i>`
  }

  static getStaffPayoutClientInfoMessage(result: TSalaryPayoutResult, dateTimeProvider: DateTimeProvider): string {
    const groupMessages = Object.values(result.groups).map((group) => {
      const trainingLines = group.trainings
        .map((training) => {
          const date = dateTimeProvider.formatDateStringInTz(training.date, 'dd MMMM yyyy')

          const clientList = training.trainingSignups
            .map((signup, index) => {
              const name =
                signup.userProfile?.fullName ||
                `${UserHelper.getFullName(signup.userProfile?.firstName!, signup.userProfile?.lastName)}` ||
                'Невідомий клієнт'
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
}
