import { Injectable, Scope } from '@nestjs/common'
import { KeyboardHelper } from '@app/bot/helpers'
import { GroupService } from '@app/domain/group'
import { TNormalizedOption } from '@app/bot/libs'
import { BasePaginatedSelectInlineMenu } from './base.paginated-menu'
import { UserProfileRoleEnum } from '@app/libs'

export const ASSIGN_GROUP_TO_STAFF_MENU = Symbol('assign-group-to-staff-menu')
export const REMOVE_GROUP_FROM_STAFF_MENU = Symbol('remove-group-from-staff-menu')

type TGroupSelectMenuParams = {
  userId: string
  role: UserProfileRoleEnum
  staffUserId?: string
  data?: any[]
  /** Client's own groups (FIXED passes, the current one first): listed first and green */
  highlightGroupIds?: number[]
}

@Injectable({ scope: Scope.TRANSIENT })
export class GroupSelectPaginatedMenu extends BasePaginatedSelectInlineMenu<TGroupSelectMenuParams> {
  constructor(private readonly groupService: GroupService) {
    super()
  }

  protected async loadOptions(params: TGroupSelectMenuParams): Promise<TNormalizedOption[]> {
    const { userId, role, staffUserId, data, highlightGroupIds = [] } = params

    let groups

    if (staffUserId && !data) {
      groups = await this.groupService.getAllActiveTrainerGroups(staffUserId)
    } else if (!data) {
      switch (role) {
        case UserProfileRoleEnum.ADMIN:
        case UserProfileRoleEnum.MAINTAINER:
          groups = await this.groupService.getAllActiveGroups()
          break
        case UserProfileRoleEnum.TRAINER:
          groups = await this.groupService.getAllActiveTrainerGroups(userId)
          break
        default:
          groups = await this.groupService.getAllUserAgeResctictedActiveGroups({ userId })
          break
      }
    } else {
      groups = data
    }

    const options = KeyboardHelper.prepareInlineMenuOptions(groups, {
      labelKey: ['name'],
      valueKey: 'id',
      emoji: ['groupStyle', 'emoji'],
    })

    if (!highlightGroupIds.length) {
      return options
    }

    const rank = (value: string | number) => {
      const index = highlightGroupIds.indexOf(Number(value))
      return index === -1 ? highlightGroupIds.length : index
    }
    return options
      .map((option, index) => ({ option, index }))
      .sort((a, b) => rank(a.option.value) - rank(b.option.value) || a.index - b.index)
      .map(({ option }) => (rank(option.value) < highlightGroupIds.length ? { ...option, style: 'success' as const } : option))
  }
}
