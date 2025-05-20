import { BotContext } from '@app/bot/bot.context'
import { IsBlockedGuard, UnverifiedGuard } from '@app/bot/guards'
import { UserHelper } from '@app/bot/helpers'
import { PATTERNS_COMMON } from '@app/bot/static/patterns'
import { SCENES, TNextFunction } from '@app/libs'
import { Injectable } from '@nestjs/common'
import { Composer } from 'telegraf'

@Injectable()
export class GuardComposer {
  private readonly composer: Composer<BotContext>
  constructor() {
    this.composer = new Composer<BotContext>()

    this.composer.use(IsBlockedGuard)

    this.initUnverifiedListeners()

    this.composer.use(UnverifiedGuard)
  }

  private initUnverifiedListeners() {

    this.composer.hears([PATTERNS_COMMON.REGISTER_AS_CLIENT, PATTERNS_COMMON.REGISTER_AS_GUEST, PATTERNS_COMMON.REGISTER_AS_TRAINER], async (ctx: BotContext, next: TNextFunction) => {
      const isUnverified = UserHelper.isUnverifiedStatus(ctx)
      if (!isUnverified) {
        return await next()
      }
      return ctx.scene.enter(SCENES.REGISTER)
    })
  }

  middleware() {
    return this.composer.middleware()
  }
}
