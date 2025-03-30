import { BusinessService } from '@app/domain/business'
import { ClientService } from '@app/domain/client'
import { UserProfileService } from '@app/domain/user-profile'
import { UserProfileRoleEnum, UserProfileStatusEnum } from '@app/libs'
import { Injectable } from '@nestjs/common'
import { validate } from 'uuid'

@Injectable()
export class MiddlewareHelper {
  constructor(
    private readonly businessService: BusinessService,
    private readonly userProfileService: UserProfileService,
    private readonly clientService: ClientService,
  ) {}

  private validateBusiness = async (businessId?: string) => {
    if (!businessId || !validate(businessId)) return null
    return this.businessService.getBusinessById(businessId)
  }

  validateOrCreateUser = async (data: {firstName: string, telegramId: string, lastName?: string}, businessId?: string) => {
    const { firstName, telegramId, lastName } = data
    let existedUser = await this.userProfileService.findUserProfileByCondition({ telegramId })

    if (existedUser) {
      return existedUser
    }

    if (businessId) {
      const business = await this.validateBusiness(businessId)
      if (!business) return 'Invalid or expired link'

      const createdUser = await this.clientService.createNewClient({
        telegramId: telegramId,
        fullName: `${firstName}${lastName ? ` ${lastName}` : ''}`,
        role: UserProfileRoleEnum.GUEST,
        status: UserProfileStatusEnum.NOT_VERIFIED,
        businessId: businessId,
      })
      return createdUser
    }

    return "Invite link is missing"
  }
}
