import { Composer } from 'telegraf'
import { BotContext } from '@app/bot/bot.context'
import { BotHelper, KeyboardHelper, RegexHelper } from '@app/bot/helpers'
import { ISelectInlineMenuConfig, TNormalizedOption, TPaginatedMenuRenderOptions, TPaginatedMenuState } from '@app/bot/libs'
import { BUTTON_PATTERNS } from '@app/bot/static/button-patterns'
import { MESSAGES_COMMON } from '@app/bot/static/messages'
import { InlineKeyboardMarkup } from '@telegraf/types'
import { COMMON_BUTTONS } from '@app/bot/keyboard/storage/common-keyboards'

/**
 * Menu instances are Scope.TRANSIENT: one per injection site, shared by every user of that menu.
 * They hold configuration only; state (params, render options) lives in ctx.session per rendered
 * message (`${callbackPrefix}:${messageId}`), so neither concurrent users nor older menu messages
 * of the same user act on someone else's / a newer menu's data.
 */
export abstract class BasePaginatedSelectInlineMenu<T extends Record<string, any>> {
  // Upper bound of stored menu states per user; least recently used are dropped first
  private static readonly MAX_STORED_MENUS = 20

  protected readonly composer = new Composer<BotContext>()

  protected config: ISelectInlineMenuConfig<BotContext>
  protected paginationRegex: RegExp
  protected selectItemRegex: RegExp

  middleware(config: ISelectInlineMenuConfig<BotContext>) {
    this.configure(config)
    return this.composer.middleware()
  }

  async initMenu(ctx: BotContext, params: T = {} as T, renderOptions: TPaginatedMenuRenderOptions = {}) {
    const { isCallbackQueryUpdate } = BotHelper.getUpdatePayload(ctx)

    const response = await this.loadOptions(params, renderOptions)
    if (!Array.isArray(response)) {
      return await BotHelper.safeAnswerCbQuery(ctx, response.message, { show_alert: true })
    }

    const menu = this.buildMenu(response, renderOptions)

    if (!response.length) {
      const noOptionsMessage = this.getMessageText(
        ctx,
        this.getNoOptionsMessage(params) || this.config.noOptionsMessage || 'Нічого не знайдено',
      )
      if (isCallbackQueryUpdate) {
        await BotHelper.safeAnswerCbQuery(ctx, noOptionsMessage)
      } else {
        await ctx.reply(noOptionsMessage, { parse_mode: 'HTML' })
      }
      return
    }

    if (isCallbackQueryUpdate) {
      BotHelper.safeAnswerCbQuery(ctx)
    }

    const promptMessage = this.getPromptText(ctx, params)

    if (renderOptions.shouldEdit) {
      this.setState(ctx, ctx.callbackQuery?.message?.message_id, { params, renderOptions })
      return BotHelper.safeEditMessageText(ctx, promptMessage, { reply_markup: menu })
    }

    const sentMessage = await ctx.reply(promptMessage, { reply_markup: menu, parse_mode: 'HTML' })
    this.setState(ctx, sentMessage.message_id, { params, renderOptions })
    return sentMessage
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
      // Missing state (e.g. session lost on restart) yields an empty context; handlers guard required keys.
      return this.config.onItemSelect(ctx, itemId, this.getState(ctx)?.renderOptions.context || {})
    })

    this.composer.action(this.paginationRegex, async (ctx) => {
      const state = this.getState(ctx)

      if (!state) {
        return BotHelper.safeAnswerCbQuery(ctx, MESSAGES_COMMON.MENU_EXPIRED, { show_alert: true })
      }

      BotHelper.safeAnswerCbQuery(ctx)
      const page = parseInt(ctx.match[1])
      const params = state.params as T
      this.setState(ctx, ctx.callbackQuery.message?.message_id, state) // mark as recently used

      // Reloaded per request: options are never cached on the shared instance.
      const response = await this.loadOptions(params, state.renderOptions)
      if (!Array.isArray(response)) {
        return ctx.reply(response.message, { parse_mode: 'HTML' })
      }

      const menu = this.buildMenu(response, state.renderOptions, page)

      return BotHelper.safeEditMessageText(ctx, this.getPromptText(ctx, params), { reply_markup: menu })
    })
  }

  private getStateKey(messageId: number) {
    return `${this.config.callbackPrefix}:${messageId}`
  }

  private getState(ctx: BotContext): TPaginatedMenuState | undefined {
    const messageId = ctx.callbackQuery?.message?.message_id
    return messageId ? ctx.session?.menus?.[this.getStateKey(messageId)] : undefined
  }

  private setState(ctx: BotContext, messageId: number | undefined, state: Omit<TPaginatedMenuState, 'updatedAt'>) {
    if (!messageId) {
      return
    }
    // telegraf's session() starts with an undefined session until it is first assigned
    ctx.session ??= {}

    const menus = { ...ctx.session.menus, [this.getStateKey(messageId)]: { ...state, updatedAt: Date.now() } }
    const recent = Object.entries(menus)
      .sort(([, a], [, b]) => b.updatedAt - a.updatedAt)
      .slice(0, BasePaginatedSelectInlineMenu.MAX_STORED_MENUS)

    ctx.session.menus = Object.fromEntries(recent)
  }

  private buildMenu(options: TNormalizedOption[], renderOptions: TPaginatedMenuRenderOptions, page?: number) {
    const menu = KeyboardHelper.createPaginatedMenu(options, {
      prefix: this.config.callbackPrefix,
      page,
    })

    if (renderOptions.topButtons?.length) {
      menu.inline_keyboard.unshift(...renderOptions.topButtons)
    }
    this.appendBackButton(menu, renderOptions)
    this.appendExitButton(menu, renderOptions)

    return menu
  }

  private getPromptText(ctx: BotContext, params: T) {
    return this.getMessageText(ctx, this.getPromptMessage(params) || this.config.promptMessage || 'Виберіть елемент зі списку')
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

  private appendBackButton(menu: InlineKeyboardMarkup, renderOptions: TPaginatedMenuRenderOptions) {
    if (renderOptions.backButtonCallbackData) {
      menu.inline_keyboard.push([
        {
          text: BUTTON_PATTERNS.BACK,
          callback_data: renderOptions.backButtonCallbackData,
        },
      ])
    }
  }

  private appendExitButton(menu: InlineKeyboardMarkup, renderOptions: TPaginatedMenuRenderOptions) {
    if (renderOptions.withExitButton) {
      menu.inline_keyboard.push([COMMON_BUTTONS.CLOSE])
    }
  }

  /** Per-request prompt override derived from params; falls back to config.promptMessage. */
  protected getPromptMessage(_params: T): string | undefined {
    return undefined
  }

  /** Per-request "no options" override derived from params; falls back to config.noOptionsMessage. */
  protected getNoOptionsMessage(_params: T): string | undefined {
    return undefined
  }

  protected abstract loadOptions(
    params: T,
    renderOptions: TPaginatedMenuRenderOptions,
  ): Promise<TNormalizedOption[] | { message: string }>
}
