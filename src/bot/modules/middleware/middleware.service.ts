import { Injectable } from '@nestjs/common'
import { deunionize } from 'telegraf'
import { PinoLogger } from 'nestjs-pino'

import { MiddlewareHelper } from '@app/bot/helpers'
import { ComposerService } from '@app/bot/modules/composer'
import { BotContext } from '@app/bot/bot.context'
import { User } from 'telegraf/typings/core/types/typegram'

@Injectable()
export class MiddlewareService {
  constructor(
    private readonly logger: PinoLogger,
    private readonly composerService: ComposerService,
    private readonly middlewareHelper: MiddlewareHelper,
  ) {
    this.logger.setContext(MiddlewareService.name)
  }

  loggingMiddleware = async (ctx: BotContext, next: () => Promise<void>) => {
    const user = ctx.from ? `${ctx.from.id} (${ctx.from.username || ctx.from.first_name})` : 'Unknown User'
    this.logger.debug('Incoming update from %s', user)
    await next()
  }

  timerMiddleware = async (ctx: BotContext, next: () => Promise<void>) => {
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

  authMiddleware = async (ctx: BotContext, next: () => Promise<void>) => {
    const update = deunionize(ctx.update)
    let from: User

    if (update.callback_query) {
      from = update.callback_query.from
    } else if (update.message) {
      from = update.message.from
    } else {
      this.logger.error('No message or callback_query found in context')
      return
    }

    if (from.is_bot) return

    const { first_name, last_name, id } = from

    const studioId = deunionize(ctx.message)?.text?.split(' ')[1]

    const response = await this.middlewareHelper.validateOrCreateUser(
      { firstName: first_name, telegramId: id.toString(), lastName: last_name },
      studioId,
    )

    if (typeof response === 'string') { //error message
      this.logger.error('Error during user validation: %s', response)
      return ctx.reply(response)
    }

    ctx.store.user = response
    await next()
  }

  roleBasedAccessMiddleware = async (ctx: BotContext, next: () => Promise<void>) => {
    if (!ctx.store.user) {
      this.logger.error('User with id %s not found in context store', ctx.from?.id)
      return ctx.reply('Помилка авторизації')
    }

    const role = ctx.store.user.role

    const rbaComposer = this.composerService.getComposer(role)

    if (rbaComposer) {
      return rbaComposer.middleware()(ctx, next)
    } else {
      this.logger.error('No composer found for role: %s', role)
      return next()
    }
  }
}
