import { Composer } from 'telegraf'
import { BotContext } from '@app/bot/bot.context'
import { KeyboardHelper, RegexHelper } from '@app/bot/helpers'
import { ISelectInlineMenuConfig, TNormalizedOption, TPaginatedMenuRenderOptions } from '@app/bot/libs'
import { BUTTON_PATTERNS } from '@app/bot/static/button-patterns'
import { InlineKeyboardMarkup } from 'telegraf/typings/core/types/typegram'

export abstract class BasePaginatedSelectInlineMenu<T extends Record<string, any>> {
  protected readonly composer = new Composer<BotContext>()

  protected config: ISelectInlineMenuConfig<BotContext>
  protected options: TNormalizedOption[] = []
  protected paginationRegex: RegExp
  protected selectItemRegex: RegExp
  protected sessionParams: T
  protected renderOptions: TPaginatedMenuRenderOptions

  middleware(config: ISelectInlineMenuConfig<BotContext>) {
    this.configure(config)
    return this.composer.middleware()
  }

  async initMenu(ctx: BotContext, sessionParams: T = {} as T, renderOptions: TPaginatedMenuRenderOptions = {}) {
    this.sessionParams = sessionParams
    this.renderOptions = renderOptions

    const response = await this.loadOptions()
    if (typeof response === 'object' && 'message' in response) {
      return ctx.reply(response.message, { parse_mode: 'HTML' })
    } else {
      this.options = response
    }

    const menu = KeyboardHelper.createPaginatedMenu(this.options, {
      prefix: this.config.callbackPrefix,
    })

    this.appendBackButton(menu)

    if (!this.options.length) {
      return ctx.reply(this.getMessageText(ctx, this.config.noOptionsMessage || 'Нічого не знайдено'), { parse_mode: 'HTML' })
    }

    const promptMessage = this.getMessageText(ctx, this.config.promptMessage || 'Виберіть елемент зі списку')

    if (this.renderOptions.shouldEdit && ctx.updateType === 'callback_query') {
      return ctx.editMessageText(promptMessage, { reply_markup: menu, parse_mode: 'HTML' })
    }
    return ctx.reply(promptMessage, { reply_markup: menu, parse_mode: 'HTML' })
  }

  private configure(config: ISelectInlineMenuConfig<BotContext>) {
    this.config = config

    this.paginationRegex = RegexHelper.createMenuPaginationActionRegex(config.callbackPrefix)
    this.selectItemRegex = RegexHelper.createMenuSelectItemRegex(config.callbackPrefix)

    this.initComposerHandlers()
  }

  private initComposerHandlers() {
    this.composer.action(this.selectItemRegex, async (ctx) => {
      const itemId = ctx.match[1]
      return this.config.onItemSelect(ctx, itemId, this.renderOptions?.context || {})
    })

    this.composer.action(this.paginationRegex, async (ctx) => {
      ctx.answerCbQuery()
      const page = parseInt(ctx.match[1])

      if (!this.options.length) {
        const response = await this.loadOptions()
        if (typeof response === 'object' && 'message' in response) {
          return ctx.reply(response.message, { parse_mode: 'HTML' })
        } else {
          this.options = response
        }
      }

      const menu = KeyboardHelper.createPaginatedMenu(this.options, {
        prefix: this.config.callbackPrefix,
        page,
      })

      this.appendBackButton(menu)

      return ctx.editMessageText(this.getMessageText(ctx, this.config.promptMessage || 'Виберіть елемент зі списку'), {
        reply_markup: menu,
        parse_mode: 'HTML',
      })
    })
  }

  private getMessageText(ctx: BotContext, message?: string | Function) {
    if (!message) {
      return null
    }

    if (typeof message === 'function') {
      return message(ctx)
    } else {
      return message
    }
  }

  private appendBackButton(menu: InlineKeyboardMarkup) {
    if (this.renderOptions.backButtonCallbackData) {
      menu.inline_keyboard.push([{
        text: BUTTON_PATTERNS.BACK,
        callback_data: this.renderOptions.backButtonCallbackData,
      }])
    }

  }

  protected abstract loadOptions(): Promise<TNormalizedOption[] | { message: string }>
}
