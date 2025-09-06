import { Injectable, Scope } from '@nestjs/common'
import { KeyboardHelper } from '@app/bot/helpers'
import { TNormalizedOption } from '@app/bot/libs'
import { BasePaginatedSelectInlineMenu } from './base.paginated-menu'

import { UserProfileService } from '@app/domain/user-profile'

@Injectable({ scope: Scope.TRANSIENT })
export class StaffSelectPaginatedMenu extends BasePaginatedSelectInlineMenu<{}> {
  constructor(private readonly userProfileService: UserProfileService) {
    super()
  }

  protected async loadOptions(): Promise<TNormalizedOption[]> {
    const staffMembersUserProfiles = await this.userProfileService.getAllActiveStaffMembersUserProfiles()

    return KeyboardHelper.prepareInlineMenuOptions(staffMembersUserProfiles, {
      labelKey: ['firstName', 'lastName'],
      valueKey: 'id',
      emoji: '▫️',
    })
  }
}
