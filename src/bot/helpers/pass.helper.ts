import { PassSelectModel, PassTemplateSelectModel } from '@app/infrastructure/database'
import { PassGroupModeEnum, PassStatusEnum, PassTemplateTypeEnum } from '@app/libs'
import { addDays } from 'date-fns'
import { GetTrainingSignupsByPassIdResponse, PASS_CONFIG } from '../libs'
import { DateTimeProvider } from '@app/infrastructure/providers'
import { TextHelper } from './text.helper'
import { BotContext } from '../bot.context'
import { AdminKeyboards } from '../keyboard/storage'
import { RULES } from '../static/messages'
import { PassSelectionHelper, TLabelPass } from '@app/domain/pass'

export class PassHelper {
  /** Rules for the client's pass type and duration; group rules with the default duration when there is no pass yet. */
  static getRulesMessage(passTemplate?: Pick<PassTemplateSelectModel, 'type' | 'durationDays'> | null): string {
    if (passTemplate?.type === PassTemplateTypeEnum.INDIVIDUAL) {
      return RULES.INDIVIDUAL(passTemplate.durationDays)
    }

    return RULES.GROUP(passTemplate?.durationDays)
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
${TextHelper.bold(isPassInactive ? '📅 Автоматично активується:' : pass.endDate ? '📅 Дійсний до:' : '')} ${isPassInactive ? checkDateString : (dateTimeProvider.formatDateStringInTz(pass.endDate!, 'd MMMM') ?? '')}`

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
      pass: PassSelectModel & { passTemplate: PassTemplateSelectModel }
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
      const keyboard = AdminKeyboards.passManageMenu(clientUserId, pass.id, isPassActivated, isIndividualPass, passChoices)

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
