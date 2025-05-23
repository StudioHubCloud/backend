import { Composer } from 'telegraf'
import { BotContext } from '@app/bot/bot.context'
import { KeyboardHelper, RegexHelper } from '@app/bot/helpers'
import { ISelectInlineMenuConfig, TNormalizedOption } from '@app/bot/libs'

export abstract class BaseSelectInlineMenu<T extends Record<string, any>> {
  protected readonly composer = new Composer<BotContext>()

  protected config: ISelectInlineMenuConfig<BotContext>
  protected options: TNormalizedOption[] = []
  protected paginationRegex: RegExp
  protected selectItemRegex: RegExp
  protected sessionParams: T;

  middleware() {
    return this.composer.middleware()
  }

  configure(config: ISelectInlineMenuConfig<BotContext>) {
    this.config = config

    this.paginationRegex = RegexHelper.createMenuPaginationActionRegex(config.callbackPrefix)
    this.selectItemRegex = RegexHelper.createMenuSelectItemRegex(config.callbackPrefix)

    this.initComposerHandlers()
  }

  async initMenu(ctx: BotContext, sessionParams: T = {} as T) {
    this.sessionParams = sessionParams
    this.options = await this.loadOptions()

    const menu = KeyboardHelper.createPaginatedMenu(this.options, {
      prefix: this.config.callbackPrefix,
    })

    if (!this.options.length) {
      return ctx.reply(this.config.noOptionsMessage || 'No options available')
    }

    return ctx.reply(this.config.promptMessage || 'Choose an item:', { reply_markup: menu })
  }

  private initComposerHandlers() {
    this.composer.action(this.selectItemRegex, async (ctx) => {
      const itemId = ctx.match[1]
      return this.config.onItemSelect(ctx, itemId)
    })

    this.composer.action(this.paginationRegex, async (ctx) => {
      ctx.answerCbQuery()
      const page = parseInt(ctx.match[1])

      if (!this.options.length) {
        this.options = await this.loadOptions()
      }

      const menu = KeyboardHelper.createPaginatedMenu(this.options, {
        prefix: this.config.callbackPrefix,
        page,
      })

      return ctx.editMessageText(this.config.promptMessage || 'Виберіть елемент зі списку', { reply_markup: menu })
    })
  }

  protected abstract loadOptions(): Promise<TNormalizedOption[]>
}
