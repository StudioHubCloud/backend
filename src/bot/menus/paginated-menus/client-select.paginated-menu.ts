import { Injectable, Scope } from '@nestjs/common'
import { KeyboardHelper } from '@app/bot/helpers'
import { GroupService } from '@app/domain/group'
import { TNormalizedOption } from '@app/bot/libs'
import { BasePaginatedSelectInlineMenu } from './base.paginated-menu'

export const CLIENT_SIGNOUT_MENU = Symbol('client-signout-menu')

@Injectable({scope: Scope.TRANSIENT})
export class ClientSelectPaginatedMenu extends BasePaginatedSelectInlineMenu<{trainingId?: string, data? : Record<string, any>[]}> {
  constructor(private readonly groupService: GroupService) {
    super()
  }

  protected async loadOptions(): Promise<TNormalizedOption[]> {
    const { data = [] } = this.sessionParams

    return KeyboardHelper.prepareInlineMenuOptions(data, {
      labelKey: ['name'],
      valueKey: 'id',
      emoji: '🧚',
    })
  }
}
