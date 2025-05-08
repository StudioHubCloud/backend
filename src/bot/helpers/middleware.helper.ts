import { BusinessService } from '@app/domain/business'
import { UserProfileService } from '@app/domain/user-profile'
import { UserProfileRoleEnum, UserProfileStatusEnum } from '@app/libs'
import { Injectable } from '@nestjs/common'
import { validate } from 'uuid'

@Injectable()
export class MiddlewareHelper {
  constructor(
    private readonly businessService: BusinessService,
    private readonly userProfileService: UserProfileService,
  ) {}

  private validateStudio = async (studioId?: string) => {
    if (!studioId || !validate(studioId)) return null
    return this.businessService.getBusinessById(studioId)
  }

  validateOrCreateUser = async (data: {firstName: string, telegramId: string, lastName?: string}, studioId?: string) => {
    const { firstName, telegramId, lastName } = data
    let existedUser = await this.userProfileService.findUserProfileByCondition({ telegramId })

    if (existedUser) {
      return existedUser
    }

    if (studioId) {
      const business = await this.validateStudio(studioId)
      if (!business) return 'Invalid or expired link'

      const [createdUser] = await this.userProfileService.createUserProfile({
        telegramId: telegramId,
        firstName: firstName,
        lastName: lastName,
        fullName: `${firstName}${lastName ? ` ${lastName}` : ''}`,
        role: UserProfileRoleEnum.GUEST,
        status: UserProfileStatusEnum.UNVERIVIED,
        studioId,
      })
      return createdUser
    }

    return "Invite link is missing"
  }
}
