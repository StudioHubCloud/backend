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
  data?: { name: string; id: string; status?: UserProfileStatusEnum }[]
}> {
  constructor() {
    super()
  }

  protected async loadOptions(): Promise<TNormalizedOption[]> {
    const { data = [] } = this.sessionParams

    const dataWithEmoji = data.map((item) => {
      let emoji = '⚠️'

      if (item.status === UserProfileStatusEnum.ACTIVE) {
        emoji = '🧚'
      } else if (item.status === UserProfileStatusEnum.ARCHIVED) {
        emoji = '📦'
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
