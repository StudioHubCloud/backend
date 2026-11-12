import { PassSelectModel, PassTemplateSelectModel } from '@app/infrastructure/database'
import { DATE_FORMAT, PassGroupModeEnum, PassStatusEnum, PassTemplateTypeEnum } from '@app/libs'
import { addDays } from 'date-fns'
import { GetTrainingSignupsByPassIdResponse, PASS_CONFIG } from '../libs'
import { DateTimeProvider } from '@app/infrastructure/providers'
import { TextHelper } from './text.helper'
import { BotContext } from '../bot.context'
import { AdminKeyboards } from '../keyboard/storage'
import { RULES, RULES_CONSENT_HEADER } from '../static/messages'
import { PassSelectionHelper, TLabelPass } from '@app/domain/pass'

type TRulesPassTemplate =
  | (Pick<PassTemplateSelectModel, 'type' | 'durationDays'> & { passTemplateFreezeRule?: { maxDays: number } | null })
  | null
  | undefined
/** `childAge`: a parent acting for a child ("Мої діти"); null / undefined = the person's own rules */
type TRulesOptions = { childAge?: number | null }

export class PassHelper {
  /**
   * The template's age limits ("3–5 років", "від 16 років") when `age` is outside them, null when it fits, the template
   * has no limits or the age is unknown (no date of birth: not restricted, as before).
   */
  static getTemplateAgeMismatch(
    restriction: { minAge: number | null; maxAge: number | null } | null | undefined,
    age: number | null,
  ): string | null {
    if (!restriction || age === null) {
      return null
    }
    const { minAge, maxAge } = restriction
    if ((minAge === null || age >= minAge) && (maxAge === null || age <= maxAge)) {
      return null
    }
    return minAge !== null && maxAge !== null
      ? `${minAge}–${maxAge} ${this.years(maxAge)}`
      : minAge !== null
        ? `від ${minAge} ${this.yearsGenitive(minAge)}`
        : `до ${maxAge} ${this.yearsGenitive(maxAge!)}`
  }

  /** "23 роки", "5 років". */
  static formatAge(age: number): string {
    return `${age} ${this.years(age)}`
  }

  private static years(count: number): string {
    return TextHelper.pluralize(count, ['рік', 'роки', 'років'])
  }

  /** After "від" / "до": "від 21 року", "від 16 років". */
  private static yearsGenitive(count: number): string {
    return count % 10 === 1 && count % 100 !== 11 ? 'року' : 'років'
  }

  /**
   * Rules for the pass the person works with ("📜 Правила", "📋 Пам'ятка"): individual (on «ви», as a memo), parents of a
   * child, otherwise group; the freeze line follows the template's freeze rule; default duration when there is no pass yet.
   */
  static getRulesMessage(passTemplate?: TRulesPassTemplate, options: TRulesOptions = {}): string {
    const { body, kind } = this.getRules(passTemplate, options)
    return kind === 'INDIVIDUAL' ? `📋 ${TextHelper.bold('Пам’ятка: індивідуальний абонемент')}\n\n${body}` : body
  }

  /** The rules consent: the owner's header for that kind of rules + the rules. */
  static getRulesConsentMessage(passTemplate?: TRulesPassTemplate, options: TRulesOptions = {}): string {
    const { body, kind } = this.getRules(passTemplate, options)
    return `${RULES_CONSENT_HEADER[kind]}\n\n${body}`
  }

  private static getRules(passTemplate: TRulesPassTemplate, { childAge }: TRulesOptions) {
    if (passTemplate?.type === PassTemplateTypeEnum.INDIVIDUAL) {
      return { kind: 'INDIVIDUAL' as const, body: RULES.INDIVIDUAL(passTemplate.durationDays) }
    }
    const maxFreezeDays = passTemplate?.passTemplateFreezeRule?.maxDays
    if (childAge !== null && childAge !== undefined) {
      return { kind: 'PARENT' as const, body: RULES.PARENT({ durationDays: passTemplate?.durationDays, maxFreezeDays }) }
    }
    return { kind: 'GROUP' as const, body: RULES.GROUP(passTemplate?.durationDays, maxFreezeDays) }
  }

  /** How and when a not-yet-started pass activates, for client notifications. */
  static getActivationInfo(passTemplate: Pick<PassTemplateSelectModel, 'type' | 'durationDays'>): string {
    const duration = `📆 Після активації діятиме ${TextHelper.bold(`${passTemplate.durationDays} днів`)}`

    if (passTemplate.type === PassTemplateTypeEnum.INDIVIDUAL) {
      return `✨ Абонемент активується з першого індивідуального тренування
${duration}
🤝 Дату й час тренування узгодь зі своїм тренером`
    }

    return `✨ Абонемент активується з першого тренування або автоматично через ${PASS_CONFIG.ACTIVATION_GRACE_PERIOD} днів після оплати
${duration}`
  }

