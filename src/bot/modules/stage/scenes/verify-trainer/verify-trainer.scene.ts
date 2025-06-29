import { Scenes } from 'telegraf'
import { Injectable } from '@nestjs/common'
import { BotContext } from '@app/bot/bot.context'
import { SCENES, TNextFunction } from '@app/bot/libs'
import { SceneHelper, KeyboardHelper } from '@app/bot/helpers'
import { MESSAGES_SCENE } from '@app/bot/static/messages'
import { PATTERNS_COMMON } from '@app/bot/static/patterns'
import { DateTimeProvider, DateTimeProviderInjector } from '@app/infrastructure/providers'
import { AdminKeyboards } from '@app/bot/modules/keyboard/storage'

@Injectable()
export class VerifyTrainerScene extends Scenes.WizardScene<BotContext> {
  private readonly verifyTrainerScene = new SceneHelper<{}>()

  constructor(@DateTimeProviderInjector() private readonly dateTimeProvider: DateTimeProvider) {
    super(
      SCENES.VERIFY_TRAINER,
      (ctx) => this.enterSceneHandler(ctx),
      (ctx) => this.nameHandler(ctx),
      (ctx) => this.phoneHandler(ctx),
      (ctx) => this.dateOfBirthHandler(ctx),
      (ctx) => this.completeHandler(ctx),
    )

    this.enter(async (ctx: BotContext, next: TNextFunction) => {
      ctx.reply('Верифікація тренера')
      return ctx.scene.leave()
      return await next()
    })

    this.hears(PATTERNS_COMMON.EXIT, async (ctx) => {
      await ctx.replyWithHTML(MESSAGES_SCENE.VERIFY_TRAINER.EXIT, AdminKeyboards.mainMenu())
      return ctx.scene.leave()
    })
  }

  private enterSceneHandler = async (ctx: BotContext) => {}

  private nameHandler = async (ctx: BotContext) => {}

  private phoneHandler = async (ctx: BotContext) => {}

  private dateOfBirthHandler = async (ctx: BotContext) => {}

  private completeHandler = async (ctx: BotContext) => {}
}
