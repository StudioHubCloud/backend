import { BotContext } from '@app/bot/bot.context'
import { SceneHelper } from '@app/bot/helpers'
import { Injectable } from '@nestjs/common'
import { Scenes } from 'telegraf'
import { DateTimeProvider, DateTimeProviderInjector } from '@app/infrastructure/providers'
import { UserProfileService } from '@app/domain/user-profile/user-profile.service'
import { TrainingSignupService } from '@app/domain/training-signup'
import { SCENES, TNextFunction } from '@app/bot/libs'
import { PATTERNS_COMMON } from '@app/bot/static/patterns'
import { MESSAGES_SCENE } from '@app/bot/static/messages'
import { AdminKeyboards } from '@app/bot/modules/keyboard/storage'
import { ISignInClientSceneState } from './sign-in-client.scene-helper'

@Injectable()
export class SignInClientScene extends Scenes.WizardScene<BotContext> {
  private readonly signInClientScene = new SceneHelper<ISignInClientSceneState>()

  constructor(
    @DateTimeProviderInjector() private readonly dateTimeProvider: DateTimeProvider,
    private readonly userProfileService: UserProfileService,
    private readonly trainingSignupService: TrainingSignupService,
  ) {
    super(SCENES.SIGN_IN_CLIENT, (ctx) => this.enterSceneHandler(ctx))

    this.enter(async (ctx: BotContext, next: TNextFunction) => {
      this.signInClientScene.setState(ctx, { trainingId: ctx.scene.state['trainingId'] })
      return await next()
    })

    this.hears(PATTERNS_COMMON.EXIT, async (ctx) => {
      await ctx.replyWithHTML(MESSAGES_SCENE.VERIFY_CLIENT.EXIT, AdminKeyboards.mainMenu())
      return ctx.scene.leave()
    })
  }

  private enterSceneHandler = async (ctx: BotContext) => {
    console.log(ctx.scene.state, 'Scene state on enter')
  }
}
