import { BusinessService } from '@app/domain/business'
import { Injectable } from '@nestjs/common'
import { NextFunction } from 'grammy'
import { validate } from 'uuid'
import { BotContext } from '../bot.context'
import { UserProfileService } from '@app/domain/user-profile'
import { UserProfileRoleEnum, UserProfileStatusEnum } from '@app/libs'
import { ClientService } from '@app/domain/client'

export const MIDDLEWARE_SERVICE_PROVIDER = Symbol('MIDDLEWARE_SERVICE_PROVIDER')

@Injectable()
export class MiddlewareService {
  constructor(
    private readonly businessService: BusinessService,
    private readonly userProfileService: UserProfileService,
    private readonly clientService: ClientService,
  ) {}

  validateUser = async (ctx: BotContext, next: NextFunction) => {
    if (!ctx.message) return

    const { first_name, last_name, id, is_bot } = ctx.message.from

    if (is_bot) return

    let existedUser = await this.userProfileService.findUserProfileByCondition({ telegramId: id.toString() })

    if (!existedUser) {
      const businessId = ctx.message?.text?.split(' ')[1]
      const business = await this.validateBusiness(businessId)

      if (!business) {
        return ctx.reply('Invalid or expired link')
      }

      const createdUser = await this.clientService.createNewClient({
        telegramId: id.toString(),
        fullName: `${first_name}${last_name ? ` ${last_name}` : ''}`,
        role: UserProfileRoleEnum.GUEST,
        status: UserProfileStatusEnum.NOT_VERIFIED,
        businessId: business.id,
      })
      ctx.state.user = createdUser
    } else {
      ctx.state.user = existedUser
    }

    await next()
  }

  private validateBusiness = async (businessId?: string) => {
    if (!businessId || !validate(businessId)) return null
    return this.businessService.getBusinessById(businessId)
  }
}
