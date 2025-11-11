import { MiddlewareFn } from 'telegraf'
import { BotContext } from '@app/bot/bot.context'
import { Injectable } from '@nestjs/common'
import { GuestRootComposer } from './guest/guest-root.composer'
import { ClientRootComposer } from './client/client-root.composer'
import { AdminRootComposer } from './admin/admin-root.composer'
import { TrainerRootComposer } from './trainer/trainer-root.composer'
import { MaintainerRootComposer } from './maintainer/maintainer-root.composer'
import { UserProfileRoleEnum } from '@app/libs'
import { TNextFunction } from '@app/bot/libs'
import { PinoLogger } from 'nestjs-pino'
import { UserHelper } from '@app/bot/helpers'
import { GuardComposer } from './common/guard.composer'

@Injectable()
export class ComposerService {
  private readonly roleComposerMap: Record<UserProfileRoleEnum, MiddlewareFn<BotContext>>
  private readonly guardComposerMiddleware: MiddlewareFn<BotContext>

  constructor(
    private readonly guestRootComposer: GuestRootComposer,
    private readonly clientRootComposer: ClientRootComposer,
    private readonly adminRootComposer: AdminRootComposer,
    private readonly trainerRootComposer: TrainerRootComposer,
    private readonly maintainerRootComposer: MaintainerRootComposer,
    private readonly guardComposer: GuardComposer,
    private readonly logger: PinoLogger,
  ) {
    this.logger.setContext(ComposerService.name)

    this.guardComposerMiddleware = this.guardComposer.middleware()

    this.roleComposerMap = {
      guest: this.guestRootComposer.middleware(),
      client: this.clientRootComposer.middleware(),
      trainer: this.trainerRootComposer.middleware(),
      admin: this.adminRootComposer.middleware(),
      maintainer: this.maintainerRootComposer.middleware(),
    }
  }

  useRootComposer = async (ctx: BotContext, next: TNextFunction) => {
    if (!UserHelper.getUserUnsafe(ctx)) {
      this.logger.error('User with id %s not found in context store', ctx.from?.id)
      return ctx.reply('Помилка авторизації' + '🚫')
    }

    const role = UserHelper.getUserRole(ctx)
    const rootComposerMiddleware = this.roleComposerMap[role]

    if (rootComposerMiddleware) {
      return rootComposerMiddleware(ctx, next)
    } else {
      this.logger.error('No composer found for role: %s', role)
      return next()
    }
  }

  useGuardComposer = (ctx: BotContext, next: TNextFunction) => {
    return this.guardComposerMiddleware(ctx, next)
  }
}
