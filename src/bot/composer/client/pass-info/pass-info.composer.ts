import { BotContext } from '@app/bot/bot.context'
import { PassHelper, UserHelper } from '@app/bot/helpers'
import { BUTTON_PATTERNS } from '@app/bot/static/button-patterns'
import { PassService } from '@app/domain/pass'
import { DateTimeProvider, DateTimeProviderInjector } from '@app/infrastructure/providers'
import { Injectable } from '@nestjs/common'
import { Composer } from 'telegraf'

@Injectable()
export class PassInfoComposer {
  private readonly composer: Composer<BotContext>
  constructor(
    @DateTimeProviderInjector() private readonly dateTimeProvider: DateTimeProvider,
    private readonly passService: PassService,
  ) {
    this.composer = new Composer<BotContext>()
    this.initComposerHandlers()
  }

  middleware() {
    return this.composer.middleware()
  }

  initComposerHandlers() {
    this.composer.hears(BUTTON_PATTERNS.PASS_INFO, this.passInfoHandler)
  }

  private passInfoHandler = async (ctx: BotContext) => {
    const { client } = UserHelper.getUser(ctx)
    const pass = await this.passService.findActivePassByClientId(client?.id, { withExpired: true, withRequested: true })

    if (!pass) {
      return ctx.reply('📋 В тебе немає жодного абонементу')
    }

    const message = PassHelper.getPassInfoMessage(pass, this.dateTimeProvider)
    return ctx.replyWithHTML(message)
  }
}
