import { Injectable } from '@nestjs/common'
import { PinoLogger } from 'nestjs-pino'

import { UserHelper } from '@app/bot/helpers'
import { BotContext } from '@app/bot/bot.context'
import { StudioService } from '@app/domain/studio'
import { UserProfileService } from '@app/domain/user-profile'
import { UserProfileRoleEnum, UserProfileStatusEnum } from '@app/libs'
import { type TNextFunction } from '@app/bot/libs'
import { BotHelper } from '@app/bot/helpers/bot.helper'
import { TypedConfigService } from '@app/infrastructure/config'

@Injectable()
export class MiddlewareService {
  constructor(
    private readonly logger: PinoLogger,
    private readonly studioService: StudioService,
    private readonly configService: TypedConfigService,
    private readonly userProfileService: UserProfileService,
  ) {
    this.logger.setContext(MiddlewareService.name)
  }

  loggingMiddleware = async (ctx: BotContext, next: TNextFunction) => {
    const user = ctx.from ? `${ctx.from.id} (${ctx.from.username || ctx.from.first_name})` : 'Unknown User'
    this.logger.debug('Incoming update from %s', user)
    await next()
  }

  timerMiddleware = async (ctx: BotContext, next: TNextFunction) => {
    const start = Date.now()
    await next()
    const duration = Date.now() - start

    switch (true) {
      case duration > 1000 && duration <= 5000:
        this.logger.warn('Processing time exceeded 1 second: %dms', duration)
        break
      case duration > 5000 && duration <= 10000:
        this.logger.error('Processing time exceeded 5 seconds: %dms', duration)
        break
      case duration > 10000:
        this.logger.fatal('Processing time exceeded 10 seconds: %dms', duration)
        break
      default:
        this.logger.debug('Processing time: %dms', duration)
        break
    }
  }

  authMiddleware = async (ctx: BotContext, next: TNextFunction) => {
    const from = BotHelper.getFrom(ctx)

    if (!from || from.is_bot) {
      this.logger.error('Unsupported update type or bot detected')
      return ctx.reply('Unsupported update type')
    }

    const user = await this.userProfileService.findTelegramAuthenticatedUser(from.id.toString())

    UserHelper.setUser(ctx, user)

    if (user) {
      return await next()
    }

    const { first_name, last_name, id } = from

    const studioId = this.configService.get('STUDIO_ID')

    const studio = await this.studioService.getStudioById(studioId)

    if (!studio) {
      this.logger.error('Studio with id %s not found', studioId)
      return ctx.reply('Invalid invite link')
    }

    const createdUser = await this.userProfileService.createUserProfile({
      telegramId: id.toString(),
      firstName: first_name,
      lastName: last_name,
      fullName: `${first_name}${last_name ? ` ${last_name}` : ''}`,
      role: UserProfileRoleEnum.GUEST,
      status: UserProfileStatusEnum.UNVERIVIED,
      studioId,
    })

    if (!createdUser) {
      this.logger.error('Failed to create user profile')
      return ctx.reply('Failed to create user profile')
    }
    UserHelper.setUser(ctx, { ...createdUser, client: null })
    return await next()
  }
}
