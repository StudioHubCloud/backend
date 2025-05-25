import { Injectable, Scope } from '@nestjs/common'
import { KeyboardHelper } from '@app/bot/helpers'
import { GroupService } from '@app/domain/group'
import { TNormalizedOption } from '@app/bot/libs'
import { BasePaginatedSelectInlineMenu } from './base.paginated-menu'

@Injectable({scope: Scope.TRANSIENT})
export class GroupSelectPaginatedMenu extends BasePaginatedSelectInlineMenu<{}> {
  constructor(private readonly groupService: GroupService) {
    super()
  }

  protected async loadOptions(): Promise<TNormalizedOption[]> {
    const groups = await this.groupService.getAllActiveGroups()
    return KeyboardHelper.prepareInlineMenuOptions(groups, {
      labelKey: ['name'],
      valueKey: 'id',
      emoji: ['groupStyle', 'emoji'],
    })
  }
}
