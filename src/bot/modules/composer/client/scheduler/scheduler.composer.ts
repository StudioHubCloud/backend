import { Composer } from 'telegraf'
import { Injectable } from '@nestjs/common'
import { BotContext } from '@app/bot/bot.context'
import { KeyboardHelper, RegexHelper, UserHelper } from '@app/bot/helpers'
import { PATTERNS_CLIENT, PATTERNS_COMMON } from '@app/bot/static/patterns'
import { GroupService } from '@app/domain/group'
import { TrainingService } from '@app/domain/training'
import { CALLBACK_PREFIX, TNormalizedOption } from '@app/libs'

@Injectable()
export class SchedulerComposer {
  private readonly composer: Composer<BotContext>
  private normalizedOptions: TNormalizedOption[] = []
  private MenuPaginationActionRexExp: RegExp
  private MenuSelectItemRegex: RegExp

  constructor(
    private readonly groupService: GroupService,
    private readonly trainingService: TrainingService,
  ) {
    this.composer = new Composer<BotContext>()

    this.MenuPaginationActionRexExp = RegexHelper.createMenuPaginationActionRegex(CALLBACK_PREFIX.CLIENT_GROUP_SELECT)
    this.MenuSelectItemRegex = RegexHelper.createMenuSelectItemRegex(CALLBACK_PREFIX.CLIENT_GROUP_SELECT)

    this.initComposer()
  }

  getComposer() {
    return this.composer
  }

  initComposer() {
    this.composer.hears(PATTERNS_COMMON.SCHEDULE, this.trainingScheduleHandler)
    this.composer.hears(PATTERNS_CLIENT.ACTIVE_SCHEDULES, this.activeSchedulesHandler)

    this.composer.action(this.MenuSelectItemRegex, async (ctx) => {
      ctx.answerCbQuery()
      const itemId = ctx.match[1]
      //get training list based of user pass expired date
      const availableTrainings = await this.trainingService.getTrainingsListForSchedule(itemId, ctx.from.id)

      console.log(availableTrainings, 'availableTrainings')
      return ctx.reply(`You selected item with ID: ${itemId}`)
    })

    this.composer.action(this.MenuPaginationActionRexExp, async (ctx) => {
      ctx.answerCbQuery()
      const page = parseInt(ctx.match[1])

      if (!this.normalizedOptions) {
        const groups = await this.groupService.getAllActiveGroups()
        this.normalizedOptions = KeyboardHelper.prepareInlineMenuOptions(groups, {
          labelKey: 'name',
          valueKey: 'id',
          emoji: ['groupStyle', 'emoji'],
        })
      }

      const menu = KeyboardHelper.createPaginatedMenu(this.normalizedOptions, { prefix: CALLBACK_PREFIX.CLIENT_GROUP_SELECT, page })
      await ctx.editMessageText('Choose an item:', { reply_markup: menu })
    })
  }

  private trainingScheduleHandler = async (ctx: BotContext) => {
    const groups = await this.groupService.getAllActiveGroups()

    if (!groups || groups.length === 0) {
      return ctx.reply('Немає доступних aктивних груп для запису на тренування.')
    }

    this.normalizedOptions = KeyboardHelper.prepareInlineMenuOptions(groups, {
      labelKey: 'name',
      valueKey: 'id',
      emoji: ['groupStyle', 'emoji'],
    })
    const menu = KeyboardHelper.createPaginatedMenu(this.normalizedOptions, { prefix: CALLBACK_PREFIX.CLIENT_GROUP_SELECT })
    return ctx.reply('Вибаріть групу:', { reply_markup: menu })
  }

  private activeSchedulesHandler = async (ctx: BotContext) => {
    await ctx.reply('Active schedules handler works')
  }

  private groupSelectPaginationActionHandler = async (ctx: BotContext) => {}

  private groupSelectActionHandler = async (ctx: BotContext) => {};
}
