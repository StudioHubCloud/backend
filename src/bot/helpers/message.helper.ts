import { TrainingSignupStatusEnum, TrainingSignupTypeEnum, UserProfileRoleEnum } from '@app/libs'
import { TextHelper } from './text.helper'
import { GetGroupByIdResponse, GetTrainingByIdResponse, IRegisterSceneState } from '../libs'
import {
  GroupAgeRestrictionSelectModel,
  GroupSelectModel,
  GroupStyleSelectModel,
  PassTemplateAgeRestrictionSelectModel,
  PassTemplateSelectModel,
  TrainingSelectModel,
  TrainingSignupSelectModel,
  UserProfileSelectModel,
} from '@app/infrastructure/database'
import { PassHelper } from './pass.helper'
import { DateTimeProvider } from '@app/infrastructure/providers'

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
      : `Підтверди дані: ✅\n\n`
    return (
      modeText +
      `➡️ Ім'я: ${TextHelper.bold(`${firstName}${lastName ? ` ${lastName}` : ''}`)}${phone ? `\n➡️ Номер телефону: ${TextHelper.bold(phone)}` : ''}${date_of_birth ? `\n➡️ Дата народження: ${TextHelper.bold(date_of_birth)}` : ''}`
    )
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
    const { name, capacity, groupStyle, groupAgeRestrictions } = group

    const ageRestrictionInfo = groupAgeRestrictions ? `\n${this.makeGroupAgeRestrictionMessage(groupAgeRestrictions, '🔹')}` : ''

    return (
      `📌 Обрана група: <b>${name}</b>\n\n` +
      `🔹 Стиль: <b>${groupStyle.title}</b>\n` +
      `🔹 Місць: <b>${capacity}</b>${ageRestrictionInfo}`
    )
  }

  static constructTrainingSelectMessage(
    training: GetTrainingByIdResponse,
    group: GetGroupByIdResponse,
    dateTimeService: DateTimeProvider,
  ): string {
    const formattedDate = dateTimeService.formatDateStringInTz(training.date, 'dd MMMM')
    const formattedTime = dateTimeService.formatDateStringInTz(training.date, 'HH:mm')
    const formattedDay =
      dateTimeService.formatDateStringInTz(training.date, 'EEEE').charAt(0).toUpperCase() +
      dateTimeService.formatDateStringInTz(training.date, 'EEEE').slice(1)

    const statusString = training.isCancelled ? '🚫 Тренування Скасоване' : '✅ Тренування Активне'

    const notReservedSignups = training.trainingSignups.filter(
      (signup) => signup.type !== TrainingSignupTypeEnum.RESERVE && signup.status === TrainingSignupStatusEnum.ACTIVE, //todo potentialy add mor efilters here like status
    )

    return (
      `<b>${statusString}</b>\n\n` +
      `${group.groupStyle.emoji ?? '⚪️'} Cтиль: <b>${group.groupStyle.title}</b>\n` +
      `${training.groupSchedule?.groupStyleVariant ? `🎇 Тип: <b>${training.groupSchedule.groupStyleVariant.title}</b>\n` : '\n'}` +
      `📍 Записів: <b>${notReservedSignups.length}</b>\n\n` +
      `📅 Дата: <b>${formattedDate}</b>\n` +
      `🌝 День: <b>${formattedDay}</b>\n` +
      `🕓 Час: <b>${formattedTime}</b>\n` +
      `🔘 Місць: <b>${group.capacity}</b>`
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

  static constructActiveSignupsMessage(
    trainingSignup: (TrainingSignupSelectModel & { userProfile: UserProfileSelectModel | null })[],
  ): string {
    if (!trainingSignup.length) {
      return 'Немає активних записів на тренування'
    }

    const signups = trainingSignup.map((signup) => {
      const { type } = signup
      const emoji = type === TrainingSignupTypeEnum.TRIAL ? '🆓' : type === TrainingSignupTypeEnum.RESERVE ? '⏳' : '✅'
      const user = signup.userProfile ?`${signup.userProfile.firstName}${signup.userProfile.lastName ? ` ${signup.userProfile.lastName}` : ''}` : 'Невідомий користувач'
      return `${emoji} ${TextHelper.bold(user)}`
    })

    return `Активні записи на тренування:\n\n${signups.join('\n')}`
  }
}
