import { BotContext } from '@app/bot/bot.context'
import { KeyboardService } from '@app/bot/modules/keyboard'
import { CLIENT_PATTERNS } from '@app/bot/static/patterns'
import { GroupService } from '@app/domain/group'
import { CALLBACK_DATA } from '@app/libs'
import { Injectable } from '@nestjs/common'
import { Composer } from 'telegraf'

@Injectable()
export class SchedulerComposer {
  private readonly composer: Composer<BotContext>
  private readonly callbackPrefix = 'group-select-client'
  private normalizedOptions: { label: string; value: string }[] = []
  private MenuPaginationActionRexExp: RegExp
  private MenuSelectItemRegex: RegExp

  constructor(
    private readonly groupService: GroupService,
    private readonly keyboardService: KeyboardService,
  ) {
    this.composer = new Composer<BotContext>()

    this.MenuPaginationActionRexExp = new RegExp(`^${this.callbackPrefix}:${CALLBACK_DATA.PAGINATION_KEY}:(.*)$`)
    this.MenuSelectItemRegex = new RegExp(`^${this.callbackPrefix}:${CALLBACK_DATA.ITEM_KEY}:(.*)$`)

    this.initComposer()
  }

  getComposer() {
    return this.composer
  }

  initComposer() {
    this.composer.hears(CLIENT_PATTERNS.SCHEDULE, this.trainingScheduleHandler)
    this.composer.hears(CLIENT_PATTERNS.ACTIVE_SCHEDULES, this.activeSchedulesHandler)

    this.composer.action(this.MenuSelectItemRegex, async (ctx) => {
      ctx.answerCbQuery()
      const itemId = ctx.match[1]
      //remoge group keyboard
      //get users pass info
      //if multiple passes - render keyboard to select pass
      //if single pass - get training list based of user pass expired date
      //
      return ctx.reply(`You selected item with ID: ${itemId}`)
    })

    this.composer.action(this.MenuPaginationActionRexExp, async (ctx) => {
      ctx.answerCbQuery()
      const page = parseInt(ctx.match[1])

      if (!this.normalizedOptions) {
        const groups = await this.groupService.getAllActiveGroups()
        this.normalizedOptions = KeyboardService.prepareMenuOptions(groups, { labelKey: 'name', valueKey: 'id' })
      }

      const menu = this.keyboardService.createPaginatedMenu(this.normalizedOptions, { prefix: this.callbackPrefix, page })
      await ctx.editMessageText('Choose an item:', { reply_markup: menu })
    })
  }

  private trainingScheduleHandler = async (ctx: BotContext) => {
    const groups = await this.groupService.getAllActiveGroups()
    if (!groups || groups.length === 0) {
      return ctx.reply('Немає доступних aктивних груп для запису на тренування.')
    }

    this.normalizedOptions = KeyboardService.prepareMenuOptions(groups, { labelKey: 'name', valueKey: 'id' })
    const menu = this.keyboardService.createPaginatedMenu(this.normalizedOptions, { prefix: this.callbackPrefix })

    return ctx.reply('Вибаріть групу:', { reply_markup: menu })
  }

  private activeSchedulesHandler = async (ctx: BotContext) => {
    await ctx.reply('Active schedules handler works')
  }
}
