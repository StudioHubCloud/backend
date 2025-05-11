import { Composer } from 'telegraf'
import { Injectable } from '@nestjs/common'
import { BotContext } from '@app/bot/bot.context'
import { KeyboardHelper, UserHelper } from '@app/bot/helpers'
import { PATTERNS_CLIENT } from '@app/bot/static/patterns'
import { GroupService } from '@app/domain/group'
import { CALLBACK_DATA } from '@app/libs'

@Injectable()
export class SchedulerComposer {
  private readonly composer: Composer<BotContext>
  private readonly callbackPrefix = 'group-select-client'
  private normalizedOptions: { label: string; value: string }[] = []
  private MenuPaginationActionRexExp: RegExp
  private MenuSelectItemRegex: RegExp

  constructor(
    private readonly groupService: GroupService,
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
    this.composer.hears(PATTERNS_CLIENT.SCHEDULE, this.trainingScheduleHandler)
    this.composer.hears(PATTERNS_CLIENT.ACTIVE_SCHEDULES, this.activeSchedulesHandler)

    this.composer.action(this.MenuSelectItemRegex, async (ctx) => {
      ctx.answerCbQuery()
      const itemId = ctx.match[1]
      //get users pass info
      //if multiple passes - render keyboard to select pass
      //if single pass - get training list based of user pass expired date
      //
      return ctx.reply(`You selected item with ID: ${itemId}`)
    })

    this.composer.action(this.MenuPaginationActionRexExp, async (ctx) => {
      ctx.answerCbQuery()
      const page = parseInt(ctx.match[1])
      const studioId = UserHelper.getStudioId(ctx)

      if (!this.normalizedOptions) {
        const groups = await this.groupService.getAllActiveGroups({ studioId })
        this.normalizedOptions = KeyboardHelper.prepareInlineMenuOptions(groups, {
          labelKey: 'name',
          valueKey: 'id',
          emoji: ['groupStyle', 'emoji'],
        })
      }

      const menu = KeyboardHelper.createPaginatedMenu(this.normalizedOptions, { prefix: this.callbackPrefix, page })
      await ctx.editMessageText('Choose an item:', { reply_markup: menu })
    })
  }

  private trainingScheduleHandler = async (ctx: BotContext) => {
    const studioId = UserHelper.getStudioId(ctx)
    const groups = await this.groupService.getAllActiveGroups({ studioId })

    if (!groups || groups.length === 0) {
      return ctx.reply('Немає доступних aктивних груп для запису на тренування.')
    }

    this.normalizedOptions = KeyboardHelper.prepareInlineMenuOptions(groups, {
      labelKey: 'name',
      valueKey: 'id',
      emoji: ['groupStyle', 'emoji'],
    })
    const menu = KeyboardHelper.createPaginatedMenu(this.normalizedOptions, { prefix: this.callbackPrefix })

    return ctx.reply('Вибаріть групу:', { reply_markup: menu })
  }

  private activeSchedulesHandler = async (ctx: BotContext) => {
    await ctx.reply('Active schedules handler works')
  }
}
