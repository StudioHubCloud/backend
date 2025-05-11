import { BotContext } from '@app/bot/bot.context'
import { UnverifiedGuard } from '@app/bot/guards'
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

    this.initComposersPublicListeners()

    this.composer.use(UnverifiedGuard)
  }

  private initComposersPublicListeners() {
    this.composer.hears([PATTERNS_COMMON.REGISTER_AS_CLIENT, PATTERNS_COMMON.REGISTER_AS_GUEST], async (ctx: BotContext, next: TNextFunction) => {
      const isUnverified = UserHelper.isUnverifiedStatus(ctx)
      if(!isUnverified) {
        return await next()
      }
      const role = UserHelper.getUserRole(ctx)
      return ctx.scene.enter(SCENES.VERIFICATION_REQUEST, { role })
    })
  }

  getComposer() {
    return this.composer
  }
}
