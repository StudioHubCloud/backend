import { BusinessService } from 'src/domain/business'
import { Injectable } from '@nestjs/common'
import { NextFunction } from 'grammy'
import { validate } from 'uuid'
import { BotContext } from '../bot.context'

export const MIDDLEWARE_SERVICE_PROVIDER = Symbol('MIDDLEWARE_SERVICE_PROVIDER')

@Injectable()
export class MiddlewareService {
  constructor(
    private readonly businessService: BusinessService,
    // private readonly userProfileService: UserProfileService,
  ) {}

  validateBusiness = async (ctx: BotContext, next: NextFunction) => {
    const businessId = ctx.message?.text?.split(' ')[1]
    if (businessId && validate(businessId)) {
      const business = await this.businessService.getBusinessById(businessId)
      ctx.state.business = business
    }
    await next()
  }

  validateUser = async (ctx: BotContext, next: NextFunction) => {
    console.log(ctx)
    const userId = ctx.message?.from?.id
    if (!userId) {
      ctx.reply('User not found')
      return
    }

    await ctx.reply(`User ${userId} found`)

    await next()
  }
}
