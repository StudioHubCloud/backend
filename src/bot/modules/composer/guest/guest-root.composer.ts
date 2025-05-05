import { BotContext } from '@app/bot/bot.context'
import { KeyboardService } from '@app/bot/modules'
import { CALLBACK_DATA } from '@app/libs'
import { Injectable } from '@nestjs/common'
import { Composer } from 'telegraf'

const testData = [
  { data: 'Item 1', id: '1' },
  { data: 'Item 2', id: '2' },
  { data: 'Item 3', id: '3' },
  { data: 'Item 4', id: '4' },
  { data: 'Item 5', id: '5' },
  { data: 'Item 6', id: '6' },
  { data: 'Item 7', id: '7' },
  { data: 'Item 8', id: '8' },
  { data: 'Item 9', id: '9' },
  { data: 'Item 10', id: '10' },
  { data: 'Item 11', id: '11' },
  { data: 'Item 12', id: '12' },
  { data: 'Item 13', id: '13' },
  { data: 'Item 14', id: '14' },
  { data: 'Item 15', id: '15' },
  { data: 'Item 16', id: '16' },
]

@Injectable()
export class GuestRootComposer {
  private readonly composer: Composer<BotContext>
  private readonly callbackPrefix = 'menu'
  private normalizedOptions: { label: string; value: string }[]

  constructor(private readonly keyboardService: KeyboardService) {
    this.composer = new Composer<BotContext>()

    this.composer.start(async (ctx) => {
      return ctx.reply('Welcome from Guest!', this.keyboardService.removeKeyboard())
    })

    this.initMenuInlineKeyboard()
  }

  initMenuInlineKeyboard() {
    const MenuPaginationRexExp = new RegExp(`^${this.callbackPrefix}:${CALLBACK_DATA.PAGINATION_KEY}:(.*)$`)
    const MenuSelectRegex = new RegExp(`^${this.callbackPrefix}:${CALLBACK_DATA.ITEM_KEY}:(.*)$`)

    this.composer.command('menu', (ctx) => {
      this.normalizedOptions = KeyboardService.prepareMenuOptions(testData, { labelKey: 'data', valueKey: 'id' })
      const menu = this.keyboardService.createPaginatedMenu(this.normalizedOptions, {prefix: this.callbackPrefix})
      ctx.reply('Choose an item:', { reply_markup: menu })
    })

    this.composer.action(MenuPaginationRexExp, async (ctx) => {
      ctx.answerCbQuery()
      const page = parseInt(ctx.match[1])
     
      if(!this.normalizedOptions) {
        this.normalizedOptions = KeyboardService.prepareMenuOptions(testData, { labelKey: 'data', valueKey: 'id' })
      }

      const menu = this.keyboardService.createPaginatedMenu(this.normalizedOptions , {prefix: this.callbackPrefix, page })
      await ctx.editMessageText('Choose an item:', { reply_markup: menu })
    })

    this.composer.action(MenuSelectRegex, async (ctx) => {
      ctx.answerCbQuery()
      const itemId = ctx.match[1]
      return ctx.reply(`You selected item with ID: ${itemId}`)
    })
  }

  getComposer() {
    return this.composer
  }
}
