import { Composer } from 'telegraf'
import { BotContext } from '@app/bot/bot.context'
import { Injectable } from '@nestjs/common'
import { GuestRootComposer } from './guest/guest-root.composer'
import { StaffRootComposer } from './staff/staff-root.composer'
import { ClientRootComposer } from './client/client-root.composer'
import { TNextFunction, UserProfileRoleEnum } from '@app/libs'
import { PinoLogger } from 'nestjs-pino'
import { UserHelper } from '@app/bot/helpers'

@Injectable()
export class ComposerService {
  private readonly roleComposerMap: Record<UserProfileRoleEnum, Composer<BotContext>>

  constructor(
    private readonly guestRootComposer: GuestRootComposer,
    private readonly clientRootComposer: ClientRootComposer,
    private readonly staffRootComposer: StaffRootComposer,
    private readonly logger: PinoLogger,
  ) {
    this.roleComposerMap = {
      guest: this.guestRootComposer.getComposer(),
      client: this.clientRootComposer.getComposer(),
      trainer: this.staffRootComposer.getComposer(),
      admin: this.staffRootComposer.getComposer(),
    }
  }

  initRootComposer = async (ctx: BotContext, next: TNextFunction) => {
    if (!ctx.store.user) {
      this.logger.error('User with id %s not found in context store', ctx.from?.id)
      return ctx.reply('Помилка авторизації')
    }

    const role = UserHelper.getUserRole(ctx)

    const RootComposer = this.roleComposerMap[role]

    if (RootComposer) {
      return RootComposer.middleware()(ctx, next)
    } else {
      this.logger.error('No composer found for role: %s', role)
      return next()
    }
  }
}
