import { PassSelectModel, PassTemplateSelectModel } from '@app/infrastructure/database'
import { PassStatusEnum, PassTemplateTypeEnum } from '@app/libs'
import { addDays } from 'date-fns'
import { PASS_CONFIG } from '../libs'
import { DateTimeProvider } from '@app/infrastructure/providers'
import { TextHelper } from './text.helper'
import { BotContext } from '../bot.context'
import { AdminKeyboards } from '../keyboard/storage'

export class PassHelper {
  static toDisplayPrice(price: number): string {
    return price ? `${price} ₴` : '0 ₴'
  }

  static isPassActivated(pass: PassSelectModel & { passTemplate: PassTemplateSelectModel }): boolean {
    return pass.endDate !== null && pass.startDate !== null
  }

  static getPassDisplayStatus(status: PassStatusEnum, isInactive: boolean): { label: string; icon: string } {
    if (isInactive) {
      return { icon: '⚪️', label: 'Потребує активації' }
    }

    const STATUS_MAP: Record<PassStatusEnum, { label: string; icon: string }> = {
      [PassStatusEnum.ACTIVE]: { icon: '✅', label: 'Активний' },
      [PassStatusEnum.EXPIRED]: { icon: '❌', label: 'Недійсний' },
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
    pass: PassSelectModel & { passTemplate: PassTemplateSelectModel },
    dateTimeProvider: DateTimeProvider,
    fullName: string = '',
  ): string {
    const isPassInactive = !pass.endDate
    const activationDate = addDays(pass.saleDate, PASS_CONFIG.ACTIVATION_GRACE_PERIOD).toISOString()
    const checkDateString = dateTimeProvider.formatDateStringInTz(activationDate, 'd MMMM')
    const headerText = fullName ? `🎫 Абонемент клієнта ${TextHelper.bold(fullName)}:` : '🎫 Деталі абонементу:'
    const { icon, label } = PassHelper.getPassDisplayStatus(pass.status, isPassInactive)

    const text = `${headerText}\n
${icon} ${TextHelper.bold('Статус:')} ${label}
📌 ${TextHelper.bold('Доступно тренувань:')} ${pass.availableSlots}/${pass.lengthOverride ?? pass.passTemplate.length}
📅 ${TextHelper.bold(isPassInactive ? 'Автоматично активується:' : 'Дійсний до:')} ${isPassInactive ? checkDateString : pass.endDate}`

    return text
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
    },
  ) {
    const { pass, fullName, clientUserId, shouldEdit = true } = data
    
    const message = PassHelper.getPassInfoMessage(pass, dateTimeProvider, fullName)
    const isPassActive = PassHelper.isPassActivated(pass)
    if (!shouldEdit) {
      if (data.editMessageId) {
        return await ctx.telegram.editMessageText(ctx.chat!.id, data.editMessageId, undefined, message, {
          parse_mode: 'HTML',
          ...AdminKeyboards.passManageMenu(clientUserId, isPassActive),
        })
      }

      return await ctx.replyWithHTML(message, AdminKeyboards.passManageMenu(clientUserId, isPassActive))
    }

    return await ctx.editMessageText(message, { ...AdminKeyboards.passManageMenu(clientUserId, isPassActive), parse_mode: 'HTML' })
  }
}