  /**
   * "👯‍♀️ Група: …" for a group pass: the bound group, or any group for a FLEX one; '' for an individual pass.
   * Clients don't see the staff term "FLEX".
   */
  static getGroupLine(
    passTemplate: Pick<PassTemplateSelectModel, 'type' | 'groupMode'>,
    groupName?: string | null,
    { forClient = false } = {},
  ): string {
    if (passTemplate.type !== PassTemplateTypeEnum.GROUP) {
      return ''
    }
    return passTemplate.groupMode === PassGroupModeEnum.FLEX
      ? `👯‍♀️ Група: ${TextHelper.bold(forClient ? 'будь-яка ✨' : 'будь-яка (FLEX)')}\n`
      : `👯‍♀️ Група: ${TextHelper.bold(TextHelper.escapeHtml(groupName ?? ''))}\n`
  }

  static toDisplayPrice(price: number): string {
    return price ? `${price} ₴` : '0 ₴'
  }

  static isPassActivated(pass: PassSelectModel & { passTemplate: PassTemplateSelectModel }): boolean {
    return pass.endDate !== null && pass.startDate !== null
  }

  static getPassDisplayStatus(status: PassStatusEnum, isInactive: boolean): { label: string; icon: string } {
    if (status === PassStatusEnum.EXPIRED) {
      return { icon: '❌', label: 'Недійсний' }
    }

    if (isInactive) {
      return { icon: '⚪️', label: 'Потребує активації' }
    }

    const STATUS_MAP: Record<PassStatusEnum, { label: string; icon: string }> = {
      [PassStatusEnum.ACTIVE]: { icon: '✅', label: 'Активний' },
      [PassStatusEnum.EXPIRED]: { icon: '❌', label: 'Недійсний' },
      [PassStatusEnum.REQUESTED]: { icon: '🟡', label: 'Очікує підтвердження' },
    }
    return STATUS_MAP[status] || { icon: '❓', label: 'Невідомий статус' }
  }

  static getPassTemplateTypeLabel(type: PassTemplateTypeEnum): string {
    const TYPE_MAP: Record<PassTemplateTypeEnum, string> = {
      [PassTemplateTypeEnum.GROUP]: 'Груповий абонемент',
      [PassTemplateTypeEnum.INDIVIDUAL]: 'Індивідуальний абонемент',
    }
    return TYPE_MAP[type] || ''
  }

  /** «12 листопада – 16 листопада», one date for a one-day freeze. */
  static getFreezeRangeLabel(frozenFrom: string, frozenDays: number, dateTimeProvider: DateTimeProvider): string {
    const first = dateTimeProvider.formatDateStringInTz(frozenFrom, 'd MMMM')
    const lastDay = PassSelectionHelper.getLastFrozenDay({ frozenFrom, frozenDays })!
    return frozenDays > 1 ? `${first} – ${dateTimeProvider.formatDateStringInTz(lastDay, 'd MMMM')}` : first
  }

  /** «• 13 листопада, 18:00 — K-Pop», one line per signup a freeze cancels. */
  static getFreezeSignupLines(
    signups: { training: { date: string }; group: { name: string } | null }[],
    dateTimeProvider: DateTimeProvider,
  ): string {
    return signups
      .map(({ training, group }) => {
        const when = dateTimeProvider.formatDateStringInTz(training.date, 'd MMMM, HH:mm')
        return `• ${when} — ${TextHelper.escapeHtml(group?.name ?? 'Невідома група')}`
      })
      .join('\n')
  }

  static getPassInfoMessage(
    pass: PassSelectModel & { passTemplate: PassTemplateSelectModel; group?: { name: string } | null },
    dateTimeProvider: DateTimeProvider,
    fullName: string = '',
  ): string {
    // The pass's own scope (a snapshot), not the template's: passes sold before 2026-10-05 are FLEX
    const groupLine = this.getGroupLine({ type: pass.passTemplate.type, groupMode: pass.groupMode }, pass.group?.name, {
      forClient: !fullName,
    })
    const isPassInactive = pass.status !== PassStatusEnum.REQUESTED && !pass.endDate
    const activationDate = addDays(pass.saleDate, PASS_CONFIG.ACTIVATION_GRACE_PERIOD).toISOString()
    const checkDateString =
      pass.passTemplate.type === PassTemplateTypeEnum.INDIVIDUAL
        ? 'з першого індивідуального тренування'
        : dateTimeProvider.formatDateStringInTz(activationDate, 'd MMMM')
    const headerText = fullName ? `🎫 Абонемент клієнта ${TextHelper.bold(fullName)}:` : '🎫 Деталі абонементу:'
    const { icon, label } = PassHelper.getPassDisplayStatus(pass.status, isPassInactive)

    const text = `${headerText}\n
🏷️ ${TextHelper.bold('Тип:')} ${PassHelper.getPassTemplateTypeLabel(pass.passTemplate.type)} «${pass.passTemplate.name}»
${groupLine}${icon} ${TextHelper.bold('Статус:')} ${label}
📌 ${TextHelper.bold('Доступно тренувань:')} ${pass.availableSlots}/${pass.lengthOverride ?? pass.passTemplate.length}\n
${!isPassInactive ? `📅 ${TextHelper.bold('Активований:')} ${dateTimeProvider.formatDateStringInTz(pass.startDate!, 'd MMMM')}` : ''}
${TextHelper.bold(isPassInactive ? '📅 Автоматично активується:' : pass.endDate ? '📅 Дійсний до:' : '')} ${isPassInactive ? checkDateString : (dateTimeProvider.formatDateStringInTz(pass.endDate!, 'd MMMM') ?? '')}${
      pass.frozenFrom
        ? `\n🧊 ${TextHelper.bold('Заморозка:')} ${this.getFreezeRangeLabel(pass.frozenFrom, pass.frozenDays, dateTimeProvider)}`
        : ''
    }`

    return text
  }

