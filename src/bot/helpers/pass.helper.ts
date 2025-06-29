import { PassSelectModel } from '@app/infrastructure/database';
import { PassStatusEnum, PassTemplateTypeEnum,  } from '@app/libs'

export class PassHelper {
  static toDisplayPrice(price: number): string {
    return price ? `${price} ₴` : '0 ₴'
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
}