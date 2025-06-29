import { Injectable, Scope } from '@nestjs/common'
import { KeyboardHelper } from '@app/bot/helpers'
import { GroupService } from '@app/domain/group'
import { TNormalizedOption } from '@app/bot/libs'
import { BasePaginatedSelectInlineMenu } from './base.paginated-menu'

@Injectable({scope: Scope.TRANSIENT})
export class GroupSelectPaginatedMenu extends BasePaginatedSelectInlineMenu<{userId: string, isAdmin?: boolean}> {
  constructor(private readonly groupService: GroupService) {
    super()
  }

  protected async loadOptions(): Promise<TNormalizedOption[]> {
    const { userId, isAdmin } = this.sessionParams

    let groups
    if (isAdmin) {
      groups = await this.groupService.getAllActiveGroupsGroups()
    } else {
      groups = await this.groupService.getAllActiveGroupsWithAgeRestrictions({userId})
    }

    return KeyboardHelper.prepareInlineMenuOptions(groups, {
      labelKey: ['name'],
      valueKey: 'id',
      emoji: ['groupStyle', 'emoji'],
    })
  }
}