  static getPassWithSignupsInfoMessage(
    pass: PassSelectModel & { passTemplate: PassTemplateSelectModel },
    dateTimeProvider: DateTimeProvider,
    fullName: string = '',
    trainingSignups: GetTrainingSignupsByPassIdResponse[] = [],
  ) {
    let baseMessage = this.getPassInfoMessage(pass, dateTimeProvider, fullName)

    const groupedSignups = Object.groupBy(trainingSignups, ({ group }) => `${group?.name ?? 'Невідома група'}`)

    if (trainingSignups.length) {
      const signupsInfo = Object.entries(groupedSignups)
        .map(([groupName, signups = []]) => {
          const dates = signups
            .map((signup) => {
              if (signup.training === null) {
                return `• <i>Видалене тренування</i>`
              }
              const formattedDate = dateTimeProvider.formatDateStringInTz(signup.training.date, 'dd MMMM')
              const formattedTime = dateTimeProvider.formatDateStringInTz(signup.training.date, 'HH:mm')
              return `• <i>${formattedDate} ${formattedTime}</i>`
            })
            .join('\n')

          return `<b>${groupName}</b>\n${dates}`
        })
        .join('\n')

      baseMessage += `\n\n${signupsInfo}`
    }

    return baseMessage
  }

  static async renderPassManageMenu(
    ctx: BotContext,
    dateTimeProvider: DateTimeProvider,
    data: {
      pass: PassSelectModel & { passTemplate: PassTemplateSelectModel & { passTemplateFreezeRule?: { maxDays: number } | null } }
      fullName: string
      clientUserId: string
      shouldEdit?: boolean
      editMessageId?: number
      trainingSignups?: GetTrainingSignupsByPassIdResponse[]
      /** Pre-rendered individual-training history; supplied instead of trainingSignups for individual passes. */
      personalTrainingsBlock?: string
      /** The client's active passes: with 2+ the card gets a row per pass to switch the shown one */
      activePasses?: TLabelPass[]
    },
  ) {
    const { pass, fullName, clientUserId, shouldEdit = true, trainingSignups = [], personalTrainingsBlock } = data
    try {
      const isIndividualPass = pass.passTemplate.type === PassTemplateTypeEnum.INDIVIDUAL

      const message = isIndividualPass
        ? `${PassHelper.getPassInfoMessage(pass, dateTimeProvider, fullName)}${personalTrainingsBlock ? `\n\n${personalTrainingsBlock}` : ''}`
        : PassHelper.getPassWithSignupsInfoMessage(pass, dateTimeProvider, fullName, trainingSignups)

      const isPassActivated = PassHelper.isPassActivated(pass)
      const passChoices = (data.activePasses ?? []).map((p) => ({ id: p.id, label: PassSelectionHelper.getLabel(p) }))
      const today = dateTimeProvider.getTodayDateStringInTz(DATE_FORMAT.DATE_MAIN)
      const canFreeze = PassSelectionHelper.getFreezeRefusal(pass, today) === null
      const keyboard = AdminKeyboards.passManageMenu(clientUserId, pass.id, isPassActivated, isIndividualPass, passChoices, canFreeze)

      if (!shouldEdit) {
        if (data.editMessageId) {
          return await ctx.telegram.editMessageText(ctx.chat!.id, data.editMessageId, undefined, message, {
            parse_mode: 'HTML',
            ...keyboard,
          })
        }

        return await ctx.replyWithHTML(message, keyboard)
      }

      return await ctx.editMessageText(message, {
        ...keyboard,
        parse_mode: 'HTML',
      })
    } catch (error) {
      console.error('Error in renderPassManageMenu:', error)
      return
    }
  }
}
