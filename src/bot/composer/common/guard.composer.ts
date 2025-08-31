import { Injectable } from '@nestjs/common'
import { Composer } from 'telegraf'
import { BotContext } from '@app/bot/bot.context'
import { IsBlockedGuard, UnverifiedGuard } from '@app/bot/guards'
import { UserHelper } from '@app/bot/helpers'
import { SCENES, TNextFunction } from '@app/bot/libs'
import { BUTTON_PATTERNS } from '@app/bot/static/button-patterns'
import { UserProfileRoleEnum } from '@app/libs'

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
    this.composer.hears(BUTTON_PATTERNS.REGISTER_AS_CLIENT, async (ctx: BotContext, next: TNextFunction) => {
      return this.enterRegisterScene(ctx, next, UserProfileRoleEnum.CLIENT)
    })
    this.composer.hears(BUTTON_PATTERNS.REGISTER_AS_GUEST, async (ctx: BotContext, next: TNextFunction) => {
      return this.enterRegisterScene(ctx, next, UserProfileRoleEnum.GUEST)
    })
    this.composer.hears(BUTTON_PATTERNS.REGISTER_AS_TRAINER, async (ctx: BotContext, next: TNextFunction) => {
      return this.enterRegisterScene(ctx, next, UserProfileRoleEnum.TRAINER)
    })
  }

  middleware() {
    return this.composer.middleware()
  }

  private enterRegisterScene = async (ctx: BotContext, next: TNextFunction, role: UserProfileRoleEnum) => {
    const isUnverified = UserHelper.isUnverifiedStatus(ctx)
    if (!isUnverified) {
      return await next()
    }
    return ctx.scene.enter(SCENES.REGISTER, { role })
  }
}
