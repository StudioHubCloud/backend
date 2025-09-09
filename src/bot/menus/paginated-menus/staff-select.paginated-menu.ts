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
    const { excludeStaffMemberId } = this.renderOptions.context || {}
    const staffMembersUserProfiles = await this.userProfileService.getAllActiveStaffMembersUserProfiles()

    const filteredStaff = excludeStaffMemberId
      ? staffMembersUserProfiles.filter((profile) => profile.staffMember?.id !== excludeStaffMemberId)
      : staffMembersUserProfiles

    return KeyboardHelper.prepareInlineMenuOptions(filteredStaff, {
      labelKey: ['firstName', 'lastName'],
      valueKey: 'id',
      emoji: '▫️',
    })
  }
}
