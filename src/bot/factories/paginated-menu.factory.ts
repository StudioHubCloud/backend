import { BotContext } from '@app/bot/bot.context'
import { KeyboardHelper, RegexHelper } from '@app/bot/helpers'
import { CALLBACK_DATA, TNormalizedOption } from '@app/bot/libs'
import { InlineKeyboardMarkup } from 'telegraf/typings/core/types/typegram'

interface PaginatedMenuConfig {
  callbackPrefix: string
  promptMessage?: string
  perPage?: number
}

export class PaginatedMenuFactory {
  private config: PaginatedMenuConfig
  private selectItemRegex: RegExp
  private paginationRegex: RegExp

  constructor(config: PaginatedMenuConfig) {
    this.config = { perPage: 6, ...config }

    this.paginationRegex = RegexHelper.createMenuPaginationActionRegex(config.callbackPrefix)
    this.selectItemRegex = RegexHelper.createMenuSelectItemRegex(config.callbackPrefix)
  }

  // Check if it's item selection (let it pass to scene handler)
  isItemSelection(callbackData: string): boolean {
    return this.selectItemRegex.test(callbackData)
  }

  // Check if it's pagination (handle internally)
  isPagination(callbackData: string): boolean {
    return this.paginationRegex.test(callbackData) || callbackData === CALLBACK_DATA.DISABLED
  }

  // Handle pagination callback and edit message
  async handlePagination(ctx: BotContext, callbackData: string, data: TNormalizedOption[]): Promise<void> {
    const match = callbackData.match(this.paginationRegex)
    if (!match) return

    await ctx.answerCbQuery()

    const page = parseInt(match[1])
    const menu = await this.createMenu(data, page)

    await ctx.editMessageText(this.config.promptMessage || 'Виберіть елемент зі списку', {
      reply_markup: menu,
      parse_mode: 'HTML',
    })
  }

  // Create initial menu
  async createMenu(data: TNormalizedOption[], page: number = 1): Promise<InlineKeyboardMarkup> {
    return KeyboardHelper.createPaginatedMenu(data, {
      prefix: this.config.callbackPrefix,
      page,
      perPage: this.config.perPage!,
    })
  }

  // Send initial menu message
  async sendMenu(ctx: BotContext, data: TNormalizedOption[], page: number = 1): Promise<void> {
    const menu = await this.createMenu(data, page)

    await ctx.reply(this.config.promptMessage || 'Виберіть елемент зі списку', {
      reply_markup: menu,
      parse_mode: 'HTML',
    })
  }

  // Edit existing menu message
  async editMenu(ctx: BotContext, data: TNormalizedOption[], page: number = 1): Promise<void> {
    const menu = await this.createMenu(data, page)

    await ctx.editMessageText(this.config.promptMessage || 'Виберіть елемент зі списку', {
      reply_markup: menu,
      parse_mode: 'HTML',
    })
  }

  // Extract item value from callback
  extractItemValue(callbackData: string): string | null {
    const match = callbackData.match(this.selectItemRegex)
    return match ? match[1] : null
  }
}
