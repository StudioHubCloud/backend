import { Injectable, Scope } from '@nestjs/common'
import { KeyboardHelper } from '@app/bot/helpers'
import { TNormalizedOption } from '@app/bot/libs'
import { BasePaginatedSelectInlineMenu } from './base.paginated-menu'
import { UserProfileStatusEnum } from '@app/libs'

export const CLIENT_SIGNIN_MENU = Symbol('client-signin-menu')
export const CLIENT_SIGNOUT_MENU = Symbol('client-signout-menu')

@Injectable({ scope: Scope.TRANSIENT })
export class ClientSelectPaginatedMenu extends BasePaginatedSelectInlineMenu<{
  trainingId?: string
  data?: { name: string; id: string; status?: UserProfileStatusEnum; availableSlots?: number | null; hasActivePass?: boolean }[]
}> {
  constructor() {
    super()
  }

  protected async loadOptions(): Promise<TNormalizedOption[]> {
    const { data = [] } = this.sessionParams

    const getPriority = (item: (typeof data)[0]) => {
      if (item.hasActivePass === false && item.status === UserProfileStatusEnum.ACTIVE) return 1
      if (item.availableSlots === 0 && item.status === UserProfileStatusEnum.ACTIVE) return 2
      if (item.availableSlots === 1 && item.status === UserProfileStatusEnum.ACTIVE) return 3
      if (item.status === UserProfileStatusEnum.BLOCKED) return 6
      if (item.status === UserProfileStatusEnum.ARCHIVED) return 5
      return 4 // rest of active clients
    }

    const dataWithEmoji = data
      .sort((a, b) => getPriority(a) - getPriority(b))
      .map((item) => {
        let emoji = '❔'

        switch (item.status) {
          case UserProfileStatusEnum.ACTIVE:
            emoji = ''
            if (item.hasActivePass === false) {
              emoji = '⌛'
            } else if (item.availableSlots === 1) {
              emoji = '🟡'
            } else if (item.availableSlots === 0) {
              emoji = '🔴'
            }
            break
          case UserProfileStatusEnum.BLOCKED:
            emoji = '⛔'
            break
          case UserProfileStatusEnum.ARCHIVED:
            emoji = '📦'
            break
        }

        return { ...item, emoji }
      })

    return KeyboardHelper.prepareInlineMenuOptions(dataWithEmoji, {
      labelKey: ['name'],
      valueKey: 'id',
      emoji: ['emoji'],
    })
  }
}
