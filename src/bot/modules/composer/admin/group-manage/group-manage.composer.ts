import { Composer } from 'telegraf'
import { Injectable } from '@nestjs/common'
import { BotContext } from '@app/bot/bot.context'
import { KeyboardHelper, UserHelper } from '@app/bot/helpers'
import { PATTERNS_ADMIN } from '@app/bot/static/patterns'
import { GroupSelectPaginatedMenu } from '@app/bot/modules/inline-menu'
import { CALLBACK_PREFIX } from '@app/bot/libs'

@Injectable()
export class GroupManageComposer {
  private readonly composer: Composer<BotContext>

  constructor(private readonly groupSelectMenu: GroupSelectPaginatedMenu) {
    this.composer = new Composer<BotContext>()

    this.useMenusMiddleware()

    this.initComposerHandlers()
  }

  middleware() {
    return this.composer.middleware()
  }

  private useMenusMiddleware() {
    this.composer.use(
      this.groupSelectMenu.middleware({
        callbackPrefix: CALLBACK_PREFIX.STAFF_GROUP_SELECT,
        promptMessage: 'Виберіть групу:',
        noOptionsMessage: 'На жаль, немає активих груп для управління.',
        onItemSelect: this.handleGroupSelect,
      }),
    )
  }

  initExternalComposers() {
    // This method can be used to initialize any external composers if needed
  }

  initComposerHandlers() {
    this.composer.hears(PATTERNS_ADMIN.GROUPS, this.groupManagehandler)
  }

  private groupManagehandler = async (ctx: BotContext) => {
    await ctx.reply('Вітаю в розділі управління групами!')
    return this.groupSelectMenu.initMenu(ctx)
  }

  private handleGroupSelect = async (ctx: BotContext, groupId: string) => {
    return ctx.reply(`Ви обрали групу з ID: ${groupId}. Тепер ви можете керувати цією групою.`)
  }
}
