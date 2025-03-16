import { BusinessService } from '@app/modules/domain/business'
import { Injectable } from '@nestjs/common'
import { Context } from 'grammy'

@Injectable()
export class StartHandler {
  constructor(private readonly businessService: BusinessService) {}

  welcomeHandler = async (ctx: Context) => {
    const businessId = ctx.message?.text?.split(' ')[1]
    if (!businessId) {
      return ctx.reply('Wrong link')
    }

    const business = await this.businessService.getBusinessById(businessId)

    if (!business) {
      return ctx.reply('Business not found')
    }

    ctx.reply(business.displayName)
  }
}
