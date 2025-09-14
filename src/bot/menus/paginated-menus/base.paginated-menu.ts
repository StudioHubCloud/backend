import { Composer } from 'telegraf'
import { BotContext } from '@app/bot/bot.context'
import { BotHelper, KeyboardHelper, RegexHelper } from '@app/bot/helpers'
import { CALLBACK_DATA, ISelectInlineMenuConfig, TNormalizedOption, TPaginatedMenuRenderOptions } from '@app/bot/libs'
import { BUTTON_PATTERNS } from '@app/bot/static/button-patterns'
import { InlineKeyboardMarkup } from 'telegraf/typings/core/types/typegram'
import { COMMON_BUTTONS } from '@app/bot/keyboard/storage/common-keyboards'

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

    const { isCallbackQueryUpdate } = BotHelper.getUpdatePayload(ctx)

    const response = await this.loadOptions()
    if (typeof response === 'object' && 'message' in response) {
      return await BotHelper.safeAnswerCbQuery(ctx, response.message, { show_alert: true })
    } else {
      this.options = response
    }

    const menu = KeyboardHelper.createPaginatedMenu(this.options, {
      prefix: this.config.callbackPrefix,
    })

    this.appendBackButton(menu)
    this.appendExitButton(menu)

    if (!this.options.length) {
      if (isCallbackQueryUpdate) {
        await BotHelper.safeAnswerCbQuery(ctx, this.getMessageText(ctx, this.config.noOptionsMessage || 'Нічого не знайдено'))
      } else {
        await ctx.reply(this.getMessageText(ctx, this.config.noOptionsMessage || 'Нічого не знайдено'), { parse_mode: 'HTML' })
      }
      return
    }

    if (isCallbackQueryUpdate) {
      BotHelper.safeAnswerCbQuery(ctx)
    }

    const promptMessage = this.getMessageText(ctx, this.config.promptMessage || 'Виберіть елемент зі списку')

    if (this.renderOptions.shouldEdit) {
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
      BotHelper.safeAnswerCbQuery(ctx)
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
      this.appendExitButton(menu)

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
      menu.inline_keyboard.push([
        {
          text: BUTTON_PATTERNS.BACK,
          callback_data: this.renderOptions.backButtonCallbackData,
        },
      ])
    }
  }

  private appendExitButton(menu: InlineKeyboardMarkup) {
    if (this.renderOptions.withExitButton) {
      menu.inline_keyboard.push([COMMON_BUTTONS.CLOSE])
    }
  }

  protected abstract loadOptions(): Promise<TNormalizedOption[] | { message: string }>
}
