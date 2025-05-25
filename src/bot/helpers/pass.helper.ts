import { PassStatusEnum, PassTemplateTypeEnum, type UserProfileStatusEnum } from '@app/libs'
import { TextHelper } from './text.helper'

export class PassHelper {
  static toDisplayPrice(price: number): string {
    return price ? `${price} ₴` : '0 ₴'
  }

  static getPassDisplayStatus(status: PassStatusEnum): { label: string; icon: string } {
    const STATUS_MAP: Record<PassStatusEnum, { label: string; icon: string }> = {
      [PassStatusEnum.ACTIVE]: { icon: '✅', label: 'Активний' },
      [PassStatusEnum.PAUSED]: { icon: '⏸️', label: 'Призупинений' },
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
}