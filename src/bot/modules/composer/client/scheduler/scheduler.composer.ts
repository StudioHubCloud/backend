import { BotContext } from '@app/bot/bot.context'
import { CLIENT_PATTERNS } from '@app/bot/static/patterns'
import { Injectable } from '@nestjs/common'
import { Composer } from 'telegraf'

@Injectable()
export class SchedulerComposer {
  private readonly composer: Composer<BotContext>
  constructor() {
    this.composer = new Composer<BotContext>()
    this.initComposer()
  }

  getComposer() {
    return this.composer
  }

  initComposer() {
    this.composer.hears(CLIENT_PATTERNS.SCHEDULE, this.trainingScheduleHandler)
    this.composer.hears(CLIENT_PATTERNS.ACTIVE_SCHEDULES, this.activeSchedulesHandler)
  }

  private trainingScheduleHandler = async (ctx: BotContext) => {
    await ctx.reply('Training schedule handler works')
  }
  private activeSchedulesHandler = async (ctx: BotContext) => {
    await ctx.reply('Active schedules handler works')
  }
}
