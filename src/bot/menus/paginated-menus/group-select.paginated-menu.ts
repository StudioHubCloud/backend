import { Injectable, Scope } from '@nestjs/common'
import { KeyboardHelper } from '@app/bot/helpers'
import { GroupService } from '@app/domain/group'
import { TNormalizedOption } from '@app/bot/libs'
import { BasePaginatedSelectInlineMenu } from './base.paginated-menu'
import { UserProfileRoleEnum } from '@app/libs'

@Injectable({ scope: Scope.TRANSIENT })
export class GroupSelectPaginatedMenu extends BasePaginatedSelectInlineMenu<{
  userId: string
  role: UserProfileRoleEnum
  staffUserId?: string
}> {
  constructor(private readonly groupService: GroupService) {
    super()
  }

  protected async loadOptions(): Promise<TNormalizedOption[]> {
    const { userId, role, staffUserId } = this.sessionParams
    
    let groups

    if (staffUserId) {
      groups = await this.groupService.getAllActiveTrainerGroups(staffUserId)
    } else {
      switch (role) {
        case UserProfileRoleEnum.ADMIN:
          groups = await this.groupService.getAllActiveGroups()
          break
        case UserProfileRoleEnum.TRAINER:
          groups = await this.groupService.getAllActiveTrainerGroups(userId)
          break
        default:
          groups = await this.groupService.getAllUserAgeResctictedActiveGroups({ userId })
          break
      }
    }

    return KeyboardHelper.prepareInlineMenuOptions(groups, {
      labelKey: ['name'],
      valueKey: 'id',
      emoji: ['groupStyle', 'emoji'],
    })
  }
}
