import { BotContext } from '@app/bot/bot.context'
import { BotHelper, SceneHelper, UserHelper } from '@app/bot/helpers'
import { ClientKeyboards } from '@app/bot/keyboard/storage'
import { AuthUserProfile, SCENES } from '@app/bot/libs'
import { BUTTON_PATTERNS } from '@app/bot/static/button-patterns'
import { MESSAGES_SCENE } from '@app/bot/static/messages'
import { TypedConfigService } from '@app/infrastructure/config'
import { DateTimeProvider, DateTimeProviderInjector } from '@app/infrastructure/providers'
import { DATE_FORMAT } from '@app/libs'
import { Injectable } from '@nestjs/common'
import { Scenes } from 'telegraf'

interface IPassRenewSceneState {
  userProfile: AuthUserProfile
}

@Injectable()
export class PassRenewScene extends Scenes.WizardScene<BotContext> {
  private readonly passRenewScene = new SceneHelper<IPassRenewSceneState>()

  constructor(
    @DateTimeProviderInjector() private readonly dateTimeProvider: DateTimeProvider,
    private readonly configService: TypedConfigService,
  ) {
    super(
      SCENES.PASS_RENEW,
      (ctx) => this.enterSceneHandler(ctx),
      (ctx) => this.payoutDateHandler(ctx),
      (ctx) => this.confirmPayoutHandler(ctx),
    )

    this.hears(BUTTON_PATTERNS.EXIT, async (ctx) => {
      await ctx.replyWithHTML(MESSAGES_SCENE.PAYMENT.PASS_RENEW_EXIT, ClientKeyboards.mainMenu())
      return ctx.scene.leave()
    })
  }

  private enterSceneHandler = async (ctx: BotContext) => {
    const todayDateString = this.getTodayDateString()

    return ctx.wizard.next()
  }

  private payoutDateHandler = async (ctx: BotContext) => {
    try {
      const { textPayload } = BotHelper.getUpdatePayload(ctx)

      return ctx.wizard.next()
    } catch (error) {
      await this.handleError(ctx, error)
    }
  }

  private confirmPayoutHandler = async (ctx: BotContext) => {
    try {
    } catch (error) {
      await this.handleError(ctx, error)
    }
  }

  private async handleError(ctx: BotContext, error: any) {
    await ctx.telegram.sendMessage(
      this.configService.get('MAINTAINER_CHAT_ID'),
      `Error: ${error?.message}\n\nUpdate: ${JSON.stringify(ctx.update)}`,
    )
    await ctx.replyWithHTML(
      `❌ Виникла помилка: ${error?.message}. Спробуйте ще раз або зверніться до адміністратора.`,
      ClientKeyboards.mainMenu(),
    )
    return ctx.scene.leave()
  }

  private getTodayDateString() {
    return this.dateTimeProvider.formatDateStringInTz(new Date().toISOString(), DATE_FORMAT.DATE_INPUT)
  }
}
