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

    const dataWithEmoji = data
      .sort(
        (a, b) => (a?.status === UserProfileStatusEnum.ARCHIVED ? 1 : 0) - (b?.status === UserProfileStatusEnum.ARCHIVED ? 1 : 0),
      )
      .map((item) => {
        let emoji = '⚠️'

        switch (item.status) {
          case UserProfileStatusEnum.ACTIVE:
            emoji = '🧚'
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
