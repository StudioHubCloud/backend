import { BusinessService } from 'src/domain/business'
import { Injectable } from '@nestjs/common'
import { Context } from 'grammy'

@Injectable()
export class StartHandler {
  constructor(private readonly businessService: BusinessService) {}

  welcomeHandler = async (ctx: Context) => {
    ctx.reply('Hello')
  }
}
