import { Composer } from 'telegraf'
import { Injectable } from '@nestjs/common'
import { BotContext } from '@app/bot/bot.context'
import { KeyboardHelper, UserHelper } from '@app/bot/helpers'
import { BUTTON_PATTERNS } from '@app/bot/static/button-patterns'
import { UserProfileService } from '@app/domain/user-profile'

@Injectable()
export class ClientManageComposer {
  private readonly composer: Composer<BotContext>

  constructor(private readonly userProfileService: UserProfileService) {
    this.composer = new Composer<BotContext>()

    this.initComposerHandlers()
  }

  middleware() {
    return this.composer.middleware()
  }

  initComposerHandlers() {
    // this.composer.on('text', async (ctx) => {
    //   const result = await this.userProfileService.findWildcardClients(ctx.message.text)

    //   console.log(ctx.message.text)
    //   console.log(result, 'result')

    //   ctx.reply(result.map((u) => u.fullName).join('\n') || 'No clients found')
    // })
  }
}
