import { Composer } from 'telegraf'
import { Injectable } from '@nestjs/common'
import { BotContext } from '@app/bot/bot.context'
import { MESSAGES_STAFF } from '@app/bot/static/messages'
import { MaintainerKeyboards } from '@app/bot/keyboard/storage'
import { AdminRootComposer } from '../admin/admin-root.composer'
import { BUTTON_PATTERNS } from '@app/bot/static/button-patterns'
import { RedisCacheService } from '@app/infrastructure/redis'

@Injectable()
export class MaintainerRootComposer {
  private readonly composer: Composer<BotContext>

  constructor(
    private readonly adminRootComposer: AdminRootComposer,
    private readonly redisCacheService: RedisCacheService,
  ) {
    this.composer = new Composer<BotContext>()

    this.composer.start(async (ctx) => {
      return ctx.reply(MESSAGES_STAFF.GREETINGS_MAINTAINER, MaintainerKeyboards.mainMenu())
    })

    this.initComposerHandlers()

    this.initExternalComposers()
  }

  middleware() {
    return this.composer.middleware()
  }

  initComposerHandlers() {
    this.composer.hears(BUTTON_PATTERNS.CONFIGURE_BOT, async (ctx) => {
      return ctx.reply(`⚙️ Керування ботом`, MaintainerKeyboards.configureBotMenu())
    })
    this.composer.hears(BUTTON_PATTERNS.BACK_TO_MAIN_MENU, async (ctx) => {
      return ctx.reply(MESSAGES_STAFF.GREETINGS_MAINTAINER, MaintainerKeyboards.mainMenu())
    })
    this.composer.hears(BUTTON_PATTERNS.CLEAR_CACHE, async (ctx) => {
      await this.redisCacheService.reset()
      await ctx.reply('Кеш очищено ✅')
    })
  }

  initExternalComposers() {
    //maintainer only

    //admin staff
    this.composer.use(this.adminRootComposer.middleware())
  }
}
