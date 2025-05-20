import { Injectable } from '@nestjs/common'
import { KeyboardHelper } from '@app/bot/helpers'
import { GroupService } from '@app/domain/group'
import { TNormalizedOption } from '@app/libs'
import { BaseSelectInlineMenu } from './base.paginated-menu'

@Injectable()
export class GroupSelectInlineMenu extends BaseSelectInlineMenu<{}> {
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
